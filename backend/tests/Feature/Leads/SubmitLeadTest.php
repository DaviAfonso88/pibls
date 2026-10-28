<?php

declare(strict_types=1);

use App\Modules\Leads\Models\Lead;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Contracts\Encryption\Encrypter;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

use function Pest\Laravel\postJson;

/*
| POST /api/public/leads (contracts/openapi.yaml → LeadInput; architecture.md → CAP-05). BR-001 a BR-006.
*/

/**
 * Um envio válido de cada tipo.
 *
 * @return array<string, array<string, mixed>>
 */
function validLeads(): array
{
    return [
        'VISITANTE' => ['type' => 'VISITANTE', 'name' => 'Maria Souza', 'phone' => '(31) 99999-8888', 'neighborhood' => 'Promissão', 'wants_visit' => true, 'wants_cell_group' => false, 'consent' => true],
        'MEMBRO' => ['type' => 'MEMBRO', 'name' => 'João Lima', 'phone' => '31988887777', 'from_other_baptist_church' => true, 'consent' => true],
        'ORACAO' => ['type' => 'ORACAO', 'message' => 'Peço oração pela minha família.', 'consent' => true],
        'CONTATO' => ['type' => 'CONTATO', 'name' => 'Ana Costa', 'email' => 'Ana.Costa@Example.com', 'message' => 'Gostaria de falar com a secretaria.', 'consent' => true],
    ];
}

it('grava cada tipo como NOVO, com o consentimento e a versão da política, e responde 201 sem id', function (string $type) {
    config(['pibls.privacy_policy_version' => '2.1']);

    $response = postJson('/api/public/leads', validLeads()[$type]);

    $response->assertCreated()->assertExactJson(['data' => ['received' => true]]);
    $lead = Lead::query()->sole();
    expect($lead->type)->toBe($type)
        ->and($lead->status)->toBe('NOVO')
        ->and($lead->consent_version)->toBe('2.1') // BR-082
        ->and($lead->consent_at->diffInSeconds(now(), true))->toBeLessThan(5)
        ->and($lead->status_changed_at->equalTo($lead->consent_at))->toBeTrue();
})->with(['VISITANTE', 'MEMBRO', 'ORACAO', 'CONTATO']);

it('grava o contato com ministério, com o ministério ativo', function () {
    $ministry = MinistryGroup::factory()->create();

    postJson('/api/public/leads', [
        'type' => 'MINISTERIO', 'name' => 'Paulo Reis', 'phone' => '31977776666', 'ministry_id' => $ministry->id,
        'message' => 'Quero servir na música.', 'consent' => true,
    ])->assertCreated();

    expect(Lead::query()->sole()->ministry_id)->toBe($ministry->id);
});

it('guarda o telefone em E.164, o e-mail em minúsculas e o nome sem espaços sobrando', function () {
    postJson('/api/public/leads', [...validLeads()['CONTATO'], 'name' => '  Ana   Costa ', 'phone' => '(31) 3688-1234'])->assertCreated();

    $lead = Lead::query()->sole();
    expect($lead->phone)->toBe('+553136881234')
        ->and($lead->email)->toBe('ana.costa@example.com')
        ->and($lead->name)->toBe('Ana Costa');
});

it('cifra a mensagem no banco (ADR-016)', function () {
    postJson('/api/public/leads', validLeads()['ORACAO'])->assertCreated();

    $raw = (string) DB::table('leads_messages')->value('message');
    expect($raw)->not->toContain('minha família')
        ->and(app(Encrypter::class)->decrypt($raw, false))->toBe('Peço oração pela minha família.');
});

it('aceita o pedido de oração anônimo: só o texto é obrigatório (RF-D03)', function () {
    postJson('/api/public/leads', ['type' => 'ORACAO', 'message' => 'Orem por mim, por favor.', 'consent' => true])->assertCreated();

    $lead = Lead::query()->sole();
    expect($lead->name)->toBeNull()->and($lead->phone)->toBeNull()->and($lead->email)->toBeNull();
});

it('BR-001 recusa sem consentimento, com a mensagem do documento', function (mixed $consent) {
    $payload = [...validLeads()['CONTATO'], 'consent' => $consent];
    if ($consent === null) {
        unset($payload['consent']);
    }

    postJson('/api/public/leads', $payload)
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonPath('error.details.0.field', 'consent')
        ->assertJsonPath('error.details.0.message', 'Para enviar, você precisa concordar com a Política de Privacidade.');

    expect(Lead::query()->count())->toBe(0);
})->with([false, null, 'sim', 0]);

it('BR-002 descarta em silêncio o envio com o honeypot preenchido: 201 sem gravar nem enfileirar', function () {
    config(['queue.default' => 'database']);
    Log::spy();

    postJson('/api/public/leads', [...validLeads()['CONTATO'], 'website' => 'http://spam.example'])
        ->assertCreated()
        ->assertExactJson(['data' => ['received' => true]]);

    expect(Lead::query()->count())->toBe(0)->and(DB::table('jobs')->count())->toBe(0);
    Log::shouldHaveReceived('warning')->withArgs(fn (string $message, array $context) => $message === 'lead.honeypot' && ! str_contains(json_encode($context, JSON_THROW_ON_ERROR), 'spam.example'))->once();
});

it('BR-002 o honeypot descarta até o envio que seria inválido (o robô não aprende nada)', function () {
    postJson('/api/public/leads', ['type' => 'CONTATO', 'website' => 'x'])->assertCreated();

    expect(Lead::query()->count())->toBe(0);
});

it('BR-003 recusa o 4º envio do mesmo telefone em 10 minutos, no envelope de erro', function () {
    foreach (range(1, 3) as $i) {
        postJson('/api/public/leads', [...validLeads()['MEMBRO'], 'phone' => '(31) 98888-7777'])->assertCreated();
    }

    postJson('/api/public/leads', [...validLeads()['MEMBRO'], 'phone' => '+55 31 98888-7777'])
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'TOO_MANY_REQUESTS')
        ->assertJsonPath('error.message', 'Muitas tentativas. Tente novamente em alguns minutos.');

    expect(Lead::query()->count())->toBe(3);
});

it('BR-003 recusa o 11º envio do mesmo IP em 10 minutos, mesmo com telefones diferentes', function () {
    foreach (range(1, 10) as $i) {
        postJson('/api/public/leads', ['type' => 'ORACAO', 'message' => "Pedido número {$i}", 'consent' => true])->assertCreated();
    }

    postJson('/api/public/leads', ['type' => 'ORACAO', 'message' => 'Mais um pedido', 'consent' => true])->assertStatus(429);
});

it('BR-004 exige os campos de cada tipo', function (string $type, array $missing, array $expected) {
    $payload = validLeads()[$type];
    foreach ($missing as $field) {
        unset($payload[$field]);
    }

    $response = postJson('/api/public/leads', $payload)->assertStatus(422);

    $fields = array_column($response->json('error.details'), 'field');
    foreach ($expected as $field) {
        expect($fields)->toContain($field);
    }
    expect(Lead::query()->count())->toBe(0);
})->with([
    'VISITANTE sem nome' => ['VISITANTE', ['name'], ['name']],
    'VISITANTE sem telefone' => ['VISITANTE', ['phone'], ['phone']],
    'VISITANTE sem bairro' => ['VISITANTE', ['neighborhood'], ['neighborhood']],
    'VISITANTE sem as perguntas' => ['VISITANTE', ['wants_visit', 'wants_cell_group'], ['wants_visit', 'wants_cell_group']],
    'MEMBRO sem nome' => ['MEMBRO', ['name'], ['name']],
    'MEMBRO sem telefone' => ['MEMBRO', ['phone'], ['phone']],
    'MEMBRO sem a pergunta' => ['MEMBRO', ['from_other_baptist_church'], ['from_other_baptist_church']],
    'ORACAO sem texto' => ['ORACAO', ['message'], ['message']],
    'CONTATO sem nome' => ['CONTATO', ['name'], ['name']],
    'CONTATO sem mensagem' => ['CONTATO', ['message'], ['message']],
]);

it('BR-004 usa as mensagens do documento', function () {
    $response = postJson('/api/public/leads', ['type' => 'CONTATO', 'name' => 'A', 'phone' => '123', 'email' => 'não-é-email', 'message' => 'oi', 'consent' => true])->assertStatus(422);

    $messages = collect($response->json('error.details'))->pluck('message', 'field');
    expect($messages['name'])->toBe('Informe seu nome.')
        ->and($messages['phone'])->toBe('Informe um telefone válido com DDD.')
        ->and($messages['email'])->toBe('Informe um e-mail válido.')
        ->and($messages['message'])->toBe('Escreva sua mensagem (mínimo de 5 caracteres).');
});

it('BR-004 recusa telefone com DDD inválido e nome sem letra', function () {
    postJson('/api/public/leads', [...validLeads()['MEMBRO'], 'phone' => '10 99999-8888', 'name' => '12345'])
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'name')
        ->assertJsonPath('error.details.1.field', 'phone');
});

it('BR-004 limita a mensagem por tipo: 4.000 na oração, 2.000 nos demais', function () {
    postJson('/api/public/leads', [...validLeads()['ORACAO'], 'message' => str_repeat('a', 4000)])->assertCreated();
    postJson('/api/public/leads', [...validLeads()['ORACAO'], 'message' => str_repeat('a', 4001)])->assertStatus(422)->assertJsonPath('error.details.0.field', 'message');
    postJson('/api/public/leads', [...validLeads()['CONTATO'], 'message' => str_repeat('a', 2000)])->assertCreated();
    postJson('/api/public/leads', [...validLeads()['CONTATO'], 'message' => str_repeat('a', 2001)])->assertStatus(422)->assertJsonPath('error.details.0.field', 'message');
    postJson('/api/public/leads', [...validLeads()['VISITANTE'], 'message' => str_repeat('a', 2001)])->assertStatus(422)->assertJsonPath('error.details.0.field', 'message');
});

it('BR-004 limita o bairro a 2 a 80 caracteres', function (string $neighborhood) {
    postJson('/api/public/leads', [...validLeads()['VISITANTE'], 'neighborhood' => $neighborhood])
        ->assertStatus(422)->assertJsonPath('error.details.0.field', 'neighborhood');
})->with(['a', 'a b c d e f g h i j k l m n o p q r s t u v w x y z a b c d e f g h i j k l m n o p q r s t u v w x y z']);

it('BR-005 exige telefone ou e-mail em CONTATO e MINISTERIO', function () {
    $ministry = MinistryGroup::factory()->create();

    postJson('/api/public/leads', ['type' => 'CONTATO', 'name' => 'Ana Costa', 'message' => 'Preciso de ajuda.', 'consent' => true])
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.message', 'Informe um telefone ou um e-mail para retorno.');
    postJson('/api/public/leads', ['type' => 'MINISTERIO', 'name' => 'Ana Costa', 'ministry_id' => $ministry->id, 'message' => 'Preciso de ajuda.', 'consent' => true])
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.message', 'Informe um telefone ou um e-mail para retorno.');

    // Basta um dos dois
    postJson('/api/public/leads', ['type' => 'CONTATO', 'name' => 'Ana Costa', 'phone' => '31999998888', 'message' => 'Preciso de ajuda.', 'consent' => true])->assertCreated();
    postJson('/api/public/leads', ['type' => 'CONTATO', 'name' => 'Ana Costa', 'email' => 'ana@example.com', 'message' => 'Preciso de ajuda.', 'consent' => true])->assertCreated();
});

it('BR-006 exige ministério existente e ativo em MINISTERIO', function (?int $ministryId) {
    $payload = ['type' => 'MINISTERIO', 'name' => 'Paulo Reis', 'phone' => '31977776666', 'message' => 'Quero servir.', 'consent' => true];
    if ($ministryId !== null) {
        $payload['ministry_id'] = $ministryId;
    }

    postJson('/api/public/leads', $payload)
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'ministry_id')
        ->assertJsonPath('error.details.0.message', 'Ministério inválido.');
})->with([null, 99999]);

it('BR-006 recusa ministério inativo', function () {
    $inactive = MinistryGroup::factory()->inactive()->create();

    postJson('/api/public/leads', ['type' => 'MINISTERIO', 'name' => 'Paulo Reis', 'phone' => '31977776666', 'ministry_id' => $inactive->id, 'message' => 'Quero servir.', 'consent' => true])
        ->assertStatus(422)->assertJsonPath('error.details.0.message', 'Ministério inválido.');
});

it('BR-006 aceita grupo ou célula ativos no VISITANTE e recusa inativo, inexistente ou ministério', function () {
    $group = MinistryGroup::factory()->group()->create();
    $cell = MinistryGroup::factory()->cell()->create();
    $ministry = MinistryGroup::factory()->create();
    $inactive = MinistryGroup::factory()->group()->inactive()->create();

    postJson('/api/public/leads', [...validLeads()['VISITANTE'], 'group_id' => $group->id, 'phone' => '31911110001'])->assertCreated();
    postJson('/api/public/leads', [...validLeads()['VISITANTE'], 'group_id' => $cell->id, 'phone' => '31911110002'])->assertCreated();
    expect(Lead::query()->pluck('group_id')->all())->toBe([$group->id, $cell->id]);

    foreach ([$inactive->id, 99999, $ministry->id] as $index => $invalid) {
        postJson('/api/public/leads', [...validLeads()['VISITANTE'], 'group_id' => $invalid, 'phone' => '3191111000'.($index + 3)])
            ->assertStatus(422)
            ->assertJsonPath('error.details.0.field', 'group_id')
            ->assertJsonPath('error.details.0.message', 'Grupo inválido.');
    }
});

it('recusa um tipo que não existe', function () {
    postJson('/api/public/leads', [...validLeads()['CONTATO'], 'type' => 'OUTRO'])
        ->assertStatus(422)->assertJsonPath('error.details.0.field', 'type');
});

it('ignora campos que o tipo não usa, em vez de gravá-los', function () {
    $ministry = MinistryGroup::factory()->create();

    postJson('/api/public/leads', [...validLeads()['MEMBRO'], 'ministry_id' => $ministry->id, 'neighborhood' => 'Centro', 'status' => 'CONCLUIDO', 'assigned_to' => 1])->assertCreated();

    $lead = Lead::query()->sole();
    expect($lead->ministry_id)->toBeNull()->and($lead->neighborhood)->toBeNull()->and($lead->status)->toBe('NOVO')->and($lead->assigned_to)->toBeNull();
});

it('responde 419 no envelope quando o token CSRF falta', function () {
    // O Laravel pula o CSRF nos testes; aqui ele volta a valer, como em produção
    $this->app->bind(PreventRequestForgery::class, fn (Application $app) => new class($app, $app->make(Encrypter::class)) extends PreventRequestForgery
    {
        protected function runningUnitTests()
        {
            return false;
        }
    });

    postJson('/api/public/leads', validLeads()['CONTATO'])
        ->assertStatus(419)
        ->assertJsonPath('error.code', 'CSRF_TOKEN_MISMATCH');

    expect(Lead::query()->count())->toBe(0);
});

it('nunca registra o conteúdo do envio no log (LGPD)', function () {
    Log::spy();

    postJson('/api/public/leads', validLeads()['ORACAO'])->assertCreated();

    Log::shouldNotHaveReceived('info', fn (string $message, array $context = []) => str_contains(json_encode($context), 'minha família'));
    Log::shouldNotHaveReceived('warning', fn (string $message, array $context = []) => str_contains(json_encode($context), 'minha família'));
});
