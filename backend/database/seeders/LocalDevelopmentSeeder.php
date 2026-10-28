<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Access\Models\User;
use App\Modules\Content\Models\Bulletin;
use App\Modules\Content\Models\PalavraVivaPost;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use App\Modules\Leads\Models\Lead;
use App\Modules\Leads\Models\LeadActivity;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Dados falsos e um usuário por papel de referência, só para desenvolvimento local e CI.
 * Usuários reais nunca entram por aqui: em produção são criados pelo phpMyAdmin (BR-077).
 */
class LocalDevelopmentSeeder extends Seeder
{
    /** @var array<string, array{email: string, name: string}> */
    private const ROLE_USERS = [
        'COMUNICACAO' => ['email' => 'comunicacao@pibls.test', 'name' => 'Teste Comunicação'],
        'SECRETARIA' => ['email' => 'secretaria@pibls.test', 'name' => 'Teste Secretaria'],
        'TESOURARIA' => ['email' => 'tesouraria@pibls.test', 'name' => 'Teste Tesouraria'],
        'ORACAO' => ['email' => 'oracao@pibls.test', 'name' => 'Teste Oração'],
        'PASTORAL' => ['email' => 'pastoral@pibls.test', 'name' => 'Teste Pastoral'],
        'LIDER_MINISTERIO' => ['email' => 'lider@pibls.test', 'name' => 'Teste Líder de Ministério'],
        'ADMIN_TECNICO' => ['email' => 'admin@pibls.test', 'name' => 'Teste Administrador Técnico'],
    ];

    /**
     * Usuário só dos testes de ponta a ponta da redefinição de senha: muda a senha duas vezes e a devolve ao valor
     * original, sem nunca tocar nos sete usuários de papel (que os outros testes usam). Fora do domínio `@pibls.test`.
     */
    private const PASSWORD_RESET_USER = [
        'email' => 'redefinicao@pibls.example',
        'name' => 'Teste Redefinição de Senha',
        'role' => 'ORACAO',
    ];

    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('O LocalDevelopmentSeeder grava dados falsos e não roda em produção.');
        }

        $password = config('pibls.test_users_password');
        if (! is_string($password) || $password === '') {
            throw new RuntimeException('Defina TEST_USERS_PASSWORD no .env para criar os usuários de teste.');
        }

        $ministry = MinistryGroup::query()->where('category', 'MINISTERIO')->orderBy('display_order')->firstOrFail();

        $accounts = [];
        foreach (self::ROLE_USERS as $roleCode => $attributes) {
            $accounts[] = [$roleCode, $attributes['email'], $attributes['name']];
        }
        $accounts[] = [self::PASSWORD_RESET_USER['role'], self::PASSWORD_RESET_USER['email'], self::PASSWORD_RESET_USER['name']];

        foreach ($accounts as [$roleCode, $email, $name]) {
            $user = User::query()->where('email', $email)->first()
                ?? User::factory()->create([
                    'email' => $email,
                    'name' => $name,
                    'password' => $password,
                    // Só o líder de ministério usa permissões `.own`, que exigem ministério vinculado (BR-075)
                    'ministry_id' => $roleCode === 'LIDER_MINISTERIO' ? $ministry->getKey() : null,
                ]);

            // Mesma instrução do runbook de provisionamento; a aplicação em si nunca grava aqui (BR-077)
            DB::statement(
                'INSERT IGNORE INTO user_permissions (user_id, role_code, permission_key)
                 SELECT ?, role_code, permission_key FROM role_templates WHERE role_code = ?',
                [$user->getKey(), $roleCode],
            );
        }

        $this->seedContent($ministry);
    }

    private function seedContent(MinistryGroup $ministry): void
    {
        if (Bulletin::query()->exists() || Lead::query()->exists()) {
            return; // já populado: rodar de novo não duplica
        }

        MinistryGroup::factory()->cell()->count(3)->create();

        Bulletin::factory()->count(8)->create();
        Bulletin::factory()->scheduled()->create();

        PalavraVivaPost::factory()->count(5)->create();
        PalavraVivaPost::factory()->scheduled()->create();

        $actor = User::query()->where('email', self::ROLE_USERS['SECRETARIA']['email'])->firstOrFail();

        Lead::factory()->visitante()->count(2)->create();
        Lead::factory()->membro()->create();
        Lead::factory()->oracao()->count(2)->create();
        Lead::factory()->ministerio($ministry)->create();
        Lead::factory()->count(2)->create();
        // Contatos parados há mais de 3 dias aparecem em destaque na caixa (BR-010)
        Lead::factory()->waitingDays(5)->create();

        $inProgress = Lead::factory()->create([
            'status' => 'EM_ATENDIMENTO',
            'assigned_to' => $actor->getKey(),
        ]);
        LeadActivity::factory()->create([
            'lead_id' => $inProgress->getKey(),
            'actor_user_id' => $actor->getKey(),
            'from_status' => 'NOVO',
            'to_status' => 'EM_ATENDIMENTO',
            'assigned_to' => $actor->getKey(),
            'note' => 'Primeiro contato feito por telefone.',
        ]);

        $event = Event::factory()->published()->create(['ministry_id' => $ministry->getKey()]);
        EventRegistration::factory()->count(3)->create(['event_id' => $event->getKey()]);
        Event::factory()->create(['ministry_id' => $ministry->getKey()]);
    }
}
