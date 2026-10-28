<?php

declare(strict_types=1);

namespace App\Modules\Access\Http;

use App\Shared\Http\RateLimiters;

/**
 * A pilha de middlewares de toda rota autenticada do painel: sessão e CSRF (`web`), usuário logado, limite de 12 h da
 * sessão, usuário ainda ativo (BR-074) e o limite `admin` (120 req/min por usuário, que vem depois da autenticação para
 * contar por usuário). A permissão de cada rota é conferida à parte (`can:` ou Policy no controlador, BR-076).
 */
final class PanelMiddleware
{
    /** @var list<string> */
    public const STACK = ['web', 'auth:web', 'session.limits', 'active.user', 'throttle:'.RateLimiters::ADMIN];
}
