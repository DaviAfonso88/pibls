<?php

declare(strict_types=1);

namespace App\Modules\Events\ValueObjects;

use App\Shared\ValueObjects\InvalidValueObject;

/**
 * O formulário de inscrição de um evento (BR-031): até 30 campos, chave única em cada um. Quando algum campo é
 * `sensitive`, a inscrição passa a exigir o consentimento de dado de saúde (BR-083, ADR-020).
 */
final readonly class FormSchema
{
    public const MAX_FIELDS = 30;

    /**
     * @param  list<FormField>  $fields
     */
    private function __construct(public array $fields) {}

    /**
     * @param  array<int, mixed>  $rows  os campos como o painel os envia
     */
    public static function from(array $rows): self
    {
        if (count($rows) > self::MAX_FIELDS) {
            throw new InvalidValueObject('too_many_form_fields', 'O formulário pode ter no máximo 30 campos.');
        }

        $fields = [];
        $keys = [];

        foreach (array_values($rows) as $row) {
            if (! is_array($row)) {
                throw new InvalidValueObject('invalid_form_field', 'Cada campo do formulário precisa ser um objeto.');
            }

            $field = FormField::from($row);

            if (isset($keys[$field->key])) {
                throw new InvalidValueObject('duplicate_form_field_key', "Já existe um campo com a chave {$field->key}.");
            }

            $keys[$field->key] = true;
            $fields[] = $field;
        }

        return new self($fields);
    }

    public function hasSensitiveField(): bool
    {
        foreach ($this->fields as $field) {
            if ($field->sensitive) {
                return true;
            }
        }

        return false;
    }

    /**
     * As chaves do formulário anterior que este removeu ou cujo tipo trocou, na ordem do anterior. Mudar só o rótulo, a dica
     * ou as opções, ou acrescentar um campo, não conta: as respostas já dadas continuam fazendo sentido (BR-029).
     *
     * @return list<string>
     */
    public function breakingChangesFrom(self $previous): array
    {
        $current = [];
        foreach ($this->fields as $field) {
            $current[$field->key] = $field->type;
        }

        $broken = [];
        foreach ($previous->fields as $field) {
            if (! isset($current[$field->key]) || $current[$field->key] !== $field->type) {
                $broken[] = $field->key;
            }
        }

        return $broken;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(): array
    {
        return array_map(fn (FormField $field): array => $field->toArray(), $this->fields);
    }
}
