<?php

declare(strict_types=1);

use App\Modules\Content\Models\SiteSetting;
use App\Modules\Leads\Events\LeadReceived;
use App\Modules\Leads\Models\Lead;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;

use function Pest\Laravel\postJson;

/*
| Roteamento dos avisos (architecture.md → CAP-05 → Roteamento da notificação; RF-D07). Os e-mails vão pela fila do MySQL,
| gravados na mesma transação do contato (ADR-003).
*/

/** @param array<string, list<string>> $recipients */
function setRecipients(array $recipients): void
{
    $all = ['VISITANTE' => [], 'MEMBRO' => [], 'ORACAO' => [], 'CONTATO' => [], 'MINISTERIO' => [], ...$recipients];
    SiteSetting::query()->where('key', 'notification_recipients')->update(['value' => json_encode($all)]);
}

/** @return list<string> destinatários dos jobs na fila */
function queuedRecipients(): array
{
    return DB::table('jobs')->pluck('payload')
        ->map(function (string $payload) {
            preg_match('/[\w.+-]+@[\w-]+\.[\w.]+/', (string) json_decode($payload, true)['data']['command'], $match);

            return $match[0] ?? '';
        })
        ->sort()->values()->all();
}

beforeEach(function () {
    config(['queue.default' => 'database']);
});

it('enfileira um e-mail por destinatário da lista do tipo, na hora do envio', function () {
    setRecipients(['CONTATO' => ['secretaria@pibls.test', 'pastor@pibls.test', 'diacono@pibls.test']]);

    postJson('/api/public/leads', ['type' => 'CONTATO', 'name' => 'Ana Costa', 'email' => 'ana@example.com', 'message' => 'Preciso de ajuda.', 'consent' => true])->assertCreated();

    expect(DB::table('jobs')->count())->toBe(3)
        ->and(queuedRecipients())->toBe(['diacono@pibls.test', 'pastor@pibls.test', 'secretaria@pibls.test']);
});

it('cada tipo usa a lista do próprio tipo', function () {
    setRecipients(['VISITANTE' => ['acolhimento@pibls.test'], 'MEMBRO' => ['secretaria@pibls.test'], 'ORACAO' => ['oracao@pibls.test']]);

    postJson('/api/public/leads', ['type' => 'VISITANTE', 'name' => 'Maria Souza', 'phone' => '31999998888', 'neighborhood' => 'Centro', 'wants_visit' => true, 'wants_cell_group' => true, 'consent' => true])->assertCreated();
    expect(queuedRecipients())->toBe(['acolhimento@pibls.test']);

    DB::table('jobs')->delete();
    postJson('/api/public/leads', ['type' => 'ORACAO', 'message' => 'Peço oração.', 'consent' => true])->assertCreated();
    expect(queuedRecipients())->toBe(['oracao@pibls.test']);
});

it('MINISTERIO vai para o e-mail de contato do ministério e não para a lista do tipo', function () {
    setRecipients(['MINISTERIO' => ['secretaria@pibls.test']]);
    $ministry = MinistryGroup::factory()->create(['contact_email' => 'musica@pibls.test']);

    postJson('/api/public/leads', ['type' => 'MINISTERIO', 'name' => 'Paulo Reis', 'phone' => '31977776666', 'ministry_id' => $ministry->id, 'message' => 'Quero servir.', 'consent' => true])->assertCreated();

    expect(queuedRecipients())->toBe(['musica@pibls.test']);
});

it('MINISTERIO sem e-mail de contato cai na lista configurada para o tipo', function () {
    setRecipients(['MINISTERIO' => ['secretaria@pibls.test', 'pastor@pibls.test']]);
    $ministry = MinistryGroup::factory()->create(['contact_email' => null]);

    postJson('/api/public/leads', ['type' => 'MINISTERIO', 'name' => 'Paulo Reis', 'phone' => '31977776666', 'ministry_id' => $ministry->id, 'message' => 'Quero servir.', 'consent' => true])->assertCreated();

    expect(queuedRecipients())->toBe(['pastor@pibls.test', 'secretaria@pibls.test']);
});

it('BR-007 o e-mail do pedido de oração vai sem o texto, e os demais também não levam a mensagem', function () {
    setRecipients(['ORACAO' => ['oracao@pibls.test'], 'CONTATO' => ['secretaria@pibls.test']]);

    postJson('/api/public/leads', ['type' => 'ORACAO', 'message' => 'Meu texto secreto de oração.', 'name' => 'Rita Alves', 'phone' => '31999990000', 'consent' => true])->assertCreated();
    postJson('/api/public/leads', ['type' => 'CONTATO', 'name' => 'Ana Costa', 'email' => 'ana@example.com', 'message' => 'Mensagem privada para a secretaria.', 'consent' => true])->assertCreated();

    Artisan::call('queue:work', ['--stop-when-empty' => true]);

    $messages = app('mailer')->getSymfonyTransport()->messages();
    expect($messages)->toHaveCount(2);
    foreach ($messages as $sent) {
        $message = $sent->getOriginalMessage();
        $all = $message->getSubject().$message->getHtmlBody().$message->getTextBody();
        expect($all)
            ->not->toContain('texto secreto')->not->toContain('Mensagem privada')
            ->not->toContain('Rita Alves')->not->toContain('31999990000')->not->toContain('ana@example.com')
            ->toContain('/admin/');
    }
    $prayer = $messages->first(fn ($sent) => $sent->getOriginalMessage()->getTo()[0]->getAddress() === 'oracao@pibls.test')->getOriginalMessage();
    expect($prayer->getSubject())->toContain('oração')
        ->and($prayer->getTextBody())->toContain('/admin/oracao/'.Lead::query()->where('type', 'ORACAO')->value('id'));
});

it('o e-mail traz o tipo, a data em horário de Brasília e o link do contato no painel', function () {
    setRecipients(['VISITANTE' => ['acolhimento@pibls.test']]);
    $this->travelTo(now()->setDate(2026, 11, 8)->setTime(13, 10)); // 10h10 em Brasília

    postJson('/api/public/leads', ['type' => 'VISITANTE', 'name' => 'Maria Souza', 'phone' => '31999998888', 'neighborhood' => 'Centro', 'wants_visit' => true, 'wants_cell_group' => true, 'consent' => true])->assertCreated();
    Artisan::call('queue:work', ['--stop-when-empty' => true]);

    $message = app('mailer')->getSymfonyTransport()->messages()->first()->getOriginalMessage();
    $id = Lead::query()->value('id');
    expect($message->getSubject())->toBe('Novo contato: Ficha de Visitante')
        ->and($message->getTextBody())->toContain('08/11/2026 às 10h10')->toContain("/admin/contatos/{$id}")
        ->and($message->getHtmlBody())->toContain("/admin/contatos/{$id}");
});

it('BR-011 grava o contato e registra o aviso quando o tipo não tem destinatário', function () {
    setRecipients([]);
    Log::spy();

    postJson('/api/public/leads', ['type' => 'CONTATO', 'name' => 'Ana Costa', 'email' => 'ana@example.com', 'message' => 'Preciso de ajuda.', 'consent' => true])->assertCreated();

    expect(Lead::query()->count())->toBe(1)->and(DB::table('jobs')->count())->toBe(0);
    Log::shouldHaveReceived('warning')->withArgs(fn (string $message, array $context) => $message === 'lead.no_recipients' && $context === ['type' => 'CONTATO'])->once();
});

it('BR-011 vale também para MINISTERIO quando nem o ministério nem a lista têm e-mail', function () {
    setRecipients(['MINISTERIO' => []]);
    $ministry = MinistryGroup::factory()->create(['contact_email' => null]);
    Log::spy();

    postJson('/api/public/leads', ['type' => 'MINISTERIO', 'name' => 'Paulo Reis', 'phone' => '31977776666', 'ministry_id' => $ministry->id, 'message' => 'Quero servir.', 'consent' => true])->assertCreated();

    expect(Lead::query()->count())->toBe(1);
    Log::shouldHaveReceived('warning')->withArgs(fn (string $message) => $message === 'lead.no_recipients')->once();
});

it('ignora e-mail inválido da lista, sem derrubar o envio', function () {
    setRecipients(['CONTATO' => ['não-é-email', 'secretaria@pibls.test']]);

    postJson('/api/public/leads', ['type' => 'CONTATO', 'name' => 'Ana Costa', 'email' => 'ana@example.com', 'message' => 'Preciso de ajuda.', 'consent' => true])->assertCreated();

    expect(queuedRecipients())->toBe(['secretaria@pibls.test']);
});

it('não envia nada dentro da requisição: o e-mail só sai quando o worker roda', function () {
    setRecipients(['CONTATO' => ['secretaria@pibls.test']]);

    postJson('/api/public/leads', ['type' => 'CONTATO', 'name' => 'Ana Costa', 'email' => 'ana@example.com', 'message' => 'Preciso de ajuda.', 'consent' => true])->assertCreated();

    expect(app('mailer')->getSymfonyTransport()->messages())->toHaveCount(0)->and(DB::table('jobs')->count())->toBe(1);
});

it('FR-019 a falha do SMTP não desfaz o contato: o job fica na fila para nova tentativa', function () {
    setRecipients(['CONTATO' => ['secretaria@pibls.test']]);
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

    postJson('/api/public/leads', ['type' => 'CONTATO', 'name' => 'Ana Costa', 'email' => 'ana@example.com', 'message' => 'Preciso de ajuda.', 'consent' => true])->assertCreated();
    Artisan::call('queue:work', ['--once' => true]);

    expect(Lead::query()->count())->toBe(1)
        ->and(DB::table('jobs')->count())->toBe(1)
        ->and(DB::table('failed_jobs')->count())->toBe(0);
});

it('a transação desfaz tudo junto: se o envio falha depois de gravar, nem o contato nem o e-mail ficam', function () {
    setRecipients(['CONTATO' => ['secretaria@pibls.test']]);
    // Força uma falha dentro da transação do SubmitLead: o evento de domínio lança
    Event::listen(LeadReceived::class, function () {
        throw new RuntimeException('falha no meio da transação');
    });

    $this->withoutExceptionHandling();
    try {
        postJson('/api/public/leads', ['type' => 'CONTATO', 'name' => 'Ana Costa', 'email' => 'ana@example.com', 'message' => 'Preciso de ajuda.', 'consent' => true]);
    } catch (RuntimeException) {
        // esperado
    }

    expect(Lead::query()->count())->toBe(0)->and(DB::table('jobs')->count())->toBe(0);
});
