<?php

declare(strict_types=1);

namespace App\Modules\Content\Enums;

/**
 * Estado derivado de um boletim ou mensagem (data-model.md): `AGENDADO` enquanto `published_at` está no futuro (BR-042),
 * `PUBLICADO` depois. O excluído não aparece na API; ele some pela exclusão lógica.
 */
enum PublicationStatus: string
{
    case Agendado = 'AGENDADO';
    case Publicado = 'PUBLICADO';
}
