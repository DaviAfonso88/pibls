<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Events\Models\Event;

/**
 * Resultado de gravar um evento: o registro e se o servidor removeu formatação não permitida da descrição (BR-046).
 */
final readonly class SavedEvent
{
    public function __construct(
        public Event $event,
        public bool $sanitizationWarning,
    ) {}
}
