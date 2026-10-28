<?php

declare(strict_types=1);

namespace App\Modules\Access\Authorization;

/**
 * As 14 chaves do catálogo de permissões (Requisitos Funcionais → Matriz de permissões). O catálogo mora na tabela
 * `permissions`, carregada por migration; este enum é o espelho em código, para o Gate e para as rotas não dependerem de
 * texto solto. Um teste confere que os dois têm as mesmas chaves.
 */
enum PermissionKey: string
{
    case BoletinsWrite = 'boletins.write';
    case MensagensWrite = 'mensagens.write';
    case EventosWrite = 'eventos.write';
    case EventosWriteOwn = 'eventos.write.own';
    case EventosInscricoesRead = 'eventos.inscricoes.read';
    case EventosInscricoesReadOwn = 'eventos.inscricoes.read.own';
    case LeadsRead = 'leads.read';
    case LeadsManage = 'leads.manage';
    case LeadsOracaoRead = 'leads.oracao.read';
    case LeadsOracaoManage = 'leads.oracao.manage';
    case MinisteriosWrite = 'ministerios.write';
    case SettingsWrite = 'settings.write';
    case PixWrite = 'pix.write';
    case UsersRead = 'users.read';

    /** Permissão de escopo próprio (`.own`): vale só para o ministério vinculado ao usuário. */
    public function isOwnScope(): bool
    {
        return str_ends_with($this->value, '.own');
    }
}
