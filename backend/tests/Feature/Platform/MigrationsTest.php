<?php

declare(strict_types=1);

use App\Modules\Content\Models\Bulletin;
use App\Modules\Content\Models\PalavraVivaPost;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
| Schema completo (R1 + R2) e dados obrigatórios das migrations. O passo `migrate:fresh` → `migrate:rollback` → `migrate`
| roda no CI, nas duas versões do MySQL (ver .github/workflows/ci.yml).
*/

it('cria as 13 tabelas de domínio e as de infraestrutura do Laravel', function () {
    $domain = [
        'users', 'permissions', 'role_templates', 'user_permissions', 'ministries_groups', 'bulletins',
        'palavra_viva_posts', 'site_settings', 'leads_messages', 'lead_activities', 'events',
        'event_registrations', 'audit_logs',
    ];
    $infrastructure = ['sessions', 'password_reset_tokens', 'jobs', 'failed_jobs', 'cache', 'cache_locks', 'migrations'];

    foreach ([...$domain, ...$infrastructure] as $table) {
        expect(Schema::hasTable($table))->toBeTrue("tabela {$table} ausente");
    }
});

it('usa InnoDB, utf8mb4 e a collation utf8mb4_unicode_ci nas tabelas de domínio', function () {
    $rows = DB::select(
        'SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_COLLATION AS collation
         FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?)',
        ['users', 'leads_messages', 'audit_logs'],
    );

    expect($rows)->toHaveCount(3);
    foreach ($rows as $row) {
        expect($row->engine)->toBe('InnoDB')->and($row->collation)->toBe('utf8mb4_unicode_ci');
    }
});

it('BR-040 aceita a mesma edição de boletim só depois da exclusão lógica da anterior', function () {
    Bulletin::factory()->create(['edition_number' => 7]);

    expect(fn () => Bulletin::factory()->create(['edition_number' => 7]))->toThrow(QueryException::class);

    Bulletin::query()->where('edition_number', 7)->firstOrFail()->delete();

    expect(Bulletin::factory()->create(['edition_number' => 7]))->toBeInstanceOf(Bulletin::class);
});

it('BR-032 aceita o mesmo slug de mensagem só depois da exclusão lógica da anterior', function () {
    PalavraVivaPost::factory()->create(['slug' => 'graca-e-paz']);

    expect(fn () => PalavraVivaPost::factory()->create(['slug' => 'graca-e-paz']))->toThrow(QueryException::class);

    PalavraVivaPost::query()->where('slug', 'graca-e-paz')->firstOrFail()->delete();

    expect(PalavraVivaPost::factory()->create(['slug' => 'graca-e-paz']))->toBeInstanceOf(PalavraVivaPost::class);
});

it('BR-047 impede apagar no banco um ministério referenciado (FK RESTRICT)', function () {
    $ministry = MinistryGroup::factory()->create();
    DB::table('events')->insert([
        'title' => 'Evento', 'slug' => 'evento-restrict', 'ministry_id' => $ministry->getKey(),
        'description' => '<p>x</p>', 'excerpt' => 'x', 'starts_at' => now()->addDay(), 'location' => 'Templo',
        'form_schema' => '[]',
    ]);

    expect(fn () => DB::table('ministries_groups')->where('id', $ministry->getKey())->delete())
        ->toThrow(QueryException::class);
});

it('semeia as 14 permissões e a matriz dos 7 papéis de referência', function () {
    expect(DB::table('permissions')->count())->toBe(14)
        ->and(DB::table('permissions')->where('is_own_scope', true)->pluck('key')->sort()->values()->all())
        ->toBe(['eventos.inscricoes.read.own', 'eventos.write.own']);

    $perRole = DB::table('role_templates')->selectRaw('role_code, COUNT(*) AS total')->groupBy('role_code')
        ->pluck('total', 'role_code')->all();

    expect($perRole)->toBe([
        'ADMIN_TECNICO' => 1,
        'COMUNICACAO' => 6,
        'LIDER_MINISTERIO' => 2,
        'ORACAO' => 2,
        'PASTORAL' => 4,
        'SECRETARIA' => 5,
        'TESOURARIA' => 1,
    ]);
});

it('BR-050 semeia todas as chaves de configuração e só notification_recipients é privada', function () {
    $keys = DB::table('site_settings')->pluck('is_public', 'key')->map(fn ($v) => (bool) $v)->all();

    expect(array_keys($keys))->toEqualCanonicalizing([
        'schedule', 'campaign_notice', 'lords_supper_notice', 'address', 'map_links', 'whatsapp',
        'youtube_links', 'social_links', 'notification_recipients', 'pix',
    ])->and(array_keys(array_filter($keys, fn (bool $public) => ! $public)))->toBe(['notification_recipients']);

    $pix = json_decode((string) DB::table('site_settings')->where('key', 'pix')->value('value'), true);
    expect($pix['pix_key'])->toBe('20969119000184');
});

it('semeia o catálogo inicial de ministérios e grupos', function () {
    expect(MinistryGroup::query()->where('category', 'MINISTERIO')->count())->toBe(22)
        ->and(MinistryGroup::query()->where('category', 'GRUPO')->count())->toBe(4);
});

it('Q-04 semeia a liderança dos 22 ministérios, como no Guia Institucional, e nenhuma nos grupos', function () {
    $leaders = MinistryGroup::query()->where('category', 'MINISTERIO')->pluck('leaders_text', 'name');

    expect($leaders->filter()->count())->toBe(22)
        ->and($leaders['Oração'])->toBe('Dirce Rodrigues Pinheiro')
        ->and($leaders['Patrimônio'])->toBe('Coordenador: Reynaldo Afonso Chaves · Vice: Carlos Roberto Soares')
        ->and($leaders['Mensageiras do Rei'])->toContain('Djane A. Q. Dias Gomes e Elisiane')
        ->and(MinistryGroup::query()->where('category', 'GRUPO')->whereNotNull('leaders_text')->count())->toBe(0);
});

it('as migrations de seed são idempotentes: rodar de novo não duplica nem desfaz edição', function () {
    DB::table('site_settings')->where('key', 'campaign_notice')->update(['value' => json_encode(['active' => false])]);

    foreach (glob(database_path('migrations/*_seed_*.php')) ?: [] as $file) {
        $migration = require $file;
        expect($migration)->toBeInstanceOf(Migration::class);
        $migration->up();
    }

    expect(DB::table('permissions')->count())->toBe(14)
        ->and(DB::table('role_templates')->count())->toBe(21)
        ->and(DB::table('site_settings')->count())->toBe(10)
        ->and(MinistryGroup::query()->count())->toBe(26)
        ->and(DB::table('site_settings')->where('key', 'campaign_notice')->value('value'))->toBe('{"active": false}');
});
