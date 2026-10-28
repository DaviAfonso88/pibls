<?php

declare(strict_types=1);

use App\Modules\Access\Models\User;
use App\Modules\Leads\Models\Lead;
use App\Modules\Leads\Models\LeadActivity;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

/*
| As caixas de contatos do painel (architecture.md → CAP-10 e CAP-11; GET /api/admin/leads e /api/admin/leads/{id}).
| BR-007: o pedido de oração tem caixa e permissão próprias e nunca aparece na caixa geral.
*/

/** @return list<int> ids da resposta, na ordem */
function listedIds(TestResponse $response): array
{
    return array_map(intval(...), array_column($response->json('data'), 'id'));
}

// ───────────────────────────── Quem vê qual caixa (BR-007) ─────────────────────────────

it('BR-007 a caixa geral traz os quatro tipos gerais e nunca o pedido de oração', function () {
    $visitor = Lead::factory()->visitante()->create();
    $member = Lead::factory()->membro()->create();
    $contact = Lead::factory()->create();
    $ministry = Lead::factory()->ministerio()->create();
    Lead::factory()->oracao()->create();
    asStaff('SECRETARIA');

    $ids = listedIds($this->getJson('/api/admin/leads?inbox=geral')->assertOk());

    expect($ids)->toEqualCanonicalizing([$visitor->id, $member->id, $contact->id, $ministry->id]);
});

it('BR-007 a caixa de oração traz só pedidos de oração', function () {
    Lead::factory()->visitante()->create();
    Lead::factory()->create();
    $prayers = Lead::factory()->oracao()->count(2)->create();
    asStaff('ORACAO');

    $ids = listedIds($this->getJson('/api/admin/leads?inbox=oracao')->assertOk());

    expect($ids)->toEqualCanonicalizing($prayers->pluck('id')->all());
});

it('BR-007 quem lê só a caixa geral não abre a de oração, e vice-versa (403)', function (string $role, string $inbox) {
    asStaff($role);

    $this->getJson("/api/admin/leads?inbox={$inbox}")
        ->assertForbidden()
        ->assertJsonPath('error.code', 'FORBIDDEN');
})->with([
    'secretaria na oração' => ['SECRETARIA', 'oracao'],
    'oração na geral' => ['ORACAO', 'geral'],
    'comunicação na geral' => ['COMUNICACAO', 'geral'],
    'comunicação na oração' => ['COMUNICACAO', 'oracao'],
    'tesouraria na geral' => ['TESOURARIA', 'geral'],
    'líder na geral' => ['LIDER_MINISTERIO', 'geral'],
]);

it('a pastoral lê as duas caixas', function () {
    Lead::factory()->visitante()->create();
    Lead::factory()->oracao()->create();
    asStaff('PASTORAL');

    expect($this->getJson('/api/admin/leads?inbox=geral')->assertOk()->json('meta.total'))->toBe(1)
        ->and($this->getJson('/api/admin/leads?inbox=oracao')->assertOk()->json('meta.total'))->toBe(1);
});

it('BR-007 o detalhe de um pedido de oração é 404 para quem só tem leads.read, mesmo sabendo o id', function () {
    $prayer = Lead::factory()->oracao()->create();
    asStaff('SECRETARIA');

    $this->getJson("/api/admin/leads/{$prayer->id}")
        ->assertNotFound()
        ->assertJsonPath('error.code', 'NOT_FOUND')
        ->assertJsonPath('error.message', 'Não encontramos o que você procurou.');
});

it('BR-007 e o detalhe de um contato geral é 404 para quem só tem leads.oracao.read', function () {
    $visitor = Lead::factory()->visitante()->create();
    asStaff('ORACAO');

    $this->getJson("/api/admin/leads/{$visitor->id}")->assertNotFound();
});

it('o 404 de "sem permissão" é igual ao de "não existe" (não revela o pedido de oração)', function () {
    $prayer = Lead::factory()->oracao()->create();
    asStaff('SECRETARIA');

    $denied = $this->getJson("/api/admin/leads/{$prayer->id}")->json();
    $missing = $this->getJson('/api/admin/leads/999999')->json();
    unset($denied['error']['traceId'], $missing['error']['traceId']);

    expect($denied)->toBe($missing);
});

it('BR-007 o pedido de oração não vaza pela busca da caixa geral', function () {
    Lead::factory()->oracao()->create(['message' => 'Frase única do pedido sigiloso']);
    asStaff('SECRETARIA');

    $this->getJson('/api/admin/leads?inbox=geral&q=sigiloso')->assertOk()->assertJsonPath('meta.total', 0);
});

// ───────────────────────────── A lista ─────────────────────────────

it('a lista mostra tipo, nome (ou nulo para anônimo), telefone, data, status e responsável, e nunca a mensagem', function () {
    $assignee = User::factory()->create(['name' => 'Ana Atendente']);
    Lead::factory()->visitante()->create([
        'name' => 'Maria Souza', 'phone' => '+5531999998888', 'status' => 'EM_ATENDIMENTO', 'assigned_to' => $assignee->id,
    ]);
    asStaff('SECRETARIA');

    $response = $this->getJson('/api/admin/leads?inbox=geral')->assertOk();

    $item = $response->json('data.0');
    expect(array_keys($item))->toBe(['id', 'type', 'status', 'name', 'phone', 'created_at', 'waiting_days', 'assigned_to'])
        ->and($item)->toMatchArray([
            'type' => 'VISITANTE',
            'status' => 'EM_ATENDIMENTO',
            'name' => 'Maria Souza',
            'phone' => '+5531999998888',
            'waiting_days' => null,
            'assigned_to' => ['id' => $assignee->id, 'name' => 'Ana Atendente', 'is_active' => true],
        ])
        ->and($item['created_at'])->toEndWith('Z');
    expect($response->getContent())->not->toContain('message');
});

it('pedido anônimo vem com nome e telefone nulos', function () {
    Lead::factory()->oracao()->create();
    asStaff('ORACAO');

    $this->getJson('/api/admin/leads?inbox=oracao')
        ->assertOk()
        ->assertJsonPath('data.0.name', null)
        ->assertJsonPath('data.0.phone', null);
});

it('ordena do mais novo para o mais antigo por padrão e aceita created_at crescente', function () {
    $old = Lead::factory()->create(['created_at' => now()->subDays(2)]);
    $new = Lead::factory()->create(['created_at' => now()->subHour()]);
    $middle = Lead::factory()->create(['created_at' => now()->subDay()]);
    asStaff('SECRETARIA');

    expect(listedIds($this->getJson('/api/admin/leads?inbox=geral')))->toBe([$new->id, $middle->id, $old->id])
        ->and(listedIds($this->getJson('/api/admin/leads?inbox=geral&sort=-created_at')))->toBe([$new->id, $middle->id, $old->id])
        ->and(listedIds($this->getJson('/api/admin/leads?inbox=geral&sort=created_at')))->toBe([$old->id, $middle->id, $new->id]);
});

it('só aceita as ordenações da lista fechada (nunca um nome de coluna da URL)', function (string $sort) {
    asStaff('SECRETARIA');

    $this->getJson('/api/admin/leads?inbox=geral&sort='.urlencode($sort))
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'sort');
})->with(['name', 'phone', '-status', 'id; DROP TABLE leads_messages', 'created_at desc', 'message']);

it('pagina de 25 em 25, com meta, e limita per_page a 100', function () {
    Lead::factory()->count(30)->create();
    asStaff('SECRETARIA');

    $first = $this->getJson('/api/admin/leads?inbox=geral')->assertOk();
    expect($first->json('data'))->toHaveCount(25)
        ->and($first->json('meta'))->toBe(['page' => 1, 'per_page' => 25, 'total' => 30, 'last_page' => 2]);

    expect($this->getJson('/api/admin/leads?inbox=geral&page=2')->json('data'))->toHaveCount(5);
    $this->getJson('/api/admin/leads?inbox=geral&per_page=101')->assertStatus(422)->assertJsonPath('error.details.0.field', 'per_page');
    $this->getJson('/api/admin/leads?inbox=geral&per_page=100')->assertOk();
});

it('exige a caixa e recusa uma caixa que não existe', function (string $query) {
    asStaff('PASTORAL');

    $this->getJson("/api/admin/leads{$query}")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonPath('error.details.0.field', 'inbox');
})->with(['sem inbox' => [''], 'inbox vazio' => ['?inbox='], 'inbox desconhecido' => ['?inbox=todas']]);

// ───────────────────────────── Filtros ─────────────────────────────

it('filtra por tipo na caixa geral, mas o tipo não existe na caixa de oração', function () {
    $visitor = Lead::factory()->visitante()->create();
    Lead::factory()->membro()->create();
    Lead::factory()->oracao()->create();
    asStaff('PASTORAL');

    expect(listedIds($this->getJson('/api/admin/leads?inbox=geral&type=VISITANTE')))->toBe([$visitor->id]);
    $this->getJson('/api/admin/leads?inbox=oracao&type=ORACAO')->assertStatus(422)->assertJsonPath('error.details.0.field', 'type');
    $this->getJson('/api/admin/leads?inbox=geral&type=ORACAO')->assertStatus(422)->assertJsonPath('error.details.0.field', 'type');
});

it('filtra por status', function () {
    Lead::factory()->create(['status' => 'NOVO']);
    $inProgress = Lead::factory()->create(['status' => 'EM_ATENDIMENTO']);
    Lead::factory()->create(['status' => 'CONCLUIDO']);
    asStaff('SECRETARIA');

    expect(listedIds($this->getJson('/api/admin/leads?inbox=geral&status=EM_ATENDIMENTO')))->toBe([$inProgress->id]);
    $this->getJson('/api/admin/leads?inbox=geral&status=ARQUIVADO')->assertStatus(422)->assertJsonPath('error.details.0.field', 'status');
});

it('"ABERTOS" junta novos e em atendimento, e deixa os concluídos de fora', function () {
    $new = Lead::factory()->create(['status' => 'NOVO']);
    $inProgress = Lead::factory()->create(['status' => 'EM_ATENDIMENTO']);
    Lead::factory()->create(['status' => 'CONCLUIDO']);
    asStaff('SECRETARIA');

    expect(listedIds($this->getJson('/api/admin/leads?inbox=geral&status=ABERTOS')))->toEqualCanonicalizing([$new->id, $inProgress->id])
        ->and($this->getJson('/api/admin/leads?inbox=geral')->json('meta.total'))->toBe(3);
});

it('"none" filtra os contatos sem responsável', function () {
    $assignee = User::factory()->create();
    $free = Lead::factory()->create();
    Lead::factory()->create(['status' => 'EM_ATENDIMENTO', 'assigned_to' => $assignee->id]);
    asStaff('SECRETARIA');

    expect(listedIds($this->getJson('/api/admin/leads?inbox=geral&assigned_to=none')))->toBe([$free->id]);
});

it('filtra pelo responsável: o id ou "me"', function () {
    $me = asStaff('SECRETARIA');
    $other = User::factory()->create();
    $mine = Lead::factory()->create(['status' => 'EM_ATENDIMENTO', 'assigned_to' => $me->id]);
    Lead::factory()->create(['status' => 'EM_ATENDIMENTO', 'assigned_to' => $other->id]);
    Lead::factory()->create();

    expect(listedIds($this->getJson('/api/admin/leads?inbox=geral&assigned_to=me')))->toBe([$mine->id])
        ->and(listedIds($this->getJson("/api/admin/leads?inbox=geral&assigned_to={$me->id}")))->toBe([$mine->id]);
    $this->getJson('/api/admin/leads?inbox=geral&assigned_to=todos')->assertStatus(422)->assertJsonPath('error.details.0.field', 'assigned_to');
});

it('filtra por período, pelas datas de Brasília (início e fim do dia incluídos)', function () {
    $beforeStart = Lead::factory()->create(['created_at' => Carbon::parse('2026-10-19 02:59:00', 'UTC')]); // 18/10 23h59 em Brasília
    $startOfDay = Lead::factory()->create(['created_at' => Carbon::parse('2026-10-19 03:00:00', 'UTC')]); // 19/10 00h00
    $endOfDay = Lead::factory()->create(['created_at' => Carbon::parse('2026-10-20 02:59:59', 'UTC')]); // 19/10 23h59
    $afterEnd = Lead::factory()->create(['created_at' => Carbon::parse('2026-10-20 03:00:00', 'UTC')]); // 20/10 00h00
    asStaff('SECRETARIA');

    $ids = listedIds($this->getJson('/api/admin/leads?inbox=geral&from=2026-10-19&to=2026-10-19'));

    expect($ids)->toEqualCanonicalizing([$startOfDay->id, $endOfDay->id])
        ->and($ids)->not->toContain($beforeStart->id, $afterEnd->id);
});

it('recusa datas malformadas e período invertido', function (string $query, string $field) {
    asStaff('SECRETARIA');

    $this->getJson("/api/admin/leads?inbox=geral&{$query}")->assertStatus(422)->assertJsonPath('error.details.0.field', $field);
})->with([
    'from malformado' => ['from=19/10/2026', 'from'],
    'to malformado' => ['to=ontem', 'to'],
    'período invertido' => ['from=2026-10-20&to=2026-10-19', 'to'],
]);

it('busca por nome ou por telefone, com pelo menos 2 caracteres', function () {
    $maria = Lead::factory()->create(['name' => 'Maria Aparecida', 'phone' => '+5531988887777']);
    $joao = Lead::factory()->create(['name' => 'João Pereira', 'phone' => '+5531977776666']);
    asStaff('SECRETARIA');

    expect(listedIds($this->getJson('/api/admin/leads?inbox=geral&q=apar')))->toBe([$maria->id])
        ->and(listedIds($this->getJson('/api/admin/leads?inbox=geral&q=Pereira')))->toBe([$joao->id])
        ->and(listedIds($this->getJson('/api/admin/leads?inbox=geral&q='.urlencode('(31) 98888'))))->toBe([$maria->id])
        ->and(listedIds($this->getJson('/api/admin/leads?inbox=geral&q=977776666')))->toBe([$joao->id]);
    $this->getJson('/api/admin/leads?inbox=geral&q=a')->assertStatus(422)->assertJsonPath('error.details.0.field', 'q');
});

it('a busca só olha o telefone quando o termo parece telefone: letras com números procuram só no nome', function () {
    $named = Lead::factory()->create(['name' => 'Equipe 2026', 'phone' => '+5531911112222']);
    Lead::factory()->create(['name' => 'Outra Pessoa', 'phone' => '+5531922026333']);
    asStaff('SECRETARIA');

    expect(listedIds($this->getJson('/api/admin/leads?inbox=geral&q='.urlencode('Equipe 2026'))))->toBe([$named->id])
        ->and($this->getJson('/api/admin/leads?inbox=geral&q=2026')->json('meta.total'))->toBe(2);
});

it('a busca trata % e _ como texto comum e a mensagem cifrada nunca entra', function () {
    Lead::factory()->create(['name' => 'Ana 100% Fiel', 'message' => 'palavra-secreta-da-mensagem']);
    Lead::factory()->create(['name' => 'Outra Pessoa']);
    asStaff('SECRETARIA');

    expect($this->getJson('/api/admin/leads?inbox=geral&q='.urlencode('100%'))->json('meta.total'))->toBe(1)
        ->and($this->getJson('/api/admin/leads?inbox=geral&q='.urlencode('%%'))->json('meta.total'))->toBe(0)
        ->and($this->getJson('/api/admin/leads?inbox=geral&q=palavra-secreta')->json('meta.total'))->toBe(0);
});

// ───────────────────────────── BR-010 e BR-012 ─────────────────────────────

it('BR-010 só destaca o contato NOVO há mais de 3 dias, com o número de dias', function () {
    $stalled = Lead::factory()->waitingDays(5)->create();
    $recent = Lead::factory()->waitingDays(2)->create();
    $atLimit = Lead::factory()->create(['created_at' => now()->subDays(3)->addMinute()]);
    $justOver = Lead::factory()->create(['created_at' => now()->subDays(3)->subHour()]);
    $inProgress = Lead::factory()->waitingDays(9)->create(['status' => 'EM_ATENDIMENTO']);
    $done = Lead::factory()->waitingDays(9)->create(['status' => 'CONCLUIDO']);
    asStaff('SECRETARIA');

    $byId = collect($this->getJson('/api/admin/leads?inbox=geral')->json('data'))->keyBy('id');

    expect($byId[$stalled->id]['waiting_days'])->toBe(5)
        ->and($byId[$justOver->id]['waiting_days'])->toBe(3)
        ->and($byId[$recent->id]['waiting_days'])->toBeNull()
        ->and($byId[$atLimit->id]['waiting_days'])->toBeNull()
        ->and($byId[$inProgress->id]['waiting_days'])->toBeNull()
        ->and($byId[$done->id]['waiting_days'])->toBeNull();
});

it('BR-010 a consulta do início do painel (status=NOVO e to = hoje − 3 dias) traz os parados, os mais antigos primeiro', function () {
    $oldest = Lead::factory()->waitingDays(9)->create();
    $stalled = Lead::factory()->waitingDays(5)->create();
    Lead::factory()->waitingDays(1)->create();
    Lead::factory()->waitingDays(8)->create(['status' => 'CONCLUIDO']);
    asStaff('SECRETARIA');
    $to = now('America/Sao_Paulo')->subDays(3)->toDateString();

    $ids = listedIds($this->getJson("/api/admin/leads?inbox=geral&status=NOVO&to={$to}&sort=created_at&per_page=5")->assertOk());

    expect($ids)->toBe([$oldest->id, $stalled->id]);
});

it('BR-012 o responsável desativado continua atribuído e aparece como inativo', function () {
    $gone = User::factory()->inactive()->create(['name' => 'Ex Atendente']);
    Lead::factory()->create(['status' => 'EM_ATENDIMENTO', 'assigned_to' => $gone->id]);
    asStaff('SECRETARIA');

    $this->getJson('/api/admin/leads?inbox=geral')
        ->assertOk()
        ->assertJsonPath('data.0.assigned_to', ['id' => $gone->id, 'name' => 'Ex Atendente', 'is_active' => false]);
});

// ───────────────────────────── O detalhe ─────────────────────────────

it('o detalhe traz todos os campos, a mensagem decifrada, o histórico e o link do WhatsApp', function () {
    $group = MinistryGroup::factory()->create(['name' => 'Jovens e Adolescentes']);
    $actor = User::factory()->create(['name' => 'Ana Atendente']);
    $lead = Lead::factory()->visitante()->create([
        'name' => 'Maria Souza',
        'phone' => '+5531999998888',
        'neighborhood' => 'Centro',
        'wants_visit' => true,
        'wants_cell_group' => false,
        'group_id' => $group->id,
        'message' => 'Gostei muito do culto, obrigada!',
    ]);
    LeadActivity::factory()->create([
        'lead_id' => $lead->id, 'actor_user_id' => $actor->id, 'from_status' => 'NOVO', 'to_status' => 'EM_ATENDIMENTO',
        'assigned_to' => $actor->id, 'note' => 'Primeiro contato por telefone.',
    ]);
    asStaff('SECRETARIA');

    $response = $this->getJson("/api/admin/leads/{$lead->id}")->assertOk();

    expect($response->json('data'))->toMatchArray([
        'id' => $lead->id,
        'type' => 'VISITANTE',
        'name' => 'Maria Souza',
        'phone' => '+5531999998888',
        'neighborhood' => 'Centro',
        'wants_visit' => true,
        'wants_cell_group' => false,
        'group' => ['id' => $group->id, 'name' => 'Jovens e Adolescentes'],
        'message' => 'Gostei muito do culto, obrigada!',
        'consent_version' => '1.0',
        'whatsapp_url' => 'https://wa.me/5531999998888',
    ])
        ->and($response->json('data.activities'))->toHaveCount(1)
        ->and($response->json('data.activities.0'))->toMatchArray([
            'actor' => ['id' => $actor->id, 'name' => 'Ana Atendente'],
            'from_status' => 'NOVO',
            'to_status' => 'EM_ATENDIMENTO',
            'assigned_to' => $actor->id,
            'note' => 'Primeiro contato por telefone.',
        ]);
});

it('sem telefone não há link do WhatsApp (pedido de oração anônimo)', function () {
    $prayer = Lead::factory()->oracao()->create(['message' => 'Orem pela minha família.']);
    asStaff('ORACAO');

    $this->getJson("/api/admin/leads/{$prayer->id}")
        ->assertOk()
        ->assertJsonPath('data.whatsapp_url', null)
        ->assertJsonPath('data.name', null)
        ->assertJsonPath('data.message', 'Orem pela minha família.');
});

it('o histórico vem do mais antigo para o mais novo, com a anotação decifrada', function () {
    $lead = Lead::factory()->create();
    $actor = User::factory()->create();
    LeadActivity::factory()->create(['lead_id' => $lead->id, 'actor_user_id' => $actor->id, 'note' => 'Primeira', 'created_at' => now()->subDay()]);
    LeadActivity::factory()->create(['lead_id' => $lead->id, 'actor_user_id' => $actor->id, 'note' => 'Segunda', 'created_at' => now()]);
    asStaff('SECRETARIA');

    $notes = array_column($this->getJson("/api/admin/leads/{$lead->id}")->json('data.activities'), 'note');

    expect($notes)->toBe(['Primeira', 'Segunda']);
});

it('o contato com ministério mostra o ministério', function () {
    $ministry = MinistryGroup::factory()->create(['name' => 'Comunicação']);
    $lead = Lead::factory()->ministerio($ministry)->create();
    asStaff('SECRETARIA');

    $this->getJson("/api/admin/leads/{$lead->id}")
        ->assertOk()
        ->assertJsonPath('data.ministry', ['id' => $ministry->id, 'name' => 'Comunicação']);
});

it('um contato que não existe é 404', function () {
    asStaff('SECRETARIA');

    $this->getJson('/api/admin/leads/999999')->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
});

it('sem sessão, a caixa responde 401', function () {
    $this->getJson('/api/admin/leads?inbox=geral')->assertUnauthorized();
});
