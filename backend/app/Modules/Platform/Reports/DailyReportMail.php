<?php

declare(strict_types=1);

namespace App\Modules\Platform\Reports;

use App\Modules\Platform\Mail\BaseMail;

/**
 * O resumo diário das 07:00 (Observability → Dashboards), pela fila como todo e-mail do portal. Leva só números e nomes
 * de rota: nenhum dado pessoal, nem do público nem da equipe.
 */
final class DailyReportMail extends BaseMail
{
    /** @param  array<string, mixed>  $report  o que `DailyReport::build()` devolve */
    public function __construct(private readonly array $report) {}

    protected function noticeType(): string
    {
        return 'daily-report';
    }

    protected function subjectLine(): string
    {
        $subject = 'Resumo diário PIBLS — '.$this->report['date_label'];

        if (is_array($this->report['monthly'])) {
            $subject .= ' (com o resumo mensal)';
        }
        if ($this->report['attention'] !== []) {
            $subject = '[Atenção] '.$subject;
        }

        return $subject;
    }

    protected function template(): string
    {
        return 'daily-report';
    }

    protected function data(): array
    {
        return ['report' => $this->report];
    }
}
