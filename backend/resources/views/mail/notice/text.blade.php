{{-- Texto puro, não HTML: escapar viraria "&amp;" no meio do link (e do restante) --}}
{!! $heading !!}

@foreach ($lines as $line)
{!! $line !!}

@endforeach
@if ($actionLabel && $actionUrl)
{!! $actionLabel !!}: {!! $actionUrl !!}

@endif
--
Primeira Igreja Batista em Lagoa Santa
Este é um aviso automático do portal da PIBLS. Se não era para você, ignore esta mensagem.
