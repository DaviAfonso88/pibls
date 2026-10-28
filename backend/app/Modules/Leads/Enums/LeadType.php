<?php

declare(strict_types=1);

namespace App\Modules\Leads\Enums;

use App\Modules\Access\Authorization\PermissionKey;

/**
 * Tipo de contato, um por formulário público (CAP-05). Define o que o formulário exige, quem é avisado e para onde o
 * e-mail aponta no painel.
 */
enum LeadType: string
{
    case Visitante = 'VISITANTE';
    case Membro = 'MEMBRO';
    case Oracao = 'ORACAO';
    case Contato = 'CONTATO';
    case Ministerio = 'MINISTERIO';

    /** Nome do formulário, como a equipe o conhece. */
    public function label(): string
    {
        return match ($this) {
            self::Visitante => 'Ficha de Visitante',
            self::Membro => 'Quero ser membro',
            self::Oracao => 'Pedido de oração',
            self::Contato => 'Fale conosco',
            self::Ministerio => 'Contato com ministério',
        };
    }

    /** Caminho do contato no painel. O pedido de oração tem caixa própria (BR-007). */
    public function panelPath(int $leadId): string
    {
        return $this === self::Oracao ? "/admin/oracao/{$leadId}" : "/admin/contatos/{$leadId}";
    }

    /** Limite do texto da mensagem (BR-004). */
    public function maxMessageLength(): int
    {
        return $this === self::Oracao ? 4000 : 2000;
    }

    /** A mensagem é obrigatória neste tipo? */
    public function requiresMessage(): bool
    {
        return in_array($this, [self::Oracao, self::Contato, self::Ministerio], true);
    }

    /** Permissão para ler este tipo no painel: a caixa de oração tem a dela, e nunca se mistura com a geral (BR-007). */
    public function readPermission(): PermissionKey
    {
        return $this === self::Oracao ? PermissionKey::LeadsOracaoRead : PermissionKey::LeadsRead;
    }

    /** Permissão para atender (status, responsável, anotação) e excluir este tipo (CAP-10, CAP-11). */
    public function managePermission(): PermissionKey
    {
        return $this === self::Oracao ? PermissionKey::LeadsOracaoManage : PermissionKey::LeadsManage;
    }

    /**
     * Os quatro tipos da caixa geral (CAP-10); o pedido de oração fica de fora, na caixa própria (CAP-11).
     *
     * @return list<self>
     */
    public static function general(): array
    {
        return [self::Visitante, self::Membro, self::Contato, self::Ministerio];
    }
}
