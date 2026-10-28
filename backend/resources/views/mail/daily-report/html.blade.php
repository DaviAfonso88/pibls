@extends('mail.layout')

@section('title', 'Resumo diário — '.$report['date_label'])

@php
    $th = 'text-align:left;padding:6px 8px;border-bottom:1px solid #e7e5e4;font-size:13px;color:#57534e;';
    $td = 'padding:6px 8px;border-bottom:1px solid #e7e5e4;font-size:14px;';
    $h2 = 'margin:24px 0 8px;font-size:17px;line-height:1.3;color:#1c1917;';
    $bytes = fn (int $value): string => $value >= 1048576 ? number_format($value / 1048576, 1, ',', '.').' MB' : number_format($value / 1024, 1, ',', '.').' KB';
@endphp

@section('content')
    <h1 style="margin:16px 0 4px;font-size:22px;line-height:1.3;color:#1c1917;">Resumo diário</h1>
    <p style="margin:0 0 12px;color:#57534e;">{{ $report['date_label'] }} · Release {{ $report['release'] }}</p>

    @if ($report['attention'] !== [])
        <div style="margin:0 0 8px;padding:12px 14px;background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;color:#78350f;">
            <strong>Atenção</strong>
            @foreach ($report['attention'] as $message)
                <p style="margin:6px 0 0;">{{ $message }}</p>
            @endforeach
        </div>
    @else
        <p style="margin:0 0 8px;padding:10px 14px;background:#eaf3f5;border-radius:12px;color:#043546;">Nada pede atenção hoje.</p>
    @endif

    <h2 style="{{ $h2 }}">Desempenho por rota</h2>
    @if ($report['latency'] === [])
        <p style="margin:0;color:#57534e;">Sem requisições registradas no dia.</p>
    @else
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <th style="{{ $th }}">Rota</th><th style="{{ $th }}">Req.</th><th style="{{ $th }}">p50</th><th style="{{ $th }}">p95</th><th style="{{ $th }}">p99</th><th style="{{ $th }}">Meta</th>
            </tr>
            @foreach ($report['latency'] as $row)
                <tr>
                    <td style="{{ $td }}">{{ $row['route'] }}</td>
                    <td style="{{ $td }}">{{ $row['requests'] }}</td>
                    <td style="{{ $td }}">{{ $row['p50'] }} ms</td>
                    <td style="{{ $td }}{{ $row['within_target'] ? '' : 'color:#b91c1c;font-weight:700;' }}">{{ $row['p95'] }} ms</td>
                    <td style="{{ $td }}">{{ $row['p99'] }} ms</td>
                    <td style="{{ $td }}">{{ $row['within_target'] ? 'ok' : 'acima' }} (≤ {{ $row['target'] }} ms)</td>
                </tr>
            @endforeach
        </table>
    @endif

    <h2 style="{{ $h2 }}">Erros</h2>
    <p style="margin:0;">{{ $report['requests']['total'] }} requisições, {{ $report['requests']['server_errors'] }} com erro 5xx ({{ number_format($report['requests']['error_rate'], 2, ',', '.') }}%). {{ $report['error_logs'] }} linha(s) de log de nível error.</p>

    <h2 style="{{ $h2 }}">Fila de e-mails</h2>
    <p style="margin:0;">{{ $report['queue']['pending'] }} esperando envio · {{ $report['queue']['failed_last_24h'] }} falha(s) definitiva(s) nas últimas 24 h · {{ $report['queue']['failed_total'] }} em falha no total.</p>

    <h2 style="{{ $h2 }}">Backups</h2>
    <p style="margin:0;">
        Dump local: {{ $report['backups']['local']['age_hours'] === null ? 'nenhum encontrado' : 'há '.number_format($report['backups']['local']['age_hours'], 1, ',', '.').' h' }}.<br>
        Cópia no B2:
        @if ($report['backups']['offsite']['error'] !== null)
            não foi possível consultar ({{ $report['backups']['offsite']['error'] }}).
        @elseif ($report['backups']['offsite']['latest_date'] === null)
            nenhuma encontrada.
        @else
            {{ $report['backups']['offsite']['latest_date'] }} ({{ $report['backups']['offsite']['days_behind'] === 0 ? 'de hoje' : $report['backups']['offsite']['days_behind'].' dia(s) atrás' }}).
        @endif
    </p>

    <h2 style="{{ $h2 }}">Disco</h2>
    <p style="margin:0;">Uploads: {{ $bytes($report['disk']['uploads_bytes']) }} · Backups locais: {{ $bytes($report['disk']['backups_bytes']) }} · {{ $report['disk']['files'] }} arquivo(s).</p>

    <h2 style="{{ $h2 }}">Contatos</h2>
    @if ($report['stale_leads']['total'] === 0)
        <p style="margin:0;">Nenhum contato novo esperando há mais de 3 dias.</p>
    @else
        <p style="margin:0;">{{ $report['stale_leads']['total'] }} contato(s) novo(s) esperando há mais de 3 dias:
            @foreach ($report['stale_leads']['by_type'] as $type => $total){{ $type }} ({{ $total }}){{ $loop->last ? '.' : ', ' }}@endforeach
        </p>
    @endif

    <h2 style="{{ $h2 }}">Inscrições</h2>
    <p style="margin:0;">{{ $report['registrations_yesterday'] }} inscrição(ões) no dia.</p>

    @if ($report['monthly'] !== null)
        @php($monthly = $report['monthly'])
        <h1 style="margin:32px 0 4px;font-size:20px;line-height:1.3;color:#1c1917;border-top:2px solid #e7e5e4;padding-top:20px;">Resumo mensal</h1>
        <p style="margin:0 0 12px;color:#57534e;">{{ $monthly['label'] }} · só números, sem dados pessoais</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><th style="{{ $th }}">Tipo de contato</th><th style="{{ $th }}">Recebidos</th><th style="{{ $th }}">Concluídos</th></tr>
            @foreach ($monthly['leads'] as $type => $counts)
                <tr><td style="{{ $td }}">{{ $type }}</td><td style="{{ $td }}">{{ $counts['received'] }}</td><td style="{{ $td }}">{{ $counts['concluded'] }}</td></tr>
            @endforeach
        </table>

        <p style="margin:12px 0 0;">
            Visitantes e membros concluídos em até 7 dias (meta: 90%): <strong>{{ $monthly['concluded_in_7_days_rate'] === null ? 'sem dados' : number_format($monthly['concluded_in_7_days_rate'], 1, ',', '.').'%' }}</strong><br>
            Mediana até a primeira mudança de status (meta: até 48 h): <strong>{{ $monthly['median_first_change_hours'] === null ? 'sem dados' : number_format($monthly['median_first_change_hours'], 1, ',', '.').' h' }}</strong><br>
            Semanas com o boletim publicado até domingo às 8h (meta: 90%): <strong>{{ $monthly['bulletins']['on_time'] }} de {{ $monthly['bulletins']['weeks'] }}</strong><br>
            Avisos por e-mail: p95 do atraso (meta: até 10 min): <strong>{{ $monthly['mail_delay_p95_seconds'] === null ? 'sem dados' : number_format($monthly['mail_delay_p95_seconds'], 1, ',', '.').' s' }}</strong><br>
            Disponibilidade do mês (UptimeRobot): <strong>{{ $monthly['availability_percent'] === null ? 'não consultada' : number_format($monthly['availability_percent'], 2, ',', '.').'%' }}</strong>
        </p>
    @endif
@endsection
