<?php

declare(strict_types=1);

use App\Shared\Logging\ConfigureLogger;
use App\Shared\Logging\JsonFormatter;
use Illuminate\Support\Facades\Log;
use Monolog\Level;
use Monolog\LogRecord;
use Tests\TestCase;

uses(TestCase::class);

function logRecord(string $message, array $context = [], array $extra = [], Level $level = Level::Info): LogRecord
{
    return new LogRecord(new DateTimeImmutable('2026-10-22 10:00:00.123', new DateTimeZone('-03:00')), 'app', $level, $message, $context, $extra);
}

it('escreve uma linha JSON com todos os campos obrigatórios', function () {
    config(['pibls.release' => '2026.11.3']);

    $line = (new JsonFormatter)->format(logRecord('http.request', [
        'action' => 'health', 'httpStatus' => 200, 'durationMs' => 12, 'userId' => 5,
        'resourceType' => 'lead', 'resourceId' => '120',
    ], ['request_id' => '01JC8Z3K7Q2W9V5T4N6M8B1X0Y']));

    expect($line)->toEndWith("\n");
    $data = json_decode($line, true, flags: JSON_THROW_ON_ERROR);

    expect($data)->toMatchArray([
        'timestamp' => '2026-10-22T13:00:00.123Z',
        'level' => 'info',
        'message' => 'http.request',
        'correlationId' => '01JC8Z3K7Q2W9V5T4N6M8B1X0Y',
        'userId' => 5,
        'action' => 'health',
        'resourceType' => 'lead',
        'resourceId' => '120',
        'durationMs' => 12,
        'httpStatus' => 200,
        'release' => '2026.11.3',
        'env' => 'testing',
    ])->and($data)->not->toHaveKey('context')->not->toHaveKey('extra');
});

it('emite os campos obrigatórios como null quando a chamada não os informa', function () {
    $data = json_decode((new JsonFormatter)->format(logRecord('job.started')), true, flags: JSON_THROW_ON_ERROR);

    expect($data)->toHaveKeys([
        'timestamp', 'level', 'message', 'correlationId', 'userId', 'action', 'resourceType', 'resourceId',
        'durationMs', 'httpStatus', 'release', 'env',
    ])->and($data['correlationId'])->toBeNull()->and($data['userId'])->toBeNull();
});

it('nunca grava dado pessoal, nem no texto nem no contexto', function () {
    $line = (new JsonFormatter)->format(logRecord(
        'Falha ao notificar maria@exemplo.com pelo (31) 99999-8888',
        [
            'phone' => '31999998888',
            'email' => 'maria@exemplo.com',
            'password' => 'hunter2',
            'body' => ['message' => 'meu pedido de oração'],
            'detail' => 'contato joao@exemplo.com',
            'limiter' => 'lead-submit',
        ],
        ['request_id' => '01JC8Z3K7Q2W9V5T4N6M8B1X0Y', 'token' => 'abc123'],
    ));

    foreach (['maria@exemplo.com', 'joao@exemplo.com', '31999998888', '99999-8888', 'hunter2', 'pedido de oração', 'abc123'] as $secret) {
        expect($line)->not->toContain($secret);
    }

    $data = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
    expect($data['message'])->toBe('Falha ao notificar [e-mail] pelo [telefone]')
        ->and($data['context']['limiter'])->toBe('lead-submit')
        ->and($data['context']['phone'])->toBe('[removido]')
        ->and($data['context']['detail'])->toBe('contato [e-mail]');
});

it('serializa a exceção sem expor e-mail ou telefone da mensagem', function () {
    $line = (new JsonFormatter)->format(logRecord(
        'job.failed',
        ['exception' => new RuntimeException('Falha com ana@exemplo.com e 31 98888-7777')],
        level: Level::Error,
    ));

    expect($line)->not->toContain('ana@exemplo.com')->not->toContain('98888-7777')->toContain('RuntimeException');
});

it('o tap dos canais troca o formato para JSON no arquivo de log', function () {
    $path = sys_get_temp_dir().'/pibls-log-'.bin2hex(random_bytes(4)).'.log';

    try {
        // `tap` só vale para canais declarados em config/logging.php (não para `Log::build`)
        config(['logging.channels.json-teste' => [
            'driver' => 'single', 'path' => $path, 'level' => 'debug', 'tap' => [ConfigureLogger::class],
        ]]);

        Log::channel('json-teste')->warning('rate_limit.hit', ['limiter' => 'lead-submit', 'email' => 'a@b.com']);

        $lines = array_values(array_filter(explode("\n", (string) file_get_contents($path))));
        expect($lines)->toHaveCount(1);
        $data = json_decode($lines[0], true, flags: JSON_THROW_ON_ERROR);
        expect($data['level'])->toBe('warning')
            ->and($data['message'])->toBe('rate_limit.hit')
            ->and($data['context']['email'])->toBe('[removido]');
    } finally {
        @unlink($path);
    }
});
