<?php

declare(strict_types=1);

namespace App\Shared\Logging;

use Illuminate\Log\Logger;
use Monolog\Handler\FormattableHandlerInterface;
use Monolog\Logger as MonologLogger;

/**
 * `tap` dos canais de log (config/logging.php): troca o formato para JSON, uma linha por evento.
 */
final class ConfigureLogger
{
    public function __invoke(Logger $logger): void
    {
        $monolog = $logger->getLogger();
        if (! $monolog instanceof MonologLogger) {
            return;
        }

        foreach ($monolog->getHandlers() as $handler) {
            if ($handler instanceof FormattableHandlerInterface) {
                $handler->setFormatter(new JsonFormatter);
            }
        }
    }
}
