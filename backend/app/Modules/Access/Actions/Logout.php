<?php

declare(strict_types=1);

namespace App\Modules\Access\Actions;

use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/** Encerra a sessão: tira o usuário do guard, invalida a sessão e troca o token CSRF. */
final class Logout
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function __invoke(Request $request): void
    {
        $userId = Auth::guard('web')->id();

        // A auditoria vem antes: depois do logout não há mais ator
        $this->audit->record(AuditAction::Logout, 'user', is_scalar($userId) ? $userId : null);
        Log::info('auth.logout', ['userId' => $userId]);

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }
}
