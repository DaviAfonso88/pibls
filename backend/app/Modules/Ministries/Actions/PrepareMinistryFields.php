<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Actions;

use App\Modules\Ministries\Enums\MinistryCategory;
use App\Shared\Sanitizer\HtmlSanitizer;
use App\Shared\ValueObjects\EmailAddress;
use App\Shared\ValueObjects\PhoneNumber;
use Illuminate\Validation\ValidationException;

/**
 * Os campos de um item do catálogo prontos para gravar, comuns a criar e alterar: o que chegou limpo (espaços, telefone
 * em E.164, e-mail em minúsculas), a descrição sanitizada no servidor (BR-046) e a conferência de que o item está
 * completo para a sua categoria (BR-049): grupo e Célula de CL pedem dia e horário, e a Célula pede também o bairro.
 */
final class PrepareMinistryFields
{
    public const MAX_DESCRIPTION_CHARS = 5000;

    public function __construct(private readonly HtmlSanitizer $sanitizer) {}

    /**
     * @param  array<string, mixed>  $input  só o que foi enviado
     * @param  array<string, mixed>  $current  os valores de hoje (vazio na criação), para conferir o item inteiro
     * @return array<string, mixed> os campos a gravar
     */
    public function __invoke(array $input, array $current = []): array
    {
        $fields = [];

        foreach (['name', 'leaders_text', 'schedule_text', 'neighborhood', 'private_address'] as $field) {
            if (array_key_exists($field, $input)) {
                $text = trim((string) $input[$field]);
                $fields[$field] = $field === 'name' ? $text : ($text === '' ? null : $text);
            }
        }

        foreach (['category', 'display_order', 'is_active'] as $field) {
            if (array_key_exists($field, $input)) {
                $fields[$field] = $input[$field];
            }
        }

        if (array_key_exists('description', $input)) {
            $fields['description'] = $this->description($input['description']);
        }

        if (array_key_exists('contact_phone', $input)) {
            $phone = is_string($input['contact_phone']) ? PhoneNumber::tryFrom($input['contact_phone']) : null;
            $fields['contact_phone'] = $phone?->e164();
        }

        if (array_key_exists('contact_email', $input)) {
            $email = is_string($input['contact_email']) ? EmailAddress::tryFrom($input['contact_email']) : null;
            $fields['contact_email'] = $email?->value();
        }

        $this->ensureComplete([...$current, ...$fields]);

        return $fields;
    }

    private function description(mixed $raw): ?string
    {
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }

        $clean = $this->sanitizer->sanitize($raw);

        if ($clean->textLength() > self::MAX_DESCRIPTION_CHARS) {
            throw ValidationException::withMessages(['description' => [__('errors.ministry_description_too_long')]]);
        }

        return $clean->plainText() === '' ? null : $clean->html;
    }

    /**
     * BR-049, sobre o item como ficará: o que já estava gravado mais o que mudou.
     *
     * @param  array<string, mixed>  $item
     */
    private function ensureComplete(array $item): void
    {
        $category = MinistryCategory::tryFrom((string) ($item['category'] ?? ''));
        $errors = [];

        if (in_array($category, [MinistryCategory::Grupo, MinistryCategory::Celula], true) && $this->blank($item['schedule_text'] ?? null)) {
            $errors['schedule_text'] = [__('business.BR-049.0')];
        }

        if ($category === MinistryCategory::Celula && $this->blank($item['neighborhood'] ?? null)) {
            $errors['neighborhood'] = [__('business.BR-049.1')];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function blank(mixed $value): bool
    {
        return ! is_string($value) || trim($value) === '';
    }
}
