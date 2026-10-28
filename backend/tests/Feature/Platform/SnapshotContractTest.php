<?php

declare(strict_types=1);

use App\Modules\Content\Models\Bulletin;
use App\Modules\Content\Models\PalavraVivaPost;
use App\Modules\Content\Models\SiteSetting;
use App\Modules\Ministries\Models\MinistryGroup;
use App\Modules\Platform\Snapshots\SnapshotRegenerator;
use App\Modules\Platform\Snapshots\SnapshotRegistry;
use App\Modules\Platform\Snapshots\SnapshotWriter;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\File;

use function Pest\Laravel\getJson;

/*
| contracts/snapshots.md → Testes obrigatórios: snapshot = API (mesmo serializador) para os três arquivos, e nenhum
| campo interno nem conteúdo agendado no arquivo (BR-042, BR-048, BR-050).
*/

beforeEach(function () {
    $this->snapshotDir = sys_get_temp_dir().'/pibls-contract-'.bin2hex(random_bytes(4));
    config(['pibls.snapshots_path' => $this->snapshotDir]);
    app()->forgetInstance(SnapshotWriter::class);
    app()->forgetInstance(SnapshotRegenerator::class);
});

afterEach(function () {
    File::deleteDirectory($this->snapshotDir);
});

/** @return array<array-key, mixed> */
function snapshotFile(string $dir, string $name): array
{
    return json_decode((string) file_get_contents("{$dir}/{$name}.json"), true, flags: JSON_THROW_ON_ERROR);
}

it('registra os três snapshots públicos', function () {
    expect(array_keys(app(SnapshotRegistry::class)->all()))->toEqualCanonicalizing(['settings', 'ministries', 'home']);
});

it('settings.json é igual a GET /api/public/settings', function () {
    app(SnapshotRegenerator::class)->refresh(['settings']);

    expect(snapshotFile($this->snapshotDir, 'settings')['data'])
        ->toBe(getJson('/api/public/settings')->assertOk()->json('data'));
});

it('ministries.json é igual a GET /api/public/ministries sem filtros', function () {
    MinistryGroup::factory()->count(2)->create();
    MinistryGroup::factory()->cell()->create();
    MinistryGroup::factory()->inactive()->create();
    app(SnapshotRegenerator::class)->refresh(['ministries']);

    expect(snapshotFile($this->snapshotDir, 'ministries')['data'])
        ->toBe(getJson('/api/public/ministries')->assertOk()->json('data'));
});

it('BR-048 e BR-050: nenhum campo interno aparece em nenhum dos arquivos', function () {
    MinistryGroup::factory()->cell()->create(['private_address' => 'Rua Secreta, 77', 'contact_email' => 'celula@example.com']);
    SiteSetting::query()->where('key', 'notification_recipients')->update([
        'value' => json_encode(['VISITANTE' => ['secretaria@example.com'], 'MEMBRO' => [], 'ORACAO' => [], 'CONTATO' => [], 'MINISTERIO' => []]),
    ]);
    app(SnapshotRegenerator::class)->refresh();

    foreach (['settings', 'ministries', 'home'] as $name) {
        expect((string) file_get_contents("{$this->snapshotDir}/{$name}.json"))
            ->not->toContain('private_address')->not->toContain('Rua Secreta')
            ->not->toContain('contact_email')->not->toContain('celula@example.com')
            ->not->toContain('notification_recipients')->not->toContain('secretaria@example.com');
    }
});

it('home.json traz o último boletim, as 3 últimas mensagens e eventos vazios com a flag desligada', function () {
    config(['features.events' => false]);
    Bulletin::factory()->create(['edition_number' => 1, 'reference_date' => '2026-09-06', 'published_at' => '2026-09-06 10:00:00']);
    $latest = Bulletin::factory()->create(['edition_number' => 2, 'reference_date' => '2026-10-04', 'title' => 'Boletim da semana', 'published_at' => '2026-10-04 10:00:00']);
    foreach (range(1, 4) as $i) {
        PalavraVivaPost::factory()->create(['title' => "Mensagem {$i}", 'published_at' => "2026-10-0{$i} 09:00:00"]);
    }
    app(SnapshotRegenerator::class)->refresh(['home']);

    $home = snapshotFile($this->snapshotDir, 'home')['data'];

    expect($home['latest_bulletin']['id'])->toBe($latest->id)
        ->and($home['latest_bulletin'])->toHaveKeys(['id', 'edition_number', 'reference_date', 'title', 'summary_text', 'pdf_url', 'pdf_size_bytes'])
        ->and($home['latest_bulletin']['reference_date'])->toBe('2026-10-04')
        ->and($home['latest_bulletin']['pdf_url'])->toStartWith('/uploads/')
        ->and(array_column($home['latest_posts'], 'title'))->toBe(['Mensagem 4', 'Mensagem 3', 'Mensagem 2'])
        ->and($home['latest_posts'][0])->toHaveKeys(['id', 'title', 'slug', 'excerpt', 'author_display', 'youtube_video_id', 'published_at'])
        ->and($home['upcoming_events'])->toBe([]);
});

it('home.json tem latest_bulletin nulo e listas vazias quando não há conteúdo', function () {
    app(SnapshotRegenerator::class)->refresh(['home']);

    expect(snapshotFile($this->snapshotDir, 'home')['data'])
        ->toBe(['latest_bulletin' => null, 'latest_posts' => [], 'upcoming_events' => []]);
});

it('BR-042 conteúdo agendado só entra no home.json depois do horário, pela regeneração agendada', function () {
    $publishAt = CarbonImmutable::parse('2026-11-08 12:00:00', 'UTC');
    $this->travelTo($publishAt->subHour());
    Bulletin::factory()->create(['title' => 'Boletim futuro', 'published_at' => $publishAt]);
    PalavraVivaPost::factory()->create(['title' => 'Mensagem futura', 'published_at' => $publishAt]);

    app(SnapshotRegenerator::class)->refresh(['home']);
    expect((string) file_get_contents("{$this->snapshotDir}/home.json"))
        ->not->toContain('Boletim futuro')->not->toContain('Mensagem futura');

    $definition = app(SnapshotRegistry::class)->all()['home'];
    expect($definition->hasScheduledChange($publishAt->subHour(), $publishAt->subMinute()))->toBeFalse()
        ->and($definition->hasScheduledChange($publishAt->subMinute(), $publishAt->addMinute()))->toBeTrue();

    $this->travelTo($publishAt->addMinute());
    app(SnapshotRegenerator::class)->refresh(['home']);

    expect((string) file_get_contents("{$this->snapshotDir}/home.json"))
        ->toContain('Boletim futuro')->toContain('Mensagem futura');
});

it('ignora boletim e mensagem excluídos', function () {
    Bulletin::factory()->create()->delete();
    PalavraVivaPost::factory()->create()->delete();
    app(SnapshotRegenerator::class)->refresh(['home']);

    expect(snapshotFile($this->snapshotDir, 'home')['data'])->toMatchArray(['latest_bulletin' => null, 'latest_posts' => []]);
});
