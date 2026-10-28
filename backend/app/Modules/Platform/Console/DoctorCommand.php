<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use App\Modules\Platform\Doctor\CheckStatus;
use App\Modules\Platform\Doctor\Doctor;
use Illuminate\Console\Command;

/**
 * `php artisan pibls:doctor`: confere se o servidor aguenta a aplicação. O ativador (`finalize.php`) o chama em toda
 * release nova antes de migrar; qualquer erro mantém a release anterior ativa. Sai com 1 se houver erro.
 */
final class DoctorCommand extends Command
{
    protected $signature = 'pibls:doctor {--json : Imprime o relatório em JSON (uso do ativador)}';

    protected $description = 'Confere PHP, extensões, limites, permissões, banco e configuração do ambiente';

    public function handle(Doctor $doctor): int
    {
        $results = $doctor->run();
        $overall = Doctor::overall($results);

        if ($this->option('json') === true) {
            $this->line((string) json_encode(
                [
                    'status' => $overall->value,
                    'checks' => array_map(fn ($result) => $result->toArray(), $results),
                ],
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
            ));

            return $overall === CheckStatus::Error ? self::FAILURE : self::SUCCESS;
        }

        foreach ($results as $result) {
            $line = sprintf('%s %s: %s', match ($result->status) {
                CheckStatus::Ok => '✓',
                CheckStatus::Warning => '!',
                CheckStatus::Error => '✗',
            }, $result->name, $result->message);

            match ($result->status) {
                CheckStatus::Ok => $this->line($line),
                CheckStatus::Warning => $this->warn($line),
                CheckStatus::Error => $this->error($line),
            };
        }

        $this->newLine();
        match ($overall) {
            CheckStatus::Ok => $this->info('Tudo certo.'),
            CheckStatus::Warning => $this->warn('Há avisos, mas nada que impeça a ativação.'),
            CheckStatus::Error => $this->error('Há erros: a release não deve ser ativada.'),
        };

        return $overall === CheckStatus::Error ? self::FAILURE : self::SUCCESS;
    }
}
