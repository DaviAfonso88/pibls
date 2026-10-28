<?php

declare(strict_types=1);

namespace App\Shared\Logging;

use DateTimeZone;
use Monolog\Formatter\JsonFormatter as MonologJsonFormatter;
use Monolog\LogRecord;

/**
 * Uma linha JSON por evento, com os campos obrigatórios de Observability → Logging:
 * `timestamp` (ISO 8601 UTC), `level`, `correlationId`, `userId`, `action`, `resourceType`, `resourceId`,
 * `durationMs`, `httpStatus`, `release` e `env`.
 *
 * `correlationId` vem do `Context` do Laravel (o `RequestId` o grava); os demais campos fixos vêm do contexto da
 * chamada (`Log::info('…', ['action' => '…', 'httpStatus' => 200])`). O resto do contexto e o texto passam pelo
 * `PiiScrubber`: o log nunca leva senha, token, corpo de requisição, telefone ou e-mail do público.
 */
final class JsonFormatter extends MonologJsonFormatter
{
    /** Campos de topo que saem do contexto da chamada, na ordem em que aparecem na linha. */
    private const TOP_LEVEL = ['userId', 'action', 'resourceType', 'resourceId', 'durationMs', 'httpStatus'];

    public function __construct()
    {
        parent::__construct(self::BATCH_MODE_JSON, true);
    }

    public function format(LogRecord $record): string
    {
        /** @var array<string, mixed> $context */
        $context = (array) $this->normalize($record->context);

        $line = [
            'timestamp' => $record->datetime->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z'),
            'level' => strtolower($record->level->getName()),
            'message' => PiiScrubber::scrubText($record->message),
            'correlationId' => $record->extra['request_id'] ?? $context['correlationId'] ?? null,
        ];

        foreach (self::TOP_LEVEL as $field) {
            $line[$field] = $context[$field] ?? null;
            unset($context[$field]);
        }

        $line['release'] = config('pibls.release');
        $line['env'] = app()->environment();

        unset($context['correlationId']);
        if ($context !== []) {
            $line['context'] = PiiScrubber::scrub($context);
        }

        // Outros dados do Context do Laravel (ex.: um id de job), menos o que já foi para o topo
        $extra = $record->extra;
        unset($extra['request_id']);
        if ($extra !== []) {
            $line['extra'] = PiiScrubber::scrub((array) $this->normalize($extra));
        }

        return $this->toJson($line, true).($this->appendNewline ? "\n" : '');
    }
}
