<?php

declare(strict_types=1);

namespace App\Modules\Events\Enums;

/**
 * Os tipos de campo do formulário de inscrição (BR-031).
 */
enum FormFieldType: string
{
    case Text = 'TEXT';
    case Textarea = 'TEXTAREA';
    case Number = 'NUMBER';
    case Date = 'DATE';
    case Select = 'SELECT';
    case Multiselect = 'MULTISELECT';
    case Boolean = 'BOOLEAN';

    /** Escolha numa lista: pede de 2 a 30 opções. */
    public function hasOptions(): bool
    {
        return $this === self::Select || $this === self::Multiselect;
    }

    /** `min` e `max` valem para números e para o tamanho de texto. */
    public function hasLimits(): bool
    {
        return in_array($this, [self::Text, self::Textarea, self::Number], true);
    }
}
