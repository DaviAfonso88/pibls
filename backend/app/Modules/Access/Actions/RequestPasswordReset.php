<?php

declare(strict_types=1);

namespace App\Modules\Access\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\Mail\NoticeMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;

/**
 * Pede o link de redefinição de senha (RF-D06). Quem chama responde SEMPRE a mesma frase, exista ou não o e-mail: aqui só
 * se decide se há o que enviar. Só usuário ativo recebe o link.
 *
 * O token de uso único (guardado como hash em `password_reset_tokens`, válido por 60 min, BR-072) vai no *fragmento* da
 * URL (`#token=…&email=…`): o fragmento não chega ao servidor, aos logs do Apache nem ao cabeçalho Referer.
 */
final class RequestPasswordReset
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function __invoke(string $email): void
    {
        $user = User::query()
            ->where('email', mb_strtolower(trim($email)))
            ->where('is_active', true)
            ->first();

        if ($user === null) {
            return;
        }

        $token = Password::broker()->createToken($user);
        $link = rtrim((string) config('app.url'), '/').'/admin/redefinir-senha#'.http_build_query([
            'token' => $token,
            'email' => $user->email,
        ]);

        Mail::to($user->email)->queue(new NoticeMail(
            type: 'password.reset',
            subjectText: 'Crie uma nova senha do painel PIBLS',
            heading: 'Crie uma nova senha',
            lines: [
                'Recebemos um pedido para criar uma nova senha do painel da Primeira Igreja Batista em Lagoa Santa.',
                'O link vale por 60 minutos e só funciona uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.',
            ],
            actionLabel: 'Criar nova senha',
            actionUrl: $link,
        ));

        $this->audit->record(AuditAction::PasswordResetRequested, 'user', $user->getKey(), actorUserId: null);
    }
}
