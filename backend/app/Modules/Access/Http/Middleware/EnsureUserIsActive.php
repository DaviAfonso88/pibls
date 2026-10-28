<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Middleware;

use App\Modules\Access\Models\User;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Usuário desativado perde o acesso na requisição seguinte (BR-074): o `is_active` é conferido em toda requisição
 * autenticada, sem esperar a sessão expirar. A resposta é a de sessão expirada (401), sem revelar o motivo.
 */
final class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && ! $user->is_active) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw new AuthenticationException;
        }

        return $next($request);
    }
}
