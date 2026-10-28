<?php

declare(strict_types=1);

namespace App\Modules\Platform\DomainEvents;

/**
 * Criação, alteração ou exclusão de dado público (configurações, ministérios, boletins, mensagens, eventos).
 * Emitido pelos módulos Content, Ministries e Events, dentro da transação; a Platform regenera os snapshots JSON
 * (ADR-014) depois do commit.
 */
final readonly class PublicContentChanged
{
    /**
     * @param  list<string>  $snapshots  nomes dos snapshots afetados; vazio = todos
     */
    public function __construct(public array $snapshots = []) {}
}
