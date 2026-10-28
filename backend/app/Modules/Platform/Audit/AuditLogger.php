<?php

declare(strict_types=1);

namespace App\Modules\Platform\Audit;

use App\Modules\Platform\Models\AuditLog;
use App\Shared\Http\RequestId;
use App\Shared\Logging\PiiScrubber;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use LogicException;

/**
 * Grava em `audit_logs` (só inclusão). Quem fez, o quê, em qual recurso, de qual IP e sob qual correlation ID.
 *
 * `changes` aceita só dado NÃO pessoal (títulos, flags, chave PIX, valor anterior e novo de configuração).
 * Se chegar telefone, e-mail, nome ou texto de contato, o valor é removido antes de gravar. Em local e no CI isso
 * também lança exceção, para o erro de programação aparecer nos testes; em produção, o registro é gravado já
 * limpo e a falha vai para o log, porque a auditoria nunca pode derrubar a operação do usuário.
 */
final class AuditLogger
{
    /**
     * @param  array<string, mixed>  $changes  normalmente `['before' => [...], 'after' => [...]]`
     * @param  int|null  $actorUserId  por padrão, o usuário autenticado; `null` = sistema ou anônimo
     */
    public function record(
        AuditAction $action,
        ?string $resourceType = null,
        int|string|null $resourceId = null,
        array $changes = [],
        ?int $actorUserId = null,
    ): AuditLog {
        $actor = $actorUserId ?? self::authenticatedUserId();
        $request = request();

        return AuditLog::query()->create([
            'occurred_at' => CarbonImmutable::now('UTC'),
            'actor_user_id' => $actor,
            'action' => $action->value,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId === null ? null : (string) $resourceId,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent() === null ? null : mb_substr($request->userAgent(), 0, 255),
            'correlation_id' => RequestId::current($request),
            'changes' => $changes === [] ? null : $this->withoutPersonalData($changes, $action),
        ]);
    }

    /**
     * @param  array<array-key, mixed>  $changes
     * @return array<array-key, mixed>
     */
    private function withoutPersonalData(array $changes, AuditAction $action): array
    {
        $clean = PiiScrubber::scrub($changes);
        $clean = is_array($clean) ? $clean : [];

        if ($clean === $changes) {
            return $changes;
        }

        if (app()->environment(['local', 'testing'])) {
            throw new LogicException("A auditoria de {$action->value} recebeu dado pessoal em `changes`.");
        }

        Log::error('audit.personal_data_removed', ['action' => $action->value]);

        return $clean;
    }

    private static function authenticatedUserId(): ?int
    {
        $id = Auth::id();

        return is_numeric($id) ? (int) $id : null;
    }
}
