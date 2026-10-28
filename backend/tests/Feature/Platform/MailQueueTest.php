<?php

declare(strict_types=1);

use App\Modules\Platform\Console\Heartbeat;
use App\Modules\Platform\Mail\NoticeMail;
use App\Shared\Http\RequestId;
use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use Illuminate\Console\Scheduling\Event;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\RawMessage;

/*
| ADR-003: e-mail só pela fila do MySQL, gravada na mesma transação, processada pelo agendador (cron de 5 min).
*/

function notice(string $type = 'teste.aviso'): NoticeMail
{
    return new NoticeMail($type, 'Assunto de teste', 'Olá!', ['Primeira linha.', 'Segunda linha.'], 'Abrir o painel', 'https://pibls.com/admin');
}

/** @return Collection<int, RawMessage> */
function sentMessages(): Collection
{
    return app('mailer')->getSymfonyTransport()->messages();
}

beforeEach(function () {
    // Os testes usam a fila de verdade (database); o phpunit.xml deixa `sync` como padrão dos demais
    config(['queue.default' => 'database']);
});

it('grava o job na mesma transação: se a operação desfaz, o e-mail some junto', function () {
    try {
        DB::transaction(function () {
            Mail::to('pastor@exemplo.com')->queue(notice());
            expect(DB::table('jobs')->count())->toBe(1);

            throw new RuntimeException('a operação de negócio falhou');
        });
    } catch (RuntimeException) {
        // esperado
    }

    expect(DB::table('jobs')->count())->toBe(0);
});

it('mantém o job quando a transação é confirmada', function () {
    DB::transaction(fn () => Mail::to('pastor@exemplo.com')->queue(notice()));

    expect(DB::table('jobs')->count())->toBe(1)->and(DB::table('failed_jobs')->count())->toBe(0);
});

it('nunca envia síncrono na requisição: Mail::send de um BaseMail só enfileira', function () {
    Mail::to('pastor@exemplo.com')->send(notice());

    expect(DB::table('jobs')->count())->toBe(1)->and(sentMessages())->toHaveCount(0);
});

it('leva o correlation ID da requisição dentro do job, para o log do worker', function () {
    Context::add(RequestId::CONTEXT_KEY, '01JC8Z3K7Q2W9V5T4N6M8B1X0Y');

    Mail::to('pastor@exemplo.com')->queue(notice());

    expect((string) DB::table('jobs')->value('payload'))->toContain('01JC8Z3K7Q2W9V5T4N6M8B1X0Y');
});

it('o worker envia o e-mail em pt-BR, em HTML e em texto, e esvazia a fila', function () {
    Mail::to('pastor@exemplo.com')->queue(notice());

    Artisan::call('queue:work', ['--stop-when-empty' => true, '--max-jobs' => 20, '--max-time' => 240]);

    expect(DB::table('jobs')->count())->toBe(0)->and(sentMessages())->toHaveCount(1);

    $message = sentMessages()->first()->getOriginalMessage();
    expect($message->getSubject())->toBe('Assunto de teste')
        ->and($message->getTo()[0]->getAddress())->toBe('pastor@exemplo.com')
        ->and($message->getHtmlBody())->toContain('Olá!')->toContain('Primeira linha.')->toContain('Abrir o painel')
        ->and($message->getHtmlBody())->toContain('lang="pt-BR"')
        ->and($message->getTextBody())->toContain('Olá!')->toContain('Segunda linha.')->toContain('https://pibls.com/admin');
});

it('escapa HTML nos textos do aviso', function () {
    Mail::to('pastor@exemplo.com')->queue(new NoticeMail('teste.xss', 'Assunto', '<script>alert(1)</script>', ['<b>x</b>']));

    Artisan::call('queue:work', ['--stop-when-empty' => true]);

    $html = sentMessages()->first()->getOriginalMessage()->getHtmlBody();
    expect($html)->not->toContain('<script>alert(1)</script>')->toContain('&lt;script&gt;')->not->toContain('<b>x</b>');
});

it('registra mail.sent com o tipo e o atraso, sem o destinatário', function () {
    Log::spy();
    Mail::to('segredo@exemplo.com')->queue(notice('lead.received'));
    usleep(30_000);

    Artisan::call('queue:work', ['--stop-when-empty' => true]);

    Log::shouldHaveReceived('info')->withArgs(function (string $message, array $context) {
        return $message === 'mail.sent'
            && $context['type'] === 'lead.received'
            && is_int($context['delayMs']) && $context['delayMs'] >= 30
            && ! str_contains(json_encode($context, JSON_THROW_ON_ERROR), 'segredo@exemplo.com');
    })->once();
});

it('FR-019 vai para failed_jobs só depois de 5 falhas, e a falha do SMTP não desfaz nada', function () {
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

    Mail::to('pastor@exemplo.com')->queue(notice());

    foreach (range(1, 4) as $attempt) {
        Artisan::call('queue:work', ['--once' => true]);

        // Ainda tem tentativas: o job volta para a fila com espera (backoff) e não vai para failed_jobs
        expect(DB::table('jobs')->count())->toBe(1, "tentativa {$attempt}")
            ->and(DB::table('failed_jobs')->count())->toBe(0, "tentativa {$attempt}");
        expect((int) DB::table('jobs')->value('available_at'))->toBeGreaterThan(time());

        DB::table('jobs')->update(['available_at' => 0]); // pula a espera do backoff
    }

    Artisan::call('queue:work', ['--once' => true]); // 5ª tentativa

    expect(DB::table('jobs')->count())->toBe(0)->and(DB::table('failed_jobs')->count())->toBe(1);
});

it('espera mais a cada nova tentativa (backoff crescente)', function () {
    $mail = notice();

    expect($mail->tries)->toBe(5)->and($mail->backoff)->toBe([60, 300, 900, 3600]);
});

it('ADR-017 bloqueia na homologação o destinatário que não está na allowlist', function () {
    config(['queue.default' => 'sync', 'pibls.mail_allowlist' => ['equipe@pibls.test']]);
    Log::spy();

    Mail::to('publico@exemplo.com')->send(notice());
    Mail::to('Equipe@PIBLS.test')->send(notice());

    expect(sentMessages())->toHaveCount(1)
        ->and(sentMessages()->first()->getOriginalMessage()->getTo()[0]->getAddress())->toBe('Equipe@PIBLS.test');
    Log::shouldHaveReceived('warning')->withArgs(
        fn (string $message, array $context) => $message === 'mail.blocked_by_allowlist'
            && ! str_contains(json_encode($context, JSON_THROW_ON_ERROR), 'exemplo.com'),
    )->once();
});

it('cancela o envio se QUALQUER destinatário estiver fora da allowlist (Cc e Bcc inclusive)', function () {
    config(['queue.default' => 'sync', 'pibls.mail_allowlist' => ['equipe@pibls.test']]);

    Mail::to('equipe@pibls.test')->bcc('publico@exemplo.com')->send(notice());

    expect(sentMessages())->toHaveCount(0);
});

it('sem allowlist (produção, local e CI) não restringe ninguém', function () {
    config(['queue.default' => 'sync', 'pibls.mail_allowlist' => []]);

    Mail::to('qualquer@exemplo.com')->send(notice());

    expect(sentMessages())->toHaveCount(1);
});

it('o agendador roda o worker a cada 5 minutos, sem sobreposição e com limites de 20 jobs e 240 s', function () {
    $worker = collect(app(Schedule::class)->events())
        ->first(fn (Event $event) => str_contains($event->command ?? '', 'queue:work'));

    expect($worker)->not->toBeNull()
        ->and($worker->expression)->toBe('*/5 * * * *')
        ->and($worker->withoutOverlapping)->toBeTrue()
        ->and($worker->command)->toContain('--stop-when-empty')->toContain('--max-time=240')->toContain('--max-jobs=20');
});

it('o heartbeat avisa o Healthchecks no sucesso e chama /fail na falha', function (int $exitCode, string $expectedUrl) {
    $requests = [];
    $stack = HandlerStack::create(new MockHandler([new Response(200)]));
    $stack->push(Middleware::history($requests));
    app()->instance(ClientInterface::class, new Client(['handler' => $stack]));

    $event = Heartbeat::attach(app(Schedule::class)->command('inspire'), 'https://hc-ping.com/abc-123/');
    $event->exitCode = $exitCode;
    $event->callAfterCallbacks(app());

    expect($requests)->toHaveCount(1)
        ->and((string) $requests[0]['request']->getUri())->toBe($expectedUrl);
})->with([
    'sucesso' => [0, 'https://hc-ping.com/abc-123'],
    'falha' => [1, 'https://hc-ping.com/abc-123/fail'],
]);

it('o heartbeat não faz nada sem URL (local e CI)', function (?string $url) {
    $event = Heartbeat::attach(app(Schedule::class)->command('inspire'), $url);
    $event->exitCode = 0;

    $requests = [];
    $stack = HandlerStack::create(new MockHandler([]));
    $stack->push(Middleware::history($requests));
    app()->instance(ClientInterface::class, new Client(['handler' => $stack]));
    $event->callAfterCallbacks(app());

    expect($requests)->toBe([]);
})->with([[null], [''], ['   ']]);
