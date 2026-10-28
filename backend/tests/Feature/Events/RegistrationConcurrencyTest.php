<?php

declare(strict_types=1);

use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Process\Pool;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;

/*
| Garantia de vaga e de não duplicidade sob concorrência (T180, E-02; Constituição V). Processos PHP de verdade, cada um
| com a sua conexão ao MySQL, disparam a inscrição no mesmo instante: o bloqueio da linha do evento (`SELECT … FOR UPDATE`)
| mais a constraint única decidem. Teste bloqueante antes de ligar o R2.
|
| Os dados são gravados (commit) por uma segunda conexão, porque os processos filhos não enxergam o que está dentro da
| transação do teste, e removidos no fim.
*/

beforeEach(function () {
    config(['database.connections.committed' => config('database.connections.mysql')]);
    $this->ministryId = MinistryGroup::factory()->connection('committed')->create()->getKey();
});

afterEach(function () {
    $db = DB::connection('committed');
    $db->table('event_registrations')->delete();
    $db->table('events')->delete();
    $db->table('ministries_groups')->where('id', $this->ministryId)->delete();
    DB::purge('committed');
});

/**
 * @param  array<string, mixed>  $overrides
 */
function committedEvent(int $ministryId, array $overrides = []): Event
{
    return Event::factory()->published()->connection('committed')->create([
        'slug' => 'rajada',
        'ministry_id' => $ministryId,
        'starts_at' => now()->addDays(20),
        ...$overrides,
    ]);
}

/**
 * Dispara uma inscrição por processo, todas no mesmo instante, e devolve o resultado de cada uma.
 *
 * @param  list<array{0: string, 1: string}>  $people  nome e telefone de cada tentativa
 * @return list<string>
 */
function fireTogether(string $slug, array $people): array
{
    $at = microtime(true) + 4; // dá tempo de todos os processos subirem a aplicação
    $env = [
        'APP_ENV' => 'testing',
        'DB_DATABASE' => (string) config('database.connections.mysql.database'),
        'QUEUE_CONNECTION' => 'sync',
        'MAIL_MAILER' => 'array',
        'CACHE_STORE' => 'array',
        'SESSION_DRIVER' => 'array',
        'LOG_CHANNEL' => 'null',
        'SENTRY_LARAVEL_DSN' => '',
    ];

    $results = Process::pool(function (Pool $pool) use ($slug, $people, $at, $env) {
        foreach ($people as $index => [$name, $phone]) {
            $pool->as((string) $index)->timeout(60)->env($env)->path(base_path())->command([PHP_BINARY, base_path('tests/Support/register-for-event.php'), $slug, $name, $phone, (string) $at]);
        }
    })->start()->wait();

    return array_values(array_map(fn ($result) => trim($result->output()).trim($result->errorOutput()), iterator_to_array($results)));
}

it('BR-021 com N vagas e mais de N envios simultâneos, exatamente N inscrições são aceitas', function () {
    committedEvent($this->ministryId, ['max_spots' => 5]);
    $people = array_map(fn (int $i) => ["Pessoa {$i} Teste", '3198'.str_pad((string) (1000000 + $i), 7, '0')], range(1, 14));

    $results = fireTogether('rajada', $people);
    $counts = array_count_values($results);

    expect($counts)->toEqual(['created' => 5, 'EVENT_FULL' => 9])
        ->and(DB::connection('committed')->table('event_registrations')->count())->toBe(5);
})->group('concurrency');

it('BR-022 envios simultâneos da mesma pessoa, variando maiúsculas, acentos e espaços, resultam em exatamente 1 inscrição', function () {
    committedEvent($this->ministryId, ['max_spots' => null]);
    $names = ['José da Conceição', 'JOSÉ DA CONCEIÇÃO', 'jose da conceicao', '  José   da  Conceição ', 'José da Conceicão', 'JOSE DA CONCEICAO'];
    $people = array_map(fn (string $name) => [$name, '(31) 99888-7777'], [...$names, ...$names]);

    $results = fireTogether('rajada', $people);
    $counts = array_count_values($results);

    expect($counts)->toEqual(['created' => 1, 'DUPLICATE_REGISTRATION' => 11])
        ->and(DB::connection('committed')->table('event_registrations')->count())->toBe(1);
})->group('concurrency');

it('nome diferente com o mesmo telefone, em rajada, é aceito para cada nome e a vaga conta uma vez cada', function () {
    committedEvent($this->ministryId, ['max_spots' => 3]);
    $people = [['Ana Souza', '31999990001'], ['Bia Souza', '31999990001'], ['Caio Souza', '31999990001'], ['Duda Souza', '31999990001'], ['Ana Souza', '31999990001']];

    $counts = array_count_values(fireTogether('rajada', $people));

    expect($counts['created'])->toBe(3)
        ->and(EventRegistration::on('committed')->count())->toBe(3);
})->group('concurrency');
