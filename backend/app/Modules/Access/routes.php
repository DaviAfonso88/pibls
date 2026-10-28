<?php

declare(strict_types=1);

use App\Modules\Access\Authorization\PermissionKey;
use App\Modules\Access\Http\Controllers\AuthController;
use App\Modules\Access\Http\Controllers\PasswordResetController;
use App\Modules\Access\Http\Controllers\UserDirectoryController;
use App\Modules\Access\Http\PanelMiddleware;
use App\Shared\Http\RateLimiters;
use Illuminate\Support\Facades\Route;

// Carregado por routes/api.php, já sob o prefixo /api e o grupo de middleware `api`.
//
// O grupo `web` traz a sessão e o CSRF do Sanctum SPA (cookie XSRF-TOKEN + cabeçalho X-XSRF-TOKEN) só onde há sessão: a
// leitura pública não ganha cookie. O limite vem antes da sessão, para um robô barrado nem abrir uma.

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])
        ->middleware(['throttle:'.RateLimiters::LOGIN, 'web'])
        ->name('auth.login');

    Route::post('forgot-password', [PasswordResetController::class, 'forgot'])
        ->middleware(['throttle:'.RateLimiters::PASSWORD_FORGOT, 'web'])
        ->name('auth.forgot-password');

    Route::post('reset-password', [PasswordResetController::class, 'reset'])
        ->middleware(['throttle:'.RateLimiters::PASSWORD_RESET, 'web'])
        ->name('auth.reset-password');
});

// Toda rota autenticada: sessão (web), usuário logado, limite de 12 h, usuário ainda ativo (BR-074) e o limite `admin`
// (120 req/min por usuário, que por isso vem depois da autenticação). A permissão de cada rota é um `can:` (BR-076).
Route::middleware(PanelMiddleware::STACK)->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
    Route::get('auth/me', [AuthController::class, 'me'])->name('auth.me');

    Route::prefix('admin')->group(function () {
        Route::get('users', UserDirectoryController::class)
            ->middleware('can:'.PermissionKey::UsersRead->value)
            ->name('admin.users.index');
    });
});
