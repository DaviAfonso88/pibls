@extends('mail.layout')

@section('title', $heading)

@section('content')
    <h1 style="margin:16px 0 12px;font-size:22px;line-height:1.3;color:#1c1917;">{{ $heading }}</h1>

    @foreach ($lines as $line)
        <p style="margin:0 0 12px;">{{ $line }}</p>
    @endforeach

    @if ($actionLabel && $actionUrl)
        <p style="margin:20px 0 0;">
            <a href="{{ $actionUrl }}" style="display:inline-block;padding:12px 20px;background:#2a6c82;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;">{{ $actionLabel }}</a>
        </p>
        <p style="margin:12px 0 0;font-size:13px;color:#57534e;">Se o botão não abrir, copie este endereço no navegador:<br>{{ $actionUrl }}</p>
    @endif
@endsection
