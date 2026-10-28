<?php

declare(strict_types=1);

namespace App\Modules\Access\Listeners;

use App\Modules\Access\Events\PasswordChanged;
use App\Modules\Access\Models\User;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\Mail\NoticeMail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Depois de trocar a senha (Security → Revogação): apaga TODAS as sessões do usuário, para que quem tinha a senha antiga
 * perca o acesso, enfileira o aviso "Sua senha foi alterada" (se não foi a pessoa, ela sabe que precisa agir) e audita.
 */
final class RevokeSessionsAndNotify
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(PasswordChanged $event): void
    {
        $user = User::query()->find($event->userId);
        if ($user === null) {
            return;
        }

        // O driver `database` guarda `user_id` na própria linha da sessão
        DB::table('sessions')->where('user_id', $user->getKey())->delete();

        Mail::to($user->email)->queue(new NoticeMail(
            type: 'password.changed',
            subjectText: 'Sua senha do painel PIBLS foi alterada',
            heading: 'Sua senha foi alterada',
            lines: [
                'A senha do seu acesso ao painel da Primeira Igreja Batista em Lagoa Santa acabou de ser alterada.',
                'Se foi você, não precisa fazer nada. Se não foi, fale agora com o administrador técnico da igreja.',
            ],
        ));

        $this->audit->record(AuditAction::PasswordChanged, 'user', $user->getKey(), actorUserId: (int) $user->getKey());
        Log::info('auth.password_changed', ['userId' => $user->getKey()]);
    }
}
