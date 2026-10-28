<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use App\Modules\Platform\Monitoring\Healthchecks;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * `pibls:mail:failure-check` (a cada 15 min): mais de 10 e-mails com falha DEFINITIVA na última hora (`failed_jobs`)
 * viram um ping `/fail` no Healthchecks, que alerta por e-mail e push do próprio serviço, não pelo SMTP que está com
 * problema (Observability → Alertas). Com 10 ou menos, o ping é de sucesso: o check também cobre o cron parado.
 */
final class MailFailureCheckCommand extends Command
{
    protected $signature = 'pibls:mail:failure-check';

    protected $description = 'Avisa o Healthchecks se houve onda de falhas definitivas de e-mail na última hora';

    public function handle(Healthchecks $healthchecks): int
    {
        $threshold = (int) config('pibls.mail_failure_threshold');
        $failures = DB::table('failed_jobs')->where('failed_at', '>=', now()->subHour())->count();

        if ($failures > $threshold) {
            $healthchecks->fail('mail_failures');
            $this->warn("{$failures} e-mails com falha definitiva na última hora (limite: {$threshold}).");
        } else {
            $healthchecks->success('mail_failures');
            $this->info("{$failures} falha(s) definitiva(s) de e-mail na última hora.");
        }

        return self::SUCCESS;
    }
}
