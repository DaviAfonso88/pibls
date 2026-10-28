<?php

declare(strict_types=1);

use App\Modules\Events\Events\RegistrationCreated;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

/*
| Inscrição pública (T179): POST /api/public/events/{slug}/register (contracts/openapi.yaml → RegistrationInput;
| architecture.md → CAP-19). BR-001, BR-002, BR-020 a BR-024, BR-083 e ADR-020, com a flag FEATURE_EVENTS ligada.
*/

beforeEach(function () {
    config(['features.events' => true, 'queue.default' => 'database']);
    Carbon::setTestNow('2026-11-10 12:00:00');
});

afterEach(fn () => Carbon::setTestNow());

/**
 * Um evento publicado, daqui a 25 dias, sem vagas contadas e sem formulário.
 *
 * @param  array<string, mixed>  $overrides
 */
function openEvent(array $overrides = []): Event
{
    return Event::factory()->published()->create([
        'slug' => 'acampamento',
        'starts_at' => '2026-12-05 12:00:00',
        ...$overrides,
    ]);
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function registrationBody(array $overrides = []): array
{
    return [
        'participant_name' => 'Ana Souza',
        'phone' => '(31) 99999-8888',
        'email' => 'Ana.Souza@Example.com',
        'answers' => [],
        'consent' => true,
        ...$overrides,
    ];
}

/** @return list<array<string, mixed>> um campo de cada tipo, para validar as respostas */
function everyFieldType(): array
{
    return [
        ['key' => 'camiseta', 'label' => 'Tamanho da camiseta', 'type' => 'SELECT', 'required' => true, 'options' => ['P', 'M', 'G']],
        ['key' => 'recado', 'label' => 'Recado', 'type' => 'TEXT', 'required' => false],
        ['key' => 'historia', 'label' => 'Sua história', 'type' => 'TEXTAREA', 'required' => false],
        ['key' => 'idade', 'label' => 'Idade', 'type' => 'NUMBER', 'required' => true, 'min' => 5, 'max' => 90],
        ['key' => 'nascimento', 'label' => 'Nascimento', 'type' => 'DATE', 'required' => false],
        ['key' => 'dias', 'label' => 'Dias que vai', 'type' => 'MULTISELECT', 'required' => false, 'options' => ['Sexta', 'Sábado', 'Domingo']],
        ['key' => 'carona', 'label' => 'Precisa de carona', 'type' => 'BOOLEAN', 'required' => false],
    ];
}

/** @return array<string, mixed> respostas válidas para `everyFieldType()` */
function validAnswers(): array
{
    return ['camiseta' => 'M', 'recado' => 'Levo violão', 'historia' => 'Conheci a igreja em 2020.', 'idade' => 34, 'nascimento' => '1992-03-14', 'dias' => ['Domingo', 'Sexta'], 'carona' => true];
}

it('inscreve, grava os dados normalizados e responde 201 com o resumo', function () {
    config(['pibls.privacy_policy_version' => '2.1']);
    $event = openEvent(['title' => 'Acampamento de Carnaval']);

    $response = postJson('/api/public/events/acampamento/register', registrationBody(['participant_name' => '  Ana   Souza ']));

    $registration = EventRegistration::query()->sole();
    $response->assertCreated()->assertExactJson(['data' => [
        'id' => $registration->id,
        'event_title' => 'Acampamento de Carnaval',
        'participant_name' => 'Ana Souza',
        'starts_at' => '2026-12-05T12:00:00Z',
        'confirmation_email_queued' => true,
    ]]);
    expect($registration->event_id)->toBe($event->id)
        ->and($registration->participant_name)->toBe('Ana Souza')
        ->and($registration->participant_name_normalized)->toBe('ana souza')
        ->and($registration->phone)->toBe('+5531999998888')
        ->and($registration->email)->toBe('ana.souza@example.com')
        ->and($registration->consent_version)->toBe('2.1') // BR-082
        ->and($registration->consent_at->equalTo(now()))->toBeTrue()
        ->and($registration->health_consent_at)->toBeNull()
        ->and($registration->guardian_name)->toBeNull();
});

it('BR-001 recusa a inscrição sem o consentimento e não grava nada', function () {
    openEvent();

    postJson('/api/public/events/acampamento/register', registrationBody(['consent' => false]))
        ->assertUnprocessable()->assertJsonPath('error.details.0.field', 'consent');
    postJson('/api/public/events/acampamento/register', registrationBody(['consent' => null]))->assertUnprocessable();

    expect(EventRegistration::query()->count())->toBe(0);
});

it('BR-002 descarta o envio com o honeypot preenchido: 201 genérico, nada gravado, só um aviso sem conteúdo', function () {
    openEvent();
    Log::spy();

    postJson('/api/public/events/acampamento/register', registrationBody(['website' => 'http://spam.example']))
        ->assertCreated()->assertExactJson(['data' => ['received' => true]]);

    expect(EventRegistration::query()->count())->toBe(0)->and(DB::table('jobs')->count())->toBe(0);
    Log::shouldHaveReceived('warning')->withArgs(fn (string $message, array $context) => $message === 'registration.honeypot' && array_keys($context) === ['path'])->once();
});

it('valida o formato dos campos fixos', function (array $override, string $field) {
    openEvent();

    postJson('/api/public/events/acampamento/register', registrationBody($override))
        ->assertUnprocessable()->assertJsonPath('error.details.0.field', $field);
})->with([
    'nome em branco' => [['participant_name' => ' '], 'participant_name'],
    'telefone sem DDD' => [['phone' => '99999-8888'], 'phone'],
    'e-mail sem arroba' => [['email' => 'ana.example.com'], 'email'],
    'sem telefone' => [['phone' => null], 'phone'],
]);

it('o e-mail é opcional', function () {
    openEvent();

    postJson('/api/public/events/acampamento/register', registrationBody(['email' => null]))->assertCreated()
        ->assertJsonPath('data.confirmation_email_queued', false);

    expect(EventRegistration::query()->sole()->email)->toBeNull();
});

it('com a flag desligada, a página, a lista e a inscrição respondem 404', function () {
    openEvent();
    config(['features.events' => false]);

    getJson('/api/public/events')->assertNotFound();
    getJson('/api/public/events/acampamento')->assertNotFound();
    postJson('/api/public/events/acampamento/register', registrationBody())->assertNotFound();

    expect(EventRegistration::query()->count())->toBe(0);
});

it('rascunho e endereço que não existe são o mesmo 404', function () {
    openEvent(['slug' => 'rascunho', 'is_published' => false]);

    postJson('/api/public/events/rascunho/register', registrationBody())->assertNotFound();
    postJson('/api/public/events/nao-existe/register', registrationBody())->assertNotFound();

    expect(EventRegistration::query()->count())->toBe(0);
});

it('BR-020 recusa depois do prazo de inscrição, com 409 REGISTRATION_CLOSED', function () {
    openEvent(['registration_deadline' => '2026-11-10 11:59:59']);

    postJson('/api/public/events/acampamento/register', registrationBody())
        ->assertConflict()->assertJsonPath('error.code', 'REGISTRATION_CLOSED')
        ->assertJsonPath('error.message', 'As inscrições para este evento estão encerradas.');

    expect(EventRegistration::query()->count())->toBe(0);
});

it('BR-020 aceita até o instante antes do prazo e recusa depois que o evento começou, mesmo sem prazo', function () {
    openEvent(['registration_deadline' => '2026-11-10 12:00:01']);
    postJson('/api/public/events/acampamento/register', registrationBody())->assertCreated();

    openEvent(['slug' => 'ja-comecou', 'starts_at' => '2026-11-10 11:00:00', 'ends_at' => '2026-11-10 18:00:00']);
    postJson('/api/public/events/ja-comecou/register', registrationBody())
        ->assertConflict()->assertJsonPath('error.code', 'REGISTRATION_CLOSED');
});

it('BR-021 aceita a última vaga e recusa a seguinte com 409 EVENT_FULL', function () {
    openEvent(['max_spots' => 2]);

    postJson('/api/public/events/acampamento/register', registrationBody())->assertCreated();
    postJson('/api/public/events/acampamento/register', registrationBody(['participant_name' => 'Bia Lima', 'phone' => '31988887777']))->assertCreated();
    postJson('/api/public/events/acampamento/register', registrationBody(['participant_name' => 'Caio Reis', 'phone' => '31977776666']))
        ->assertConflict()->assertJsonPath('error.code', 'EVENT_FULL')
        ->assertJsonPath('error.message', 'Vagas esgotadas para este evento.');

    expect(EventRegistration::query()->count())->toBe(2);
});

it('BR-021 vagas ilimitadas nunca esgotam', function () {
    $event = openEvent(['max_spots' => null]);
    EventRegistration::factory()->count(30)->create(['event_id' => $event->id]);

    postJson('/api/public/events/acampamento/register', registrationBody())->assertCreated();
});

it('BR-021 a vaga de uma inscrição excluída volta a ficar livre', function () {
    $event = openEvent(['max_spots' => 1]);
    $first = EventRegistration::factory()->create(['event_id' => $event->id]);
    postJson('/api/public/events/acampamento/register', registrationBody())->assertConflict();

    $first->delete();

    postJson('/api/public/events/acampamento/register', registrationBody())->assertCreated();
});

it('BR-022 recusa a mesma pessoa, ignorando maiúsculas, acentos e espaços, com 409 DUPLICATE_REGISTRATION', function (string $name) {
    openEvent();
    postJson('/api/public/events/acampamento/register', registrationBody(['participant_name' => 'José da Conceição', 'phone' => '(31) 98888-7777']))->assertCreated();

    postJson('/api/public/events/acampamento/register', registrationBody(['participant_name' => $name, 'phone' => '31 98888 7777']))
        ->assertConflict()->assertJsonPath('error.code', 'DUPLICATE_REGISTRATION')
        ->assertJsonPath('error.message', 'Esta pessoa já está inscrita neste evento com este telefone.');

    expect(EventRegistration::query()->count())->toBe(1);
})->with([
    'caixa alta' => 'JOSÉ DA CONCEIÇÃO',
    'sem acento' => 'jose da conceicao',
    'espaços a mais' => '  José   da   Conceição  ',
]);

it('BR-022 aceita nome diferente com o mesmo telefone, e o mesmo nome com outro telefone', function () {
    openEvent();
    postJson('/api/public/events/acampamento/register', registrationBody())->assertCreated();

    postJson('/api/public/events/acampamento/register', registrationBody(['participant_name' => 'Pedro Souza']))->assertCreated(); // irmão, mesmo telefone
    postJson('/api/public/events/acampamento/register', registrationBody(['phone' => '31977776666']))->assertCreated(); // homônimo

    expect(EventRegistration::query()->count())->toBe(3);
});

it('BR-022 vale por evento: a mesma pessoa pode se inscrever em outro', function () {
    openEvent();
    openEvent(['slug' => 'retiro']);
    postJson('/api/public/events/acampamento/register', registrationBody())->assertCreated();

    postJson('/api/public/events/retiro/register', registrationBody())->assertCreated();
});

it('BR-023 evento com menores exige o responsável e a autorização, e grava o consentimento dele', function () {
    openEvent(['has_minors' => true]);

    postJson('/api/public/events/acampamento/register', registrationBody())
        ->assertUnprocessable()
        ->assertJsonPath('error.details.0.message', 'Informe os dados do responsável legal e marque a autorização.')
        ->assertJsonCount(3, 'error.details');
    postJson('/api/public/events/acampamento/register', registrationBody(['guardian_name' => 'Carla Souza', 'guardian_phone' => '(31) 98888-7777', 'guardian_consent' => false]))
        ->assertUnprocessable()->assertJsonPath('error.details.0.field', 'guardian_consent');
    expect(EventRegistration::query()->count())->toBe(0);

    postJson('/api/public/events/acampamento/register', registrationBody(['guardian_name' => ' Carla  Souza ', 'guardian_phone' => '(31) 98888-7777', 'guardian_consent' => true]))->assertCreated();

    $registration = EventRegistration::query()->sole();
    expect($registration->guardian_name)->toBe('Carla Souza')
        ->and($registration->guardian_phone)->toBe('+5531988887777')
        ->and($registration->guardian_consent_at->equalTo(now()))->toBeTrue();
});

it('BR-023 evento sem menores ignora o que vier do responsável', function () {
    openEvent(['has_minors' => false]);

    postJson('/api/public/events/acampamento/register', registrationBody(['guardian_name' => 'Carla Souza', 'guardian_phone' => '31988887777', 'guardian_consent' => true]))->assertCreated();

    $registration = EventRegistration::query()->sole();
    expect($registration->guardian_name)->toBeNull()->and($registration->guardian_phone)->toBeNull()->and($registration->guardian_consent_at)->toBeNull();
});

it('BR-024 grava as respostas na ordem do formulário, com o rótulo da época, e descarta chave desconhecida', function () {
    openEvent(['form_schema' => everyFieldType()]);

    postJson('/api/public/events/acampamento/register', registrationBody(['answers' => [...validAnswers(), 'intrusa' => 'x']]))->assertCreated();

    expect(EventRegistration::query()->sole()->answers)->toBe([
        ['key' => 'camiseta', 'label' => 'Tamanho da camiseta', 'type' => 'SELECT', 'value' => 'M'],
        ['key' => 'recado', 'label' => 'Recado', 'type' => 'TEXT', 'value' => 'Levo violão'],
        ['key' => 'historia', 'label' => 'Sua história', 'type' => 'TEXTAREA', 'value' => 'Conheci a igreja em 2020.'],
        ['key' => 'idade', 'label' => 'Idade', 'type' => 'NUMBER', 'value' => 34],
        ['key' => 'nascimento', 'label' => 'Nascimento', 'type' => 'DATE', 'value' => '1992-03-14'],
        ['key' => 'dias', 'label' => 'Dias que vai', 'type' => 'MULTISELECT', 'value' => ['Sexta', 'Domingo']],
        ['key' => 'carona', 'label' => 'Precisa de carona', 'type' => 'BOOLEAN', 'value' => true],
    ]);
});

it('BR-024 guarda o rótulo da época: renomear o campo depois não muda a inscrição', function () {
    $event = openEvent(['form_schema' => [['key' => 'camiseta', 'label' => 'Tamanho', 'type' => 'SELECT', 'required' => true, 'options' => ['P', 'M']]]]);
    postJson('/api/public/events/acampamento/register', registrationBody(['answers' => ['camiseta' => 'P']]))->assertCreated();

    $event->update(['form_schema' => [['key' => 'camiseta', 'label' => 'Tamanho da camisa', 'type' => 'SELECT', 'required' => true, 'options' => ['P', 'M']]]]);

    expect(EventRegistration::query()->sole()->answers[0]['label'])->toBe('Tamanho');
});

it('BR-024 campo opcional sem resposta fica vazio, e o de marcar fica falso', function () {
    openEvent(['form_schema' => everyFieldType()]);

    postJson('/api/public/events/acampamento/register', registrationBody(['answers' => ['camiseta' => 'G', 'idade' => '42']]))->assertCreated();

    $values = collect(EventRegistration::query()->sole()->answers)->pluck('value', 'key')->all();
    expect($values)->toBe(['camiseta' => 'G', 'recado' => null, 'historia' => null, 'idade' => 42, 'nascimento' => null, 'dias' => null, 'carona' => false]);
});

it('BR-024 recusa a resposta inválida, com a regra violada no próprio campo', function (array $answers, string $field, string $message) {
    openEvent(['form_schema' => everyFieldType()]);

    postJson('/api/public/events/acampamento/register', registrationBody(['answers' => [...validAnswers(), ...$answers]]))
        ->assertUnprocessable()
        ->assertJsonPath('error.details.0.field', "answers.{$field}")
        ->assertJsonPath('error.details.0.message', $message);

    expect(EventRegistration::query()->count())->toBe(0);
})->with([
    'obrigatório ausente' => [['camiseta' => null], 'camiseta', 'Este campo é obrigatório.'],
    'obrigatório em branco' => [['idade' => '  '], 'idade', 'Este campo é obrigatório.'],
    'opção que não existe' => [['camiseta' => 'GG'], 'camiseta', 'Escolha uma das opções.'],
    'número abaixo do mínimo' => [['idade' => 4], 'idade', 'Informe um número entre 5 e 90.'],
    'número acima do máximo' => [['idade' => '91'], 'idade', 'Informe um número entre 5 e 90.'],
    'número que não é número' => [['idade' => 'trinta'], 'idade', 'Informe uma resposta válida.'],
    'data que não existe' => [['nascimento' => '1992-02-31'], 'nascimento', 'Informe uma data válida.'],
    'data fora do formato' => [['nascimento' => '14/03/1992'], 'nascimento', 'Informe uma data válida.'],
    'texto longo demais' => [['recado' => str_repeat('a', 201)], 'recado', 'Use no máximo 200 caracteres.'],
    'texto longo demais (área)' => [['historia' => str_repeat('a', 2001)], 'historia', 'Use no máximo 2000 caracteres.'],
    'várias opções, uma inválida' => [['dias' => ['Sexta', 'Segunda']], 'dias', 'Escolha uma das opções.'],
    'várias opções, mas veio texto' => [['dias' => 'Sexta'], 'dias', 'Escolha uma das opções.'],
    'marcar com texto' => [['carona' => 'sim'], 'carona', 'Informe uma resposta válida.'],
]);

it('BR-024 campo de marcar obrigatório exige marcar', function () {
    openEvent(['form_schema' => [['key' => 'termo', 'label' => 'Li o regulamento', 'type' => 'BOOLEAN', 'required' => true]]]);

    postJson('/api/public/events/acampamento/register', registrationBody(['answers' => ['termo' => false]]))
        ->assertUnprocessable()->assertJsonPath('error.details.0.field', 'answers.termo');
    postJson('/api/public/events/acampamento/register', registrationBody(['answers' => ['termo' => true]]))->assertCreated();
});

it('BR-024 respeita o mínimo e o máximo de caracteres do campo de texto', function () {
    openEvent(['form_schema' => [['key' => 'apelido', 'label' => 'Apelido', 'type' => 'TEXT', 'required' => true, 'min' => 3, 'max' => 5]]]);

    postJson('/api/public/events/acampamento/register', registrationBody(['answers' => ['apelido' => 'ab']]))
        ->assertUnprocessable()->assertJsonPath('error.details.0.message', 'Use pelo menos 3 caracteres.');
    postJson('/api/public/events/acampamento/register', registrationBody(['answers' => ['apelido' => 'abcdef']]))
        ->assertUnprocessable()->assertJsonPath('error.details.0.message', 'Use no máximo 5 caracteres.');
    postJson('/api/public/events/acampamento/register', registrationBody(['answers' => ['apelido' => 'abcde']]))->assertCreated();
});

it('BR-024 número com só o mínimo ou só o máximo diz qual é o limite', function () {
    openEvent(['form_schema' => [
        ['key' => 'a', 'label' => 'A', 'type' => 'NUMBER', 'required' => false, 'min' => 10],
        ['key' => 'b', 'label' => 'B', 'type' => 'NUMBER', 'required' => false, 'max' => 3],
    ]]);

    $response = postJson('/api/public/events/acampamento/register', registrationBody(['answers' => ['a' => 9, 'b' => 4]]))->assertUnprocessable();

    expect(collect($response->json('error.details'))->pluck('message', 'field')->all())->toBe([
        'answers.a' => 'Informe um número a partir de 10.',
        'answers.b' => 'Informe um número de até 3.',
    ]);
});

it('BR-024 aceita número decimal com vírgula', function () {
    openEvent(['form_schema' => [['key' => 'altura', 'label' => 'Altura (m)', 'type' => 'NUMBER', 'required' => true, 'min' => 0.5, 'max' => 2.5]]]);

    postJson('/api/public/events/acampamento/register', registrationBody(['answers' => ['altura' => '1,75']]))->assertCreated();

    expect(EventRegistration::query()->sole()->answers[0]['value'])->toBe(1.75);
});

it('as respostas ficam cifradas no banco (ADR-016)', function () {
    openEvent(['form_schema' => [['key' => 'recado', 'label' => 'Recado', 'type' => 'TEXT', 'required' => true]]]);

    postJson('/api/public/events/acampamento/register', registrationBody(['answers' => ['recado' => 'Tenho alergia a amendoim']]))->assertCreated();

    expect((string) DB::table('event_registrations')->value('answers'))->not->toContain('amendoim');
});

it('BR-083 com campo de saúde exige o consentimento específico e grava o momento dele', function () {
    openEvent(['form_schema' => [['key' => 'alergias', 'label' => 'Alergias', 'type' => 'TEXT', 'required' => false, 'sensitive' => true]]]);
    $body = registrationBody(['answers' => ['alergias' => 'Amendoim']]);

    foreach ([[], ['health_consent' => null], ['health_consent' => false]] as $health) {
        postJson('/api/public/events/acampamento/register', [...$body, ...$health])
            ->assertUnprocessable()
            ->assertJsonPath('error.details.0.field', 'health_consent')
            ->assertJsonPath('error.details.0.message', 'Para continuar, autorize o uso das informações de saúde.');
    }
    expect(EventRegistration::query()->count())->toBe(0);

    postJson('/api/public/events/acampamento/register', [...$body, 'health_consent' => true])->assertCreated();

    $registration = EventRegistration::query()->sole();
    expect($registration->health_consent_at->equalTo(now()))->toBeTrue()
        ->and($registration->consent_at->equalTo($registration->health_consent_at))->toBeTrue();
});

it('BR-083 sem campo de saúde o consentimento é ignorado e o momento fica nulo', function () {
    openEvent(['form_schema' => [['key' => 'camiseta', 'label' => 'Camiseta', 'type' => 'TEXT', 'required' => false]]]);

    postJson('/api/public/events/acampamento/register', registrationBody(['health_consent' => true]))->assertCreated();

    expect(EventRegistration::query()->sole()->health_consent_at)->toBeNull();
});

it('BR-083 vale o formulário do instante da inscrição: campo de saúde acrescentado depois passa a exigir o consentimento', function () {
    $event = openEvent();
    postJson('/api/public/events/acampamento/register', registrationBody())->assertCreated();

    $event->update(['form_schema' => [['key' => 'remedio', 'label' => 'Remédio', 'type' => 'TEXT', 'required' => false, 'sensitive' => true]]]);

    postJson('/api/public/events/acampamento/register', registrationBody(['participant_name' => 'Bia Lima']))->assertUnprocessable();
    expect(EventRegistration::query()->whereNotNull('health_consent_at')->count())->toBe(0);
});

it('enfileira a confirmação só com e-mail, na hora da inscrição, e sem as respostas', function () {
    openEvent(['title' => 'Acampamento de Carnaval', 'location' => 'Chácara Boa Vista', 'form_schema' => [['key' => 'alergias', 'label' => 'Alergias', 'type' => 'TEXT', 'required' => false, 'sensitive' => true]]]);

    postJson('/api/public/events/acampamento/register', registrationBody(['email' => null, 'answers' => ['alergias' => 'Amendoim'], 'health_consent' => true]))->assertCreated();
    expect(DB::table('jobs')->count())->toBe(0);

    postJson('/api/public/events/acampamento/register', registrationBody(['participant_name' => 'Bia Lima', 'phone' => '31988887777', 'email' => 'bia@example.com', 'answers' => ['alergias' => 'Amendoim'], 'health_consent' => true]))->assertCreated();
    expect(DB::table('jobs')->count())->toBe(1);

    Artisan::call('queue:work', ['--stop-when-empty' => true]);

    $messages = app('mailer')->getSymfonyTransport()->messages();
    expect($messages)->toHaveCount(1);
    $message = $messages->first()->getOriginalMessage();
    expect($message->getTo()[0]->getAddress())->toBe('bia@example.com')
        ->and($message->getSubject())->toBe('Inscrição confirmada: Acampamento de Carnaval')
        ->and($message->getTextBody())->toContain('Bia Lima')->toContain('05/12/2026 às 09h00')->toContain('Chácara Boa Vista')->toContain('/eventos/acampamento')
        ->and($message->getTextBody().$message->getHtmlBody())->not->toContain('Amendoim');
});

it('FR-019 a falha do SMTP não desfaz a inscrição: o e-mail fica na fila para nova tentativa', function () {
    openEvent();
    Mail::extend('smtp-fora-do-ar', fn () => new class extends AbstractTransport
    {
        protected function doSend(SentMessage $message): void
        {
            throw new TransportException('SMTP indisponível');
        }

        public function __toString(): string
        {
            return 'smtp-fora-do-ar';
        }
    });
    config(['mail.default' => 'falha', 'mail.mailers.falha' => ['transport' => 'smtp-fora-do-ar']]);

    postJson('/api/public/events/acampamento/register', registrationBody())->assertCreated();
    Artisan::call('queue:work', ['--once' => true]);

    expect(EventRegistration::query()->count())->toBe(1)
        ->and(DB::table('jobs')->count())->toBe(1)
        ->and(DB::table('failed_jobs')->count())->toBe(0);
});

it('a inscrição cancelada antes do envio não recebe a confirmação (BR-034)', function () {
    openEvent();
    postJson('/api/public/events/acampamento/register', registrationBody())->assertCreated();

    EventRegistration::query()->sole()->delete();
    Artisan::call('queue:work', ['--stop-when-empty' => true]);

    expect(app('mailer')->getSymfonyTransport()->messages())->toHaveCount(0)
        ->and(DB::table('failed_jobs')->count())->toBe(0)
        ->and(DB::table('jobs')->count())->toBe(0);
});

it('a transação desfaz tudo junto: se a fila falha depois de gravar, nem a inscrição nem o e-mail ficam', function () {
    openEvent();
    Illuminate\Support\Facades\Event::listen(RegistrationCreated::class, function () {
        throw new RuntimeException('falha no meio da transação');
    });

    $this->withoutExceptionHandling();
    try {
        postJson('/api/public/events/acampamento/register', registrationBody());
    } catch (RuntimeException) {
        // esperado
    }

    expect(EventRegistration::query()->count())->toBe(0)->and(DB::table('jobs')->count())->toBe(0);
});
