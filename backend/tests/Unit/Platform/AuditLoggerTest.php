<?php

declare(strict_types=1);

use App\Modules\Access\Models\User;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\Models\AuditLog;
use App\Shared\Http\RequestId;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

// Grava no banco: por isso o `uses` explícito, já que a suíte Unit não traz o framework nem o banco.
uses(TestCase::class, RefreshDatabase::class);

it('grava quem fez, o quê, em qual recurso e as mudanças sem dado pessoal', function () {
    $actor = User::factory()->create();

    $log = app(AuditLogger::class)->record(
        AuditAction::PixUpdated,
        'setting',
        'pix',
        ['before' => ['pix_key' => '20969119000184'], 'after' => ['pix_key' => '20969119000184', 'beneficiary_name' => 'PIBLS']],
        actorUserId: $actor->getKey(),
    );

    $row = DB::table('audit_logs')->where('id', $log->getKey())->first();
    expect($row->action)->toBe('pix.updated')
        ->and($row->actor_user_id)->toBe($actor->getKey())
        ->and($row->resource_type)->toBe('setting')
        ->and($row->resource_id)->toBe('pix')
        ->and(json_decode($row->changes, true))->toEqual([
            'before' => ['pix_key' => '20969119000184'],
            'after' => ['pix_key' => '20969119000184', 'beneficiary_name' => 'PIBLS'],
        ]);
});

it('usa por padrão o usuário autenticado e guarda IP e user agent da requisição', function () {
    $actor = User::factory()->create();
    $this->actingAs($actor);
    $this->app->instance('request', Request::create('/api/x', 'GET', server: [
        'REMOTE_ADDR' => '203.0.113.9', 'HTTP_USER_AGENT' => 'Mozilla/5.0 (teste)',
    ]));

    $log = app(AuditLogger::class)->record(AuditAction::Logout);

    expect($log->actor_user_id)->toBe($actor->getKey())
        ->and($log->ip_address)->toBe('203.0.113.9')
        ->and($log->user_agent)->toBe('Mozilla/5.0 (teste)');
});

it('grava ator nulo quando é o sistema ou um anônimo', function () {
    $log = app(AuditLogger::class)->record(AuditAction::LoginFailed, 'user');

    expect($log->actor_user_id)->toBeNull()->and($log->resource_id)->toBeNull();
});

it('trunca o user agent em 255 caracteres', function () {
    $this->app->instance('request', Request::create('/', 'GET', server: ['HTTP_USER_AGENT' => str_repeat('x', 400)]));

    $log = app(AuditLogger::class)->record(AuditAction::Logout);

    expect($log->user_agent)->toHaveLength(255);
});

it('grava o correlation ID da requisição', function () {
    Context::add(RequestId::CONTEXT_KEY, '01JC8Z3K7Q2W9V5T4N6M8B1X0Y');

    $log = app(AuditLogger::class)->record(AuditAction::Logout);

    expect($log->correlation_id)->toBe('01JC8Z3K7Q2W9V5T4N6M8B1X0Y');
});

it('grava o momento em UTC com milissegundos', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-22 13:00:00.123456', 'UTC'));

    $log = app(AuditLogger::class)->record(AuditAction::ReleaseActivated, 'release', '2026.11.3');

    expect(DB::table('audit_logs')->where('id', $log->getKey())->value('occurred_at'))->toBe('2026-10-22 13:00:00.123');
});

it('grava changes nulo quando não há mudanças', function () {
    $log = app(AuditLogger::class)->record(AuditAction::Logout);

    expect(DB::table('audit_logs')->where('id', $log->getKey())->value('changes'))->toBeNull();
});

it('proíbe dado pessoal em changes: em local e no CI lança exceção e não grava', function (array $changes) {
    $before = AuditLog::query()->count();

    expect(fn () => app(AuditLogger::class)->record(AuditAction::LeadStatusChanged, 'lead', 7, $changes))
        ->toThrow(LogicException::class, 'dado pessoal');

    expect(AuditLog::query()->count())->toBe($before);
})->with([
    'telefone' => [['after' => ['phone' => '(31) 99999-8888']]],
    'e-mail' => [['after' => ['email' => 'maria@exemplo.com']]],
    'nome do titular' => [['before' => ['name' => 'Maria da Silva']]],
    'texto do contato' => [['after' => ['message' => 'Peço oração pela minha família']]],
    'anotação' => [['after' => ['note' => 'Ligar à noite']]],
    'endereço residencial' => [['after' => ['private_address' => 'Rua das Flores, 123']]],
    'telefone solto num texto' => [['after' => ['detail' => 'Falar com 31 99999-8888']]],
    'e-mail solto num texto' => [['after' => ['detail' => 'Enviar para maria@exemplo.com']]],
    'dado pessoal aninhado' => [['after' => ['items' => [['guardian_phone' => '31999998888']]]]],
]);

it('em produção grava a auditoria já sem o dado pessoal e registra o erro no log', function () {
    $this->app->detectEnvironment(fn () => 'production');
    Log::spy();

    $log = app(AuditLogger::class)->record(AuditAction::LeadStatusChanged, 'lead', 7, [
        'before' => ['status' => 'NOVO', 'phone' => '31999998888'],
        'after' => ['status' => 'CONCLUIDO', 'detail' => 'ligar para maria@exemplo.com'],
    ]);

    $stored = DB::table('audit_logs')->where('id', $log->getKey())->value('changes');
    expect($stored)->not->toContain('31999998888')->not->toContain('maria@exemplo.com')
        ->and(json_decode((string) $stored, true))->toEqual([
            'before' => ['status' => 'NOVO', 'phone' => '[removido]'],
            'after' => ['status' => 'CONCLUIDO', 'detail' => 'ligar para [e-mail]'],
        ]);
    Log::shouldHaveReceived('error')->with('audit.personal_data_removed', ['action' => 'lead.status_changed'])->once();
});

it('cobre todas as ações auditadas de Security → Audit logs', function () {
    $expected = [
        'auth.login_succeeded', 'auth.login_failed', 'auth.logout', 'auth.password_reset_requested',
        'auth.password_changed', 'lead.status_changed', 'lead.assigned', 'lead.erased', 'bulletin.created',
        'bulletin.updated', 'bulletin.pdf_replaced', 'bulletin.deleted', 'palavra_viva.created',
        'palavra_viva.updated', 'palavra_viva.deleted', 'event.created', 'event.updated', 'event.published',
        'event.unpublished', 'event.deleted', 'registration.cancelled', 'registration.erased',
        'registrations.exported', 'ministry.created', 'ministry.updated', 'ministry.deleted', 'setting.updated',
        'pix.updated', 'retention.purged', 'release.activated', 'release.rolled_back',
    ];

    expect(array_map(fn (AuditAction $a) => $a->value, AuditAction::cases()))->toEqualCanonicalizing($expected);
});
