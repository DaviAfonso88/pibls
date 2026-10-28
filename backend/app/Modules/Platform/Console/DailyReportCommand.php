<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use App\Modules\Platform\Reports\DailyReport;
use App\Modules\Platform\Reports\DailyReportMail;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * `pibls:daily-report` (diário, 07:00): monta o resumo do dia anterior e o enfileira para `DAILY_REPORT_RECIPIENTS`. No dia 1
 * leva também o resumo mensal. O envio é pela fila, como todo e-mail: o worker o entrega no ciclo seguinte.
 */
final class DailyReportCommand extends Command
{
    protected $signature = 'pibls:daily-report';

    protected $description = 'Enfileira o resumo diário por e-mail (e o mensal, no dia 1)';

    public function handle(DailyReport $report): int
    {
        /** @var list<string> $recipients */
        $recipients = array_values((array) config('pibls.report.recipients'));

        if ($recipients === []) {
            $this->warn('Nenhum destinatário: defina DAILY_REPORT_RECIPIENTS no .env para receber o resumo diário.');

            return self::SUCCESS;
        }

        $data = $report->build(CarbonImmutable::parse(now()->toDateTimeString(), 'UTC'));
        Mail::to($recipients)->queue(new DailyReportMail($data));

        $this->info('Resumo de '.$data['date_label'].' enfileirado para '.count($recipients).' destinatário(s).');

        return self::SUCCESS;
    }
}
