<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Controllers;

use App\Modules\Access\Actions\Login;
use App\Modules\Access\Actions\Logout;
use App\Modules\Access\Http\Requests\LoginRequest;
use App\Modules\Access\Http\Resources\CurrentUserResource;
use App\Modules\Access\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Login, logout e `me` do painel (CAP-08). A sessão é por cookie (Sanctum SPA, ADR-008); as rotas usam o grupo `web`
 * para ter sessão e CSRF.
 */
final class AuthController
{
    /** `POST /api/auth/login`: 200 com o mesmo corpo do `me`; 422 `INVALID_CREDENTIALS` (BR-070); 429 (BR-071). */
    public function login(LoginRequest $request, Login $login): CurrentUserResource
    {
        $user = $login($request, (string) $request->input('email'), (string) $request->input('password'));

        return new CurrentUserResource($user->load(['ministry', 'permissions']));
    }

    /** `POST /api/auth/logout`: 204. */
    public function logout(Request $request, Logout $logout): Response
    {
        $logout($request);

        return response()->noContent();
    }

    /** `GET /api/auth/me`: o usuário da sessão, com papéis e permissões. */
    public function me(Request $request): CurrentUserResource
    {
        $user = $request->user();

        // A rota exige sessão; isto só protege o tipo
        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        return new CurrentUserResource($user->load(['ministry', 'permissions']));
    }
}
