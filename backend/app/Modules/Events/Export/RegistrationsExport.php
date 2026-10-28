<?php

declare(strict_types=1);

namespace App\Modules\Events\Export;

use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use App\Shared\ValueObjects\PhoneNumber;
use Generator;

/**
 * A planilha das inscrições de um evento (FR-061): CSV em UTF-8 com BOM e separador `;`, que o Excel em português abre
 * com acentos e colunas certos. As colunas são as mesmas do PDF do painel: os campos fixos e uma por pergunta do
 * formulário, na ordem dele. Sem inscrições, só o cabeçalho. As linhas saem por *streaming*, `CHUNK` por vez.
 */
final class RegistrationsExport
{
    public const BOM = "\xEF\xBB\xBF";

    private const CHUNK = 200;

    private const TIMEZONE = 'America/Sao_Paulo';

    public function __construct(private readonly Event $event) {}

    /** `inscritos-<slug>-AAAAMMDD.csv`, com a data de hoje em Brasília. */
    public function filename(): string
    {
        return sprintf('inscritos-%s-%s.csv', $this->event->slug, now(self::TIMEZONE)->format('Ymd'));
    }

    /** @return Generator<int, string> */
    public function lines(): Generator
    {
        yield self::BOM.self::line($this->headers());

        $fields = array_values($this->event->form_schema);

        foreach ($this->event->registrations()->orderBy('created_at')->orderBy('id')->lazyById(self::CHUNK) as $registration) {
            yield self::line($this->cells($registration, $fields));
        }
    }

    /** @return list<string> */
    public function headers(): array
    {
        $headers = ['Inscrito em', 'Nome', 'Telefone', 'E-mail'];

        if ($this->event->has_minors) {
            array_push($headers, 'Responsável', 'Telefone do responsável');
        }

        foreach ($this->event->form_schema as $field) {
            $headers[] = (string) ($field['label'] ?? $field['key']);
        }

        return $headers;
    }

    /**
     * @param  array<int, array<string, mixed>>  $fields
     * @return list<string>
     */
    private function cells(EventRegistration $registration, array $fields): array
    {
        $cells = [
            $registration->created_at->setTimezone(self::TIMEZONE)->format('d/m/Y H:i'),
            $registration->participant_name,
            self::phone($registration->phone),
            (string) $registration->email,
        ];

        if ($this->event->has_minors) {
            array_push($cells, (string) $registration->guardian_name, self::phone($registration->guardian_phone));
        }

        $answers = [];
        foreach ($registration->answers as $answer) {
            $answers[(string) ($answer['key'] ?? '')] = $answer;
        }

        foreach ($fields as $field) {
            $cells[] = self::answer($answers[(string) $field['key']] ?? null);
        }

        return $cells;
    }

    private static function phone(?string $e164): string
    {
        if ($e164 === null || $e164 === '') {
            return '';
        }

        return PhoneNumber::tryFrom($e164)?->formatted() ?? $e164;
    }

    /** @param  array<string, mixed>|null  $answer */
    private static function answer(?array $answer): string
    {
        $value = $answer['value'] ?? null;

        return match (true) {
            $value === null || $value === '' => '',
            is_bool($value) => $value ? 'Sim' : 'Não',
            is_int($value) || is_float($value) => str_replace('.', ',', (string) $value),
            is_array($value) => implode(', ', array_map(strval(...), $value)),
            ($answer['type'] ?? null) === 'DATE' && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', (string) $value, $date) === 1 => "{$date[3]}/{$date[2]}/{$date[1]}",
            default => (string) $value,
        };
    }

    /** @param  list<string>  $cells */
    private static function line(array $cells): string
    {
        return implode(';', array_map(self::cell(...), $cells))."\r\n";
    }

    /**
     * Uma célula: entre aspas se tiver `;`, aspas ou quebra de linha. Texto que começa com `=`, `+`, `-`, `@`, tabulação ou
     * retorno de carro ganha um apóstrofo na frente, para a planilha não executá-lo como fórmula (CSV injection). Número
     * (resposta numérica, com vírgula decimal) não é texto: sai como está.
     */
    private static function cell(string $value): string
    {
        $isNumber = preg_match('/^-?\d+(,\d+)?$/', $value) === 1;

        if (! $isNumber && $value !== '' && str_contains("=+-@\t\r", $value[0])) {
            $value = "'".$value;
        }

        if (preg_match('/[;"\r\n]/', $value) === 1) {
            return '"'.str_replace('"', '""', $value).'"';
        }

        return $value;
    }
}
