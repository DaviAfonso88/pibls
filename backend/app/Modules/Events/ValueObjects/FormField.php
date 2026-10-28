<?php

declare(strict_types=1);

namespace App\Modules\Events\ValueObjects;

use App\Modules\Events\Enums\FormFieldType;
use App\Shared\ValueObjects\InvalidValueObject;

/**
 * Um campo do formulário de inscrição (BR-031): chave estável, rótulo, tipo, obrigatoriedade, dica, limites, opções e o
 * marcador `sensitive` (dado de saúde; ADR-020, BR-083). É o que fica em `events.form_schema`.
 */
final readonly class FormField
{
    public const KEY_PATTERN = '/^[a-z][a-z0-9_]{0,39}$/';

    public const MAX_LABEL = 150;

    public const MAX_HELP_TEXT = 300;

    public const MIN_OPTIONS = 2;

    public const MAX_OPTIONS = 30;

    /**
     * @param  list<string>|null  $options
     */
    private function __construct(
        public string $key,
        public string $label,
        public FormFieldType $type,
        public bool $required,
        public ?string $helpText,
        public bool $sensitive,
        public ?float $min,
        public ?float $max,
        public ?array $options,
    ) {}

    /**
     * @param  array<string, mixed>  $data  `key`, `label`, `type`, `required` e, se for o caso, `help_text`, `sensitive`, `min`, `max`, `options`
     */
    public static function from(array $data): self
    {
        $type = self::type($data['type'] ?? null);

        [$min, $max] = $type->hasLimits() ? self::limits($data['min'] ?? null, $data['max'] ?? null) : [null, null];

        return new self(
            self::key($data['key'] ?? null),
            self::label($data['label'] ?? null),
            $type,
            self::flag($data, 'required', 'Diga se o campo é obrigatório.', false, mandatory: true),
            self::helpText($data['help_text'] ?? null),
            self::flag($data, 'sensitive', 'O marcador de dado de saúde precisa ser verdadeiro ou falso.', false),
            $min,
            $max,
            $type->hasOptions() ? self::options($data['options'] ?? null) : null,
        );
    }

    /**
     * @return array{key: string, label: string, type: string, required: bool, help_text: string|null, sensitive: bool, min: float|null, max: float|null, options: list<string>|null}
     */
    public function toArray(): array
    {
        return [
            'key' => $this->key,
            'label' => $this->label,
            'type' => $this->type->value,
            'required' => $this->required,
            'help_text' => $this->helpText,
            'sensitive' => $this->sensitive,
            'min' => $this->min,
            'max' => $this->max,
            'options' => $this->options,
        ];
    }

    private static function key(mixed $value): string
    {
        if (! is_string($value) || preg_match(self::KEY_PATTERN, $value) !== 1) {
            throw new InvalidValueObject('invalid_form_field_key', 'A chave do campo deve começar com letra minúscula e ter só letras minúsculas, números e _ (até 40 caracteres).');
        }

        return $value;
    }

    private static function label(mixed $value): string
    {
        $label = is_string($value) ? trim((string) preg_replace('/\s+/u', ' ', $value)) : '';

        if ($label === '' || mb_strlen($label) > self::MAX_LABEL) {
            throw new InvalidValueObject('invalid_form_field_label', 'Informe o rótulo do campo (até 150 caracteres).');
        }

        return $label;
    }

    private static function type(mixed $value): FormFieldType
    {
        $type = is_string($value) ? FormFieldType::tryFrom($value) : null;

        return $type ?? throw new InvalidValueObject('invalid_form_field_type', 'Escolha o tipo do campo.');
    }

    private static function helpText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = is_string($value) ? trim($value) : '';

        if ($text === '') {
            return null;
        }

        if (mb_strlen($text) > self::MAX_HELP_TEXT) {
            throw new InvalidValueObject('invalid_form_field_help_text', 'A dica do campo pode ter até 300 caracteres.');
        }

        return $text;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private static function flag(array $data, string $name, string $message, bool $default, bool $mandatory = false): bool
    {
        if (! array_key_exists($name, $data)) {
            return $mandatory ? throw new InvalidValueObject("invalid_form_field_{$name}", $message) : $default;
        }

        return is_bool($data[$name]) ? $data[$name] : throw new InvalidValueObject("invalid_form_field_{$name}", $message);
    }

    /**
     * @return array{0: float|null, 1: float|null}
     */
    private static function limits(mixed $min, mixed $max): array
    {
        foreach ([$min, $max] as $limit) {
            if ($limit !== null && ! is_int($limit) && ! is_float($limit)) {
                throw new InvalidValueObject('invalid_form_field_limits', 'O mínimo e o máximo precisam ser números.');
            }
        }

        if ($min !== null && $max !== null && $min > $max) {
            throw new InvalidValueObject('invalid_form_field_limits', 'O mínimo não pode ser maior que o máximo.');
        }

        return [$min === null ? null : (float) $min, $max === null ? null : (float) $max];
    }

    /**
     * @return list<string>
     */
    private static function options(mixed $value): array
    {
        $invalid = new InvalidValueObject('invalid_form_field_options', 'Informe de 2 a 30 opções diferentes.');

        if (! is_array($value) || count($value) < self::MIN_OPTIONS || count($value) > self::MAX_OPTIONS) {
            throw $invalid;
        }

        $options = [];
        $seen = [];

        foreach ($value as $option) {
            $text = is_string($option) ? trim((string) preg_replace('/\s+/u', ' ', $option)) : '';
            $folded = mb_strtolower($text);

            if ($text === '' || mb_strlen($text) > self::MAX_LABEL || isset($seen[$folded])) {
                throw $invalid;
            }

            $seen[$folded] = true;
            $options[] = $text;
        }

        return $options;
    }
}
