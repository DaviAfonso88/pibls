<?php

declare(strict_types=1);

namespace App\Modules\Platform\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\Factory;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Base de todo e-mail do portal (ADR-003): sempre pela fila do MySQL, nunca síncrono na requisição.
 *
 * - O job é gravado na mesma transação da operação de negócio (efeito de *transactional outbox*): se a transação
 *   volta atrás, o e-mail some junto. Por isso a conexão `database` não usa `after_commit`.
 * - O worker roda no agendador, a cada 5 min. Cada e-mail tem 5 tentativas com espera crescente; esgotadas, o job vai
 *   para `failed_jobs`. Falha de SMTP nunca desfaz a operação que o enfileirou (FR-019).
 * - Texto em pt-BR, em versão HTML simples e em texto puro (`resources/views/mail/<template>/{html,text}.blade.php`).
 * - Depois de enviar, registra `mail.sent` com o tipo do aviso e o atraso entre enfileirar e enviar, sem o destinatário
 *   (base do SC-019).
 */
abstract class BaseMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    /** Tentativas antes de ir para `failed_jobs`. */
    public int $tries = 5;

    /**
     * Espera, em segundos, antes de cada nova tentativa. Como o worker só roda a cada 5 min, na prática o reenvio
     * acontece na primeira execução depois do prazo.
     *
     * @var list<int>
     */
    public array $backoff = [60, 300, 900, 3600];

    /** Momento em que o e-mail entrou na fila (milissegundos desde a época). */
    public ?int $enqueuedAtMs = null;

    /** Tipo do aviso para o log e as métricas, ex.: `lead.received`. Nunca leva dado pessoal. */
    abstract protected function noticeType(): string;

    abstract protected function subjectLine(): string;

    /** Pasta em `resources/views/mail/` com `html.blade.php` e `text.blade.php`. */
    abstract protected function template(): string;

    /**
     * @return array<string, mixed> dados das duas views
     */
    protected function data(): array
    {
        return [];
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine());
    }

    public function content(): Content
    {
        return new Content(
            html: 'mail.'.$this->template().'.html',
            text: 'mail.'.$this->template().'.text',
            with: $this->data(),
        );
    }

    /** Marca a entrada na fila, onde quer que o e-mail seja enfileirado. */
    public function queue(Factory $queue)
    {
        $this->enqueuedAtMs ??= (int) round(microtime(true) * 1000);

        return parent::queue($queue);
    }

    public function send($mailer)
    {
        $sent = parent::send($mailer);

        Log::info('mail.sent', [
            'type' => $this->noticeType(),
            'delayMs' => $this->enqueuedAtMs === null ? null : (int) round(microtime(true) * 1000) - $this->enqueuedAtMs,
        ]);

        return $sent;
    }
}
