<?php

declare(strict_types=1);

use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use App\Modules\Leads\Models\Lead;
use App\Modules\Leads\Models\LeadActivity;
use App\Modules\Platform\Models\AuditLog;
use App\Modules\Platform\Retention\RetentionPurger;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/*
|--------------------------------------------------------------------------
| Expurgo LGPD (BR-080, FR-065, data-model → Retenção e expurgo)
|--------------------------------------------------------------------------
| Prazos aprovados em 2026-10-23: oração 60 dias após concluído (90 se nunca concluído), demais contatos 12 meses,
| inscrições 3 meses após o evento, `failed_jobs` 30 dias, auditoria 24 meses. Exclusão definitiva.
| "Hoje" nos testes: 2026-06-30 04:00 UTC.
*/

beforeEach(function () {
    Carbon::setTestNow('2026-06-30 04:00:00');
    config([
        'pibls.retention' => [
            'oracao_days' => 60,
            'oracao_unfinished_days' => 90,
            'leads_months' => 12,
            'registrations_months' => 3,
            'audit_months' => 24,
            'failed_jobs_days' => 30,
        ],
        'pibls.healthchecks.retention_purge' => 'https://hc-ping.com/purge-check',
    ]);
    Http::fake(['hc-ping.com/*' => Http::response('OK')]);
});

afterEach(fn () => Carbon::setTestNow());

/** Um contato com as datas pedidas (dias atrás); `$changedDaysAgo` é a base da retenção dos concluídos. */
function leadAged(string $type, string $status, int $createdDaysAgo, ?int $changedDaysAgo = null, bool $months = false): Lead
{
    $created = $months ? now()->subMonths($createdDaysAgo) : now()->subDays($createdDaysAgo);
    $changed = $changedDaysAgo === null
        ? $created
        : ($months ? now()->subMonths($changedDaysAgo) : now()->subDays($changedDaysAgo));

    $lead = Lead::factory()->state(['type' => $type, 'status' => $status])->create();
    DB::table('leads_messages')->where('id', $lead->getKey())->update([
        'created_at' => $created,
        'status_changed_at' => $changed,
    ]);

    return $lead;
}

function leadExists(Lead $lead): bool
{
    return DB::table('leads_messages')->where('id', $lead->getKey())->exists();
}

describe('pedidos de oração (ORACAO)', function () {
    it('BR-080 exclui o concluído 60 dias depois de concluído e mantém o de 59 dias', function () {
        $expired = leadAged('ORACAO', 'CONCLUIDO', 200, 61);
        $kept = leadAged('ORACAO', 'CONCLUIDO', 200, 59);

        Artisan::call('pibls:retention:purge');

        expect(leadExists($expired))->toBeFalse()->and(leadExists($kept))->toBeTrue();
    });

    it('BR-080 conta o prazo do concluído pela data da conclusão, não pela do envio', function () {
        $recentlyDone = leadAged('ORACAO', 'CONCLUIDO', 400, 5);

        Artisan::call('pibls:retention:purge');

        expect(leadExists($recentlyDone))->toBeTrue();
    });

    it('BR-080 exclui o nunca concluído 90 dias depois do envio, em qualquer status aberto', function () {
        $newExpired = leadAged('ORACAO', 'NOVO', 91);
        $inProgressExpired = leadAged('ORACAO', 'EM_ATENDIMENTO', 120, 3);
        $kept = leadAged('ORACAO', 'NOVO', 89);

        Artisan::call('pibls:retention:purge');

        expect(leadExists($newExpired))->toBeFalse()
            ->and(leadExists($inProgressExpired))->toBeFalse()
            ->and(leadExists($kept))->toBeTrue();
    });
});

describe('demais contatos', function () {
    it('BR-080 exclui 12 meses depois da última mudança de status e mantém o de 11 meses', function () {
        $expired = [
            leadAged('VISITANTE', 'CONCLUIDO', 14, 13, months: true),
            leadAged('MEMBRO', 'CONCLUIDO', 14, 13, months: true),
            leadAged('CONTATO', 'CONCLUIDO', 14, 13, months: true),
        ];
        $kept = leadAged('VISITANTE', 'CONCLUIDO', 14, 11, months: true);

        Artisan::call('pibls:retention:purge');

        foreach ($expired as $lead) {
            expect(leadExists($lead))->toBeFalse();
        }
        expect(leadExists($kept))->toBeTrue();
    });

    it('BR-080 exclui também o que ficou parado em NOVO ou EM_ATENDIMENTO por mais de 12 meses', function () {
        $stalled = leadAged('VISITANTE', 'NOVO', 13, months: true);
        $inProgress = leadAged('CONTATO', 'EM_ATENDIMENTO', 14, 13, months: true);
        $fresh = leadAged('VISITANTE', 'NOVO', 2, months: true);

        Artisan::call('pibls:retention:purge');

        expect(leadExists($stalled))->toBeFalse()
            ->and(leadExists($inProgress))->toBeFalse()
            ->and(leadExists($fresh))->toBeTrue();
    });

    it('não aplica o prazo curto da oração aos outros tipos', function () {
        $contact = leadAged('CONTATO', 'CONCLUIDO', 120, 100);

        Artisan::call('pibls:retention:purge');

        expect(leadExists($contact))->toBeTrue();
    });

    it('apaga o histórico de atendimento em cascata, junto com o contato', function () {
        $expired = leadAged('CONTATO', 'CONCLUIDO', 14, 13, months: true);
        $kept = leadAged('CONTATO', 'CONCLUIDO', 14, 11, months: true);
        LeadActivity::factory()->count(3)->create(['lead_id' => $expired->getKey()]);
        LeadActivity::factory()->count(2)->create(['lead_id' => $kept->getKey()]);

        Artisan::call('pibls:retention:purge');

        expect(DB::table('lead_activities')->where('lead_id', $expired->getKey())->count())->toBe(0)
            ->and(DB::table('lead_activities')->where('lead_id', $kept->getKey())->count())->toBe(2);
    });
});

describe('inscrições em eventos', function () {
    function registrationFor(array $event): EventRegistration
    {
        $event = Event::factory()->create($event);

        return EventRegistration::factory()->create(['event_id' => $event->getKey()]);
    }

    function registrationExists(EventRegistration $registration): bool
    {
        return DB::table('event_registrations')->where('id', $registration->getKey())->exists();
    }

    it('BR-080 conta 3 meses depois do término do evento', function () {
        $expired = registrationFor(['starts_at' => now()->subMonths(5), 'ends_at' => now()->subMonths(3)->subDay()]);
        $kept = registrationFor(['starts_at' => now()->subMonths(5), 'ends_at' => now()->subMonths(3)->addDay()]);

        Artisan::call('pibls:retention:purge');

        expect(registrationExists($expired))->toBeFalse()->and(registrationExists($kept))->toBeTrue();
    });

    it('BR-080 usa o início quando o evento não tem término', function () {
        $expired = registrationFor(['starts_at' => now()->subMonths(3)->subDays(2), 'ends_at' => null]);
        $kept = registrationFor(['starts_at' => now()->subMonths(2), 'ends_at' => null]);
        $future = registrationFor(['starts_at' => now()->addMonth(), 'ends_at' => null]);

        Artisan::call('pibls:retention:purge');

        expect(registrationExists($expired))->toBeFalse()
            ->and(registrationExists($kept))->toBeTrue()
            ->and(registrationExists($future))->toBeTrue();
    });

    it('mantém o evento, só apaga as inscrições', function () {
        $registration = registrationFor(['starts_at' => now()->subMonths(8), 'ends_at' => now()->subMonths(8)]);

        Artisan::call('pibls:retention:purge');

        expect(registrationExists($registration))->toBeFalse()
            ->and(DB::table('events')->where('id', $registration->event_id)->exists())->toBeTrue();
    });
});

describe('fila e auditoria', function () {
    function failedJob(int $daysAgo): void
    {
        DB::table('failed_jobs')->insert([
            'uuid' => (string) Str::uuid(),
            'connection' => 'database',
            'queue' => 'default',
            'payload' => '{}',
            'exception' => 'x',
            'failed_at' => now()->subDays($daysAgo),
        ]);
    }

    it('exclui failed_jobs com mais de 30 dias e mantém os mais novos', function () {
        failedJob(31);
        failedJob(29);

        Artisan::call('pibls:retention:purge');

        expect(DB::table('failed_jobs')->count())->toBe(1);
    });

    it('pibls:audit:prune exclui a auditoria com mais de 24 meses e mantém o resto', function () {
        AuditLog::query()->create(['occurred_at' => now()->subMonths(25), 'action' => 'setting.updated']);
        AuditLog::query()->create(['occurred_at' => now()->subMonths(23), 'action' => 'setting.updated']);

        $exit = Artisan::call('pibls:audit:prune');

        expect($exit)->toBe(0)
            ->and(AuditLog::query()->where('action', 'setting.updated')->count())->toBe(1);
    });

    it('pibls:audit:prune usa o prazo do .env (RETENTION_AUDIT_MONTHS)', function () {
        config(['pibls.retention.audit_months' => 6]);
        AuditLog::query()->create(['occurred_at' => now()->subMonths(7), 'action' => 'pix.updated']);
        AuditLog::query()->create(['occurred_at' => now()->subMonths(5), 'action' => 'pix.updated']);

        Artisan::call('pibls:audit:prune');

        expect(AuditLog::query()->where('action', 'pix.updated')->count())->toBe(1);
    });
});

describe('auditoria e heartbeat do expurgo', function () {
    it('registra em audit_logs (retention.purged) só as quantidades, sem dado pessoal', function () {
        leadAged('ORACAO', 'CONCLUIDO', 200, 61);
        leadAged('ORACAO', 'NOVO', 120);
        leadAged('VISITANTE', 'CONCLUIDO', 14, 13, months: true);
        registrationFor(['starts_at' => now()->subMonths(8), 'ends_at' => now()->subMonths(8)]);
        failedJob(40);

        Artisan::call('pibls:retention:purge');

        $log = AuditLog::query()->where('action', 'retention.purged')->sole();
        expect($log->actor_user_id)->toBeNull()
            ->and($log->changes)->toMatchArray(['leads' => 3, 'registrations' => 1, 'failed_jobs' => 1])->toHaveCount(3) // o JSON do MySQL reordena as chaves
            ->and(json_encode($log->changes))->not->toMatch('/@|\+55|\d{8,}/');
    });

    it('não grava auditoria quando não há nada para excluir', function () {
        leadAged('CONTATO', 'NOVO', 3);

        Artisan::call('pibls:retention:purge');

        expect(AuditLog::query()->where('action', 'retention.purged')->count())->toBe(0);
    });

    it('é idempotente: rodar de novo no mesmo dia não exclui mais nada', function () {
        leadAged('ORACAO', 'CONCLUIDO', 200, 61);
        Artisan::call('pibls:retention:purge');
        Artisan::call('pibls:retention:purge');

        expect(AuditLog::query()->where('action', 'retention.purged')->count())->toBe(1);
    });

    it('os prazos vêm do .env: encurtar o prazo exclui mais', function () {
        $contact = leadAged('CONTATO', 'CONCLUIDO', 130, 100);
        config(['pibls.retention.leads_months' => 3]);

        Artisan::call('pibls:retention:purge');

        expect(leadExists($contact))->toBeFalse();
    });

    it('avisa o Healthchecks no sucesso', function () {
        Artisan::call('pibls:retention:purge');

        Http::assertSent(fn ($request) => $request->url() === 'https://hc-ping.com/purge-check');
    });

    it('avisa o Healthchecks com /fail e sai com 1 quando a exclusão falha', function () {
        $this->mock(RetentionPurger::class, fn ($mock) => $mock->shouldReceive('purge')->andThrow(new RuntimeException('banco fora')));

        $exit = Artisan::call('pibls:retention:purge');

        expect($exit)->toBe(1);
        Http::assertSent(fn ($request) => $request->url() === 'https://hc-ping.com/purge-check/fail');
    });
});
