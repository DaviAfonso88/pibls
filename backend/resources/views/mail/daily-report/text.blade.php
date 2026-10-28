{{-- Texto puro, não HTML: escapar viraria "&amp;" no meio do texto --}}
Resumo diário - {!! $report['date_label'] !!} - Release {!! $report['release'] !!}

@if ($report['attention'] !== [])
ATENÇÃO
@foreach ($report['attention'] as $message)
- {!! $message !!}
@endforeach
@else
Nada pede atenção hoje.
@endif

DESEMPENHO POR ROTA (p50 / p95 / p99, meta de p95)
@forelse ($report['latency'] as $row)
- {!! $row['route'] !!}: {!! $row['requests'] !!} req., {!! $row['p50'] !!} / {!! $row['p95'] !!} / {!! $row['p99'] !!} ms (meta {!! $row['target'] !!} ms){!! $row['within_target'] ? '' : ' ACIMA DA META' !!}
@empty
Sem requisições registradas no dia.
@endforelse

ERROS
{!! $report['requests']['total'] !!} requisições, {!! $report['requests']['server_errors'] !!} com erro 5xx ({!! $report['requests']['error_rate'] !!}%). {!! $report['error_logs'] !!} linha(s) de log de nível error.

FILA DE E-MAILS
{!! $report['queue']['pending'] !!} esperando envio; {!! $report['queue']['failed_last_24h'] !!} falha(s) definitiva(s) nas últimas 24 h; {!! $report['queue']['failed_total'] !!} em falha no total.

BACKUPS
Dump local: {!! $report['backups']['local']['age_hours'] === null ? 'nenhum encontrado' : 'há '.$report['backups']['local']['age_hours'].' h' !!}
Cópia no B2: {!! $report['backups']['offsite']['error'] !== null ? 'não consultada ('.$report['backups']['offsite']['error'].')' : ($report['backups']['offsite']['latest_date'] ?? 'nenhuma encontrada') !!}

DISCO
Uploads: {!! round($report['disk']['uploads_bytes'] / 1048576, 1) !!} MB; backups locais: {!! round($report['disk']['backups_bytes'] / 1048576, 1) !!} MB; {!! $report['disk']['files'] !!} arquivo(s).

CONTATOS
@if ($report['stale_leads']['total'] === 0)
Nenhum contato novo esperando há mais de 3 dias.
@else
{!! $report['stale_leads']['total'] !!} contato(s) novo(s) esperando há mais de 3 dias.
@endif

INSCRIÇÕES
{!! $report['registrations_yesterday'] !!} inscrição(ões) no dia.
@if ($report['monthly'] !== null)

RESUMO MENSAL - {!! $report['monthly']['label'] !!}
@foreach ($report['monthly']['leads'] as $type => $counts)
- {!! $type !!}: {!! $counts['received'] !!} recebidos, {!! $counts['concluded'] !!} concluídos
@endforeach
Visitantes e membros concluídos em até 7 dias: {!! $report['monthly']['concluded_in_7_days_rate'] === null ? 'sem dados' : $report['monthly']['concluded_in_7_days_rate'].'%' !!}
Mediana até a primeira mudança de status: {!! $report['monthly']['median_first_change_hours'] === null ? 'sem dados' : $report['monthly']['median_first_change_hours'].' h' !!}
Semanas com o boletim até domingo às 8h: {!! $report['monthly']['bulletins']['on_time'] !!} de {!! $report['monthly']['bulletins']['weeks'] !!}
p95 do atraso dos avisos por e-mail: {!! $report['monthly']['mail_delay_p95_seconds'] === null ? 'sem dados' : $report['monthly']['mail_delay_p95_seconds'].' s' !!}
Disponibilidade do mês: {!! $report['monthly']['availability_percent'] === null ? 'não consultada' : $report['monthly']['availability_percent'].'%' !!}
@endif
--
Primeira Igreja Batista em Lagoa Santa
Este é um aviso automático do portal da PIBLS.
