<?php

declare(strict_types=1);

namespace App\Modules\Events\ValueObjects;

use App\Modules\Events\Enums\FormFieldType;
use App\Shared\ValueObjects\InvalidValueObject;
use DateTimeImmutable;

/**
 * As respostas de uma inscrição, validadas contra o `form_schema` vigente (BR-024): obrigatoriedade, tipo, limites e
 * opções. Guarda uma entrada por campo do formulário, na ordem dele, com o rótulo da época: se o campo for renomeado
 * depois, a inscrição continua mostrando o que a pessoa viu. Chave que o formulário não tem é descartada.
 */
final readonly class RegistrationAnswers
{
    public const MAX_TEXT = 200;

    public const MAX_TEXTAREA = 2000;

    /**
     * @param  list<array{key: string, label: string, type: string, value: mixed}>  $items
     */
    private function __construct(public array $items) {}

    /**
     * @param  array<array-key, mixed>  $input  `key` do campo => valor, como a pessoa enviou
     *
     * @throws InvalidRegistrationAnswers
     */
    public static function from(FormSchema $schema, array $input): self
    {
        $items = [];
        $errors = [];

        foreach ($schema->fields as $field) {
            try {
                $value = self::value($field, $input[$field->key] ?? null);
            } catch (InvalidValueObject $e) {
                $errors[$field->key] = $e->getMessage();

                continue;
            }

            $items[] = ['key' => $field->key, 'label' => $field->label, 'type' => $field->type->value, 'value' => $value];
        }

        if ($errors !== []) {
            throw new InvalidRegistrationAnswers($errors);
        }

        return new self($items);
    }

    /**
     * @return list<array{key: string, label: string, type: string, value: mixed}>
     */
    public function toArray(): array
    {
        return $this->items;
    }

    private static function value(FormField $field, mixed $raw): mixed
    {
        if (self::isEmpty($field, $raw)) {
            if ($field->required) {
                throw new InvalidValueObject('required', __('business.BR-024.0'));
            }

            return $field->type === FormFieldType::Boolean ? false : null;
        }

        return match ($field->type) {
            FormFieldType::Text => self::text($field, $raw, self::MAX_TEXT),
            FormFieldType::Textarea => self::text($field, $raw, self::MAX_TEXTAREA),
            FormFieldType::Number => self::number($field, $raw),
            FormFieldType::Date => self::date($raw),
            FormFieldType::Select => self::select($field, $raw),
            FormFieldType::Multiselect => self::multiselect($field, $raw),
            FormFieldType::Boolean => $raw === true ? true : throw self::invalid(),
        };
    }

    /** Vazio é ausente, `null`, texto em branco ou lista sem itens; num campo de marcar, "não marcado" também. */
    private static function isEmpty(FormField $field, mixed $raw): bool
    {
        return match (true) {
            $raw === null => true,
            is_string($raw) => trim($raw) === '',
            is_array($raw) => $raw === [],
            $field->type === FormFieldType::Boolean => $raw === false,
            default => false,
        };
    }

    private static function text(FormField $field, mixed $raw, int $ceiling): string
    {
        if (! is_string($raw)) {
            throw self::invalid();
        }

        $text = trim($raw);
        $length = mb_strlen($text);
        $max = (int) min($field->max ?? $ceiling, $ceiling);

        if ($length > $max) {
            throw new InvalidValueObject('too_long', str_replace('{max}', (string) $max, __('business.BR-024.3')));
        }

        if ($field->min !== null && $length < (int) $field->min) {
            throw new InvalidValueObject('too_short', str_replace('{min}', (string) (int) $field->min, __('business.BR-024.4')));
        }

        return $text;
    }

    private static function number(FormField $field, mixed $raw): int|float
    {
        $number = match (true) {
            is_int($raw), is_float($raw) => $raw,
            is_string($raw) && preg_match('/^-?\d+([.,]\d+)?$/', trim($raw)) === 1 => (float) str_replace(',', '.', trim($raw)),
            default => throw self::invalid(),
        };

        if (($field->min !== null && $number < $field->min) || ($field->max !== null && $number > $field->max)) {
            throw new InvalidValueObject('out_of_range', self::rangeMessage($field));
        }

        return floor((float) $number) === (float) $number ? (int) $number : (float) $number;
    }

    private static function rangeMessage(FormField $field): string
    {
        $min = $field->min === null ? null : self::plain($field->min);
        $max = $field->max === null ? null : self::plain($field->max);

        return match (true) {
            $min !== null && $max !== null => str_replace(['{min}', '{max}'], [$min, $max], __('business.BR-024.2')),
            $min !== null => str_replace('{min}', $min, __('business.BR-024.7')),
            default => str_replace('{max}', (string) $max, __('business.BR-024.8')),
        };
    }

    private static function plain(float $number): string
    {
        return floor($number) === $number ? (string) (int) $number : (string) $number;
    }

    /** `AAAA-MM-DD` de um dia que existe (31/02 não existe). */
    private static function date(mixed $raw): string
    {
        $text = is_string($raw) ? trim($raw) : '';
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $text);

        if ($date === false || $date->format('Y-m-d') !== $text) {
            throw new InvalidValueObject('invalid_date', __('business.BR-024.5'));
        }

        return $text;
    }

    private static function select(FormField $field, mixed $raw): string
    {
        $choice = is_string($raw) ? trim($raw) : null;

        if ($choice === null || ! in_array($choice, $field->options ?? [], true)) {
            throw new InvalidValueObject('invalid_option', __('business.BR-024.1'));
        }

        return $choice;
    }

    /**
     * @return list<string> as opções escolhidas, na ordem em que o formulário as lista
     */
    private static function multiselect(FormField $field, mixed $raw): array
    {
        if (! is_array($raw)) {
            throw new InvalidValueObject('invalid_option', __('business.BR-024.1'));
        }

        foreach ($raw as $choice) {
            if (! is_string($choice) || ! in_array(trim($choice), $field->options ?? [], true)) {
                throw new InvalidValueObject('invalid_option', __('business.BR-024.1'));
            }
        }

        $chosen = array_map('trim', array_filter($raw, 'is_string'));

        return array_values(array_filter($field->options ?? [], fn (string $option): bool => in_array($option, $chosen, true)));
    }

    private static function invalid(): InvalidValueObject
    {
        return new InvalidValueObject('invalid_answer', __('business.BR-024.6'));
    }
}
