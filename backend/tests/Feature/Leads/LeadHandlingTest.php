<?php

declare(strict_types=1);

use App\Modules\Access\Models\User;
use App\Modules\Leads\Enums\LeadStatus;
use App\Modules\Leads\Events\LeadErased;
use App\Modules\Leads\Models\Lead;
use App\Modules\Leads\Models\LeadActivity;
use App\Modules\Platform\Models\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

/*
| O atendimento dos contatos (architecture.md → CAP-10 e CAP-11): PATCH, assignees e DELETE. BR-008 (transições), BR-009
| (responsável), BR-012 (responsável inativo), BR-013 (anotação) e BR-081 (exclusão a pedido do titular).
*/

// ───────────────────────────── BR-008: transições ─────────────────────────────

it('BR-008 a máquina de estados tem só as cinco transições da tabela', function (string $from, string $to, bool $allowed) {
    expect(LeadStatus::from($from)->canTransitionTo(LeadStatus::from($to)))->toBe($allowed);
})->with([
    'NOVO → EM_ATENDIMENTO' => ['NOVO', 'EM_ATENDIMENTO', true],
    'NOVO → CONCLUIDO' => ['NOVO', 'CONCLUIDO', true],
    'EM_ATENDIMENTO → CONCLUIDO' => ['EM_ATENDIMENTO', 'CONCLUIDO', true],
    'EM_ATENDIMENTO → NOVO' => ['EM_ATENDIMENTO', 'NOVO', true],
    'CONCLUIDO → EM_ATENDIMENTO' => ['CONCLUIDO', 'EM_ATENDIMENTO', true],
    'NOVO → NOVO' => ['NOVO', 'NOVO', false],
    'EM_ATENDIMENTO → EM_ATENDIMENTO' => ['EM_ATENDIMENTO', 'EM_ATENDIMENTO', false],
    'CONCLUIDO → NOVO' => ['CONCLUIDO', 'NOVO', false],
    'CONCLUIDO → CONCLUIDO' => ['CONCLUIDO', 'CONCLUIDO', false],
]);

it('BR-008 recusa as demais transições com 409 e não muda nada', function (string $from, string $to) {
    $lead = Lead::factory()->create(['status' => $from, 'assigned_to' => $from === 'EM_ATENDIMENTO' ? User::factory()->create()->id : null]);
    asStaff('SECRETARIA');

    $this->patchJson("/api/admin/leads/{$lead->id}", ['status' => $to])
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'INVALID_STATUS_TRANSITION')
        ->assertJsonPath('error.message', 'Mudança de status não permitida.');

    expect($lead->refresh()->status)->toBe($from)
        ->and(LeadActivity::query()->count())->toBe(0);
})->with([
    ['NOVO', 'NOVO'],
    ['EM_ATENDIMENTO', 'EM_ATENDIMENTO'],
    ['CONCLUIDO', 'NOVO'],
    ['CONCLUIDO', 'CONCLUIDO'],
]);

it('BR-008 as transições permitidas funcionam e gravam o histórico', function (string $from, string $to) {
    $secretary = asStaff('SECRETARIA');
    $lead = Lead::factory()->create([
        'status' => $from,
        'assigned_to' => $from === 'EM_ATENDIMENTO' ? $secretary->id : null,
    ]);

    $this->patchJson("/api/admin/leads/{$lead->id}", ['status' => $to])
        ->assertOk()
        ->assertJsonPath('data.status', $to);

    $activity = LeadActivity::query()->sole();
    expect($activity->lead_id)->toBe($lead->id)
        ->and($activity->actor_user_id)->toBe($secretary->id)
        ->and($activity->from_status)->toBe($from)
        ->and($activity->to_status)->toBe($to);
})->with([
    ['NOVO', 'EM_ATENDIMENTO'],
    ['NOVO', 'CONCLUIDO'],
    ['EM_ATENDIMENTO', 'CONCLUIDO'],
    ['EM_ATENDIMENTO', 'NOVO'],
    ['CONCLUIDO', 'EM_ATENDIMENTO'],
]);

it('o status_changed_at (base da retenção) muda com o status, mas não com uma anotação', function () {
    $secretary = asStaff('SECRETARIA');
    $before = now()->subDays(10)->startOfSecond();
    $lead = Lead::factory()->create(['status_changed_at' => $before]);

    $this->patchJson("/api/admin/leads/{$lead->id}", ['note' => 'Só uma anotação.'])->assertOk();
    expect($lead->refresh()->status_changed_at->equalTo($before))->toBeTrue();

    $this->patchJson("/api/admin/leads/{$lead->id}", ['status' => 'EM_ATENDIMENTO', 'assigned_to' => $secretary->id])->assertOk();
    expect($lead->refresh()->status_changed_at->greaterThan($before->addDays(9)))->toBeTrue();
});

// ───────────────────────────── BR-009: responsável ─────────────────────────────

it('BR-009 ao entrar em atendimento sem informar o responsável, é quem está atendendo', function () {
    $secretary = asStaff('SECRETARIA');
    $lead = Lead::factory()->create();

    $this->patchJson("/api/admin/leads/{$lead->id}", ['status' => 'EM_ATENDIMENTO'])
        ->assertOk()
        ->assertJsonPath('data.assigned_to.id', $secretary->id);

    expect($lead->refresh()->assigned_to)->toBe($secretary->id)
        ->and(LeadActivity::query()->sole()->assigned_to)->toBe($secretary->id);
});

it('BR-009 aceita outro operador ativo com a gestão do tipo como responsável', function () {
    asStaff('SECRETARIA');
    $colleague = userWithRole('SECRETARIA', ['name' => 'Colega Secretaria']);
    $lead = Lead::factory()->create();

    $this->patchJson("/api/admin/leads/{$lead->id}", ['status' => 'EM_ATENDIMENTO', 'assigned_to' => $colleague->id])
        ->assertOk()
        ->assertJsonPath('data.assigned_to', ['id' => $colleague->id, 'name' => 'Colega Secretaria', 'is_active' => true]);
});

it('BR-009 recusa responsável inativo, sem a gestão do tipo ou que não existe', function (callable $assignee) {
    asStaff('SECRETARIA');
    $lead = Lead::factory()->create();

    $this->patchJson("/api/admin/leads/{$lead->id}", ['status' => 'EM_ATENDIMENTO', 'assigned_to' => value($assignee)])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonPath('error.details.0.field', 'assigned_to')
        ->assertJsonPath('error.details.0.message', 'Escolha um responsável com acesso a este tipo de contato.');

    expect($lead->refresh()->status)->toBe('NOVO')->and(LeadActivity::query()->count())->toBe(0);
})->with([
    'inativo' => fn () => userWithRole('SECRETARIA', ['is_active' => false])->id,
    'só lê (pastoral)' => fn () => userWithRole('PASTORAL')->id,
    'outra permissão (oração)' => fn () => userWithRole('ORACAO')->id,
    'sem permissão' => fn () => User::factory()->create()->id,
    'inexistente' => fn () => 999999,
]);

it('BR-009 o responsável de um pedido de oração precisa da gestão da oração', function () {
    asStaff('ORACAO');
    $secretary = userWithRole('SECRETARIA');
    $prayerTeam = userWithRole('ORACAO');
    $prayer = Lead::factory()->oracao()->create();

    $this->patchJson("/api/admin/leads/{$prayer->id}", ['status' => 'EM_ATENDIMENTO', 'assigned_to' => $secretary->id])
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'assigned_to');

    $this->patchJson("/api/admin/leads/{$prayer->id}", ['status' => 'EM_ATENDIMENTO', 'assigned_to' => $prayerTeam->id])
        ->assertOk()
        ->assertJsonPath('data.assigned_to.id', $prayerTeam->id);
});

it('BR-009 em atendimento exige responsável: assigned_to nulo é recusado', function () {
    asStaff('SECRETARIA');
    $lead = Lead::factory()->create();

    $this->patchJson("/api/admin/leads/{$lead->id}", ['status' => 'EM_ATENDIMENTO', 'assigned_to' => null])
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'assigned_to');
});

it('BR-009 voltar a NOVO remove o responsável', function () {
    $secretary = asStaff('SECRETARIA');
    $lead = Lead::factory()->create(['status' => 'EM_ATENDIMENTO', 'assigned_to' => $secretary->id]);

    $this->patchJson("/api/admin/leads/{$lead->id}", ['status' => 'NOVO'])
        ->assertOk()
        ->assertJsonPath('data.assigned_to', null);

    $activity = LeadActivity::query()->sole();
    expect($lead->refresh()->assigned_to)->toBeNull()
        ->and($activity->assigned_to)->toBeNull()
        ->and([$activity->from_status, $activity->to_status])->toBe(['EM_ATENDIMENTO', 'NOVO']);
});

it('BR-009 não se indica responsável para um contato que volta ou fica em NOVO', function () {
    $secretary = asStaff('SECRETARIA');
    $lead = Lead::factory()->create();

    $this->patchJson("/api/admin/leads/{$lead->id}", ['assigned_to' => $secretary->id])
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'assigned_to')
        ->assertJsonPath('error.details.0.message', 'O responsável só vale para contatos em atendimento.');
});

it('reabrir um contato concluído leva a quem reabriu, e concluir mantém o responsável', function () {
    $secretary = asStaff('SECRETARIA');
    $colleague = userWithRole('SECRETARIA');
    $lead = Lead::factory()->create(['status' => 'EM_ATENDIMENTO', 'assigned_to' => $colleague->id]);

    $this->patchJson("/api/admin/leads/{$lead->id}", ['status' => 'CONCLUIDO'])
        ->assertOk()
        ->assertJsonPath('data.assigned_to.id', $colleague->id);

    $this->patchJson("/api/admin/leads/{$lead->id}", ['status' => 'EM_ATENDIMENTO'])
        ->assertOk()
        ->assertJsonPath('data.assigned_to.id', $secretary->id);
});

it('trocar o responsável de um contato em atendimento registra no histórico', function () {
    $secretary = asStaff('SECRETARIA');
    $colleague = userWithRole('SECRETARIA');
    $lead = Lead::factory()->create(['status' => 'EM_ATENDIMENTO', 'assigned_to' => $secretary->id]);

    $this->patchJson("/api/admin/leads/{$lead->id}", ['assigned_to' => $colleague->id])
        ->assertOk()
        ->assertJsonPath('data.assigned_to.id', $colleague->id);

    $activity = LeadActivity::query()->sole();
    expect([$activity->from_status, $activity->to_status])->toBe([null, null])
        ->and($activity->assigned_to)->toBe($colleague->id);
});

it('BR-012 o responsável desativado continua atribuído e pode ser trocado', function () {
    asStaff('SECRETARIA');
    $gone = User::factory()->inactive()->create();
    $colleague = userWithRole('SECRETARIA');
    $lead = Lead::factory()->create(['status' => 'EM_ATENDIMENTO', 'assigned_to' => $gone->id]);

    // Uma anotação não mexe no responsável, mesmo inativo
    $this->patchJson("/api/admin/leads/{$lead->id}", ['note' => 'Retomando o caso.'])
        ->assertOk()
        ->assertJsonPath('data.assigned_to.id', $gone->id)
        ->assertJsonPath('data.assigned_to.is_active', false);

    $this->patchJson("/api/admin/leads/{$lead->id}", ['assigned_to' => $colleague->id])
        ->assertOk()
        ->assertJsonPath('data.assigned_to.id', $colleague->id);
});

// ───────────────────────────── BR-013: anotação ─────────────────────────────

it('BR-013 aceita anotação de até 1.000 caracteres, com ou sem mudança de status', function () {
    asStaff('SECRETARIA');
    $lead = Lead::factory()->create();

    $this->patchJson("/api/admin/leads/{$lead->id}", ['note' => str_repeat('a', 1000)])->assertOk();
    $this->patchJson("/api/admin/leads/{$lead->id}", ['status' => 'CONCLUIDO', 'note' => 'Resolvido por telefone.'])->assertOk();

    $activities = LeadActivity::query()->orderBy('id')->get();
    expect($activities)->toHaveCount(2)
        ->and($activities[0]->note)->toBe(str_repeat('a', 1000))
        ->and([$activities[0]->from_status, $activities[0]->to_status])->toBe([null, null])
        ->and($activities[1]->note)->toBe('Resolvido por telefone.')
        ->and($activities[1]->to_status)->toBe('CONCLUIDO');
});

it('BR-013 recusa anotação de mais de 1.000 caracteres', function () {
    asStaff('SECRETARIA');
    $lead = Lead::factory()->create();

    $this->patchJson("/api/admin/leads/{$lead->id}", ['note' => str_repeat('a', 1001)])
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'note')
        ->assertJsonPath('error.details.0.message', 'A anotação pode ter no máximo 1.000 caracteres.');

    expect(LeadActivity::query()->count())->toBe(0);
});

it('a anotação é gravada cifrada, e o histórico a devolve decifrada', function () {
    asStaff('SECRETARIA');
    $lead = Lead::factory()->create();

    $this->patchJson("/api/admin/leads/{$lead->id}", ['note' => 'Anotação sigilosa do atendimento'])
        ->assertOk()
        ->assertJsonPath('data.activities.0.note', 'Anotação sigilosa do atendimento');

    $raw = (string) DB::table('lead_activities')->value('note');
    expect($raw)->not->toContain('sigilosa')->and(strlen($raw))->toBeGreaterThan(40);
});

it('uma anotação só de espaços, sem mais nada, não é uma mudança', function () {
    asStaff('SECRETARIA');
    $lead = Lead::factory()->create();

    $this->patchJson("/api/admin/leads/{$lead->id}", ['note' => '   '])->assertStatus(422);
    $this->patchJson("/api/admin/leads/{$lead->id}", [])->assertStatus(422);

    expect(LeadActivity::query()->count())->toBe(0);
});

it('o PATCH devolve o contato inteiro, com o histórico atualizado', function () {
    $secretary = asStaff('SECRETARIA');
    $lead = Lead::factory()->visitante()->create(['name' => 'Maria Souza', 'message' => 'Mensagem original']);

    $response = $this->patchJson("/api/admin/leads/{$lead->id}", ['status' => 'EM_ATENDIMENTO', 'note' => 'Liguei.'])->assertOk();

    expect($response->json('data'))->toMatchArray(['name' => 'Maria Souza', 'message' => 'Mensagem original', 'status' => 'EM_ATENDIMENTO'])
        ->and($response->json('data.activities.0'))->toMatchArray([
            'actor' => ['id' => $secretary->id, 'name' => $secretary->name],
            'from_status' => 'NOVO',
            'to_status' => 'EM_ATENDIMENTO',
            'note' => 'Liguei.',
        ]);
});

it('valida o corpo do PATCH', function (array $body, string $field) {
    asStaff('SECRETARIA');
    $lead = Lead::factory()->create();

    $this->patchJson("/api/admin/leads/{$lead->id}", $body)->assertStatus(422)->assertJsonPath('error.details.0.field', $field);
})->with([
    'status desconhecido' => [['status' => 'ARQUIVADO'], 'status'],
    'responsável não numérico' => [['assigned_to' => 'ana'], 'assigned_to'],
    'anotação não é texto' => [['note' => ['a']], 'note'],
]);

it('a permissão vem antes da validação: quem só lê recebe 403 e quem não vê o tipo, 404, mesmo com corpo inválido', function () {
    $visitor = Lead::factory()->visitante()->create();
    $prayer = Lead::factory()->oracao()->create();

    asStaff('PASTORAL');
    $this->patchJson("/api/admin/leads/{$visitor->id}", ['status' => 'ARQUIVADO'])->assertForbidden();
    $this->patchJson("/api/admin/leads/{$prayer->id}", ['status' => 'ARQUIVADO'])->assertForbidden();

    asStaff('SECRETARIA');
    $this->patchJson("/api/admin/leads/{$prayer->id}", ['status' => 'ARQUIVADO'])->assertNotFound();
});

// ───────────────────────────── Auditoria ─────────────────────────────

it('audita a mudança de status e de responsável, sem dado pessoal', function () {
    $secretary = asStaff('SECRETARIA');
    $lead = Lead::factory()->visitante()->create(['name' => 'Maria Sigilosa', 'phone' => '+5531999991234']);

    $this->patchJson("/api/admin/leads/{$lead->id}", ['status' => 'EM_ATENDIMENTO', 'note' => 'Falei com Maria Sigilosa.'])->assertOk();

    $actions = AuditLog::query()->orderBy('id')->pluck('action')->all();
    expect($actions)->toBe(['lead.status_changed', 'lead.assigned']);

    $status = AuditLog::query()->where('action', 'lead.status_changed')->sole();
    expect($status->actor_user_id)->toBe($secretary->id)
        ->and($status->resource_id)->toBe((string) $lead->id)
        ->and($status->changes)->toEqual(['type' => 'VISITANTE', 'from' => 'NOVO', 'to' => 'EM_ATENDIMENTO']);

    $dump = AuditLog::query()->get()->toJson();
    expect($dump)->not->toContain('Sigilosa')->and($dump)->not->toContain('5531999991234')->and($dump)->not->toContain('Falei');
});

it('uma simples anotação não gera auditoria de status nem de responsável', function () {
    asStaff('SECRETARIA');
    $lead = Lead::factory()->create();

    $this->patchJson("/api/admin/leads/{$lead->id}", ['note' => 'Só uma anotação.'])->assertOk();

    expect(AuditLog::query()->count())->toBe(0);
});

// ───────────────────────────── GET /assignees ─────────────────────────────

it('BR-009 lista os usuários ativos com a gestão do tipo, por nome', function () {
    userWithRole('SECRETARIA', ['name' => 'Zeca Secretaria']);
    userWithRole('SECRETARIA', ['name' => 'Beto Secretaria', 'is_active' => false]);
    userWithRole('PASTORAL', ['name' => 'Pastor Só Lê']);
    userWithRole('ORACAO', ['name' => 'Equipe de Oração']);
    asStaff('SECRETARIA', ['name' => 'Ana Secretaria']);

    $names = fn (string $type) => array_column($this->getJson("/api/admin/leads/assignees?type={$type}")->assertOk()->json('data'), 'name');

    expect($names('CONTATO'))->toBe(['Ana Secretaria', 'Zeca Secretaria']);
});

it('a lista de responsáveis da oração traz só a equipe de oração', function () {
    userWithRole('SECRETARIA', ['name' => 'Secretaria']);
    userWithRole('ORACAO', ['name' => 'Beatriz Oração']);
    asStaff('ORACAO', ['name' => 'Ana Oração']);

    $names = array_column($this->getJson('/api/admin/leads/assignees?type=ORACAO')->assertOk()->json('data'), 'name');

    expect($names)->toBe(['Ana Oração', 'Beatriz Oração']);
});

it('a lista de responsáveis traz só id e nome', function () {
    asStaff('SECRETARIA');

    $item = $this->getJson('/api/admin/leads/assignees?type=VISITANTE')->assertOk()->json('data.0');

    expect(array_keys($item))->toBe(['id', 'name']);
});

it('a lista de responsáveis exige o tipo e a gestão dele', function () {
    asStaff('SECRETARIA');
    $this->getJson('/api/admin/leads/assignees')->assertStatus(422)->assertJsonPath('error.details.0.field', 'type');
    $this->getJson('/api/admin/leads/assignees?type=OUTRO')->assertStatus(422);
    $this->getJson('/api/admin/leads/assignees?type=ORACAO')->assertForbidden();

    asStaff('PASTORAL');
    $this->getJson('/api/admin/leads/assignees?type=CONTATO')->assertForbidden();
});

// ───────────────────────────── DELETE: BR-081 ─────────────────────────────

it('BR-081 exclui o contato em definitivo e apaga o histórico em cascata', function () {
    $secretary = asStaff('SECRETARIA');
    $lead = Lead::factory()->visitante()->create(['name' => 'Maria Titular', 'phone' => '+5531999995555']);
    LeadActivity::factory()->count(2)->create(['lead_id' => $lead->id, 'actor_user_id' => $secretary->id]);
    $other = Lead::factory()->create();

    $this->deleteJson("/api/admin/leads/{$lead->id}", ['reason' => 'TITULAR_REQUEST'])->assertNoContent();

    expect(Lead::query()->whereKey($lead->id)->exists())->toBeFalse()
        ->and(LeadActivity::query()->where('lead_id', $lead->id)->count())->toBe(0)
        ->and(Lead::query()->whereKey($other->id)->exists())->toBeTrue();
    $this->getJson("/api/admin/leads/{$lead->id}")->assertNotFound();
    $this->deleteJson("/api/admin/leads/{$lead->id}", ['reason' => 'TITULAR_REQUEST'])->assertNotFound();
});

it('BR-081 a auditoria registra lead.erased com o tipo, o motivo e quem excluiu, sem dado pessoal', function () {
    $secretary = asStaff('SECRETARIA');
    $lead = Lead::factory()->visitante()->create(['name' => 'Maria Titular', 'phone' => '+5531999995555', 'email' => 'maria@example.com', 'message' => 'Texto da mensagem']);

    $this->deleteJson("/api/admin/leads/{$lead->id}", ['reason' => 'TITULAR_REQUEST'])->assertNoContent();

    $log = AuditLog::query()->where('action', 'lead.erased')->sole();
    expect($log->actor_user_id)->toBe($secretary->id)
        ->and($log->resource_type)->toBe('lead')
        ->and($log->resource_id)->toBe((string) $lead->id)
        ->and($log->changes)->toEqual(['type' => 'VISITANTE', 'reason' => 'TITULAR_REQUEST']);

    $dump = AuditLog::query()->get()->toJson();
    foreach (['Maria Titular', '5531999995555', 'maria@example.com', 'Texto da mensagem'] as $personal) {
        expect($dump)->not->toContain($personal);
    }
});

it('BR-081 a exclusão exige o motivo do pedido do titular', function (array $body) {
    asStaff('SECRETARIA');
    $lead = Lead::factory()->create();

    $this->deleteJson("/api/admin/leads/{$lead->id}", $body)
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'reason');

    expect(Lead::query()->whereKey($lead->id)->exists())->toBeTrue();
})->with([[[]], [['reason' => '']], [['reason' => 'QUALQUER_OUTRO']]]);

it('BR-081 só quem tem a gestão do tipo exclui: a pastoral lê mas não exclui, e o pedido de oração é só da oração', function () {
    $visitor = Lead::factory()->visitante()->create();
    $prayer = Lead::factory()->oracao()->create();
    $body = ['reason' => 'TITULAR_REQUEST'];

    asStaff('PASTORAL');
    $this->deleteJson("/api/admin/leads/{$visitor->id}", $body)->assertForbidden();
    $this->deleteJson("/api/admin/leads/{$prayer->id}", $body)->assertForbidden();

    asStaff('SECRETARIA');
    $this->deleteJson("/api/admin/leads/{$prayer->id}", $body)->assertNotFound();

    asStaff('ORACAO');
    $this->deleteJson("/api/admin/leads/{$visitor->id}", $body)->assertNotFound();
    $this->deleteJson("/api/admin/leads/{$prayer->id}", $body)->assertNoContent();

    expect(Lead::query()->whereKey($visitor->id)->exists())->toBeTrue()
        ->and(Lead::query()->whereKey($prayer->id)->exists())->toBeFalse();
});

it('a exclusão e a auditoria valem juntas: se a auditoria falhar, o contato continua', function () {
    asStaff('SECRETARIA');
    $lead = Lead::factory()->create();
    Event::listen(LeadErased::class, fn () => throw new RuntimeException('falha na auditoria'));
    $this->withoutExceptionHandling();

    expect(fn () => $this->deleteJson("/api/admin/leads/{$lead->id}", ['reason' => 'TITULAR_REQUEST']))
        ->toThrow(RuntimeException::class);

    expect(Lead::query()->whereKey($lead->id)->exists())->toBeTrue();
});
