<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'Primeira Igreja Batista em Lagoa Santa')</title>
</head>
{{-- E-mail não carrega CSS externo nem Tailwind: o estilo vai inline, com as mesmas cores do site. --}}
<body style="margin:0;padding:0;background:#fafaf9;color:#1c1917;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;">
    <tr>
        <td align="center" style="padding:24px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e5e4;border-radius:14px;">
                <tr>
                    <td style="padding:24px 24px 8px;">
                        <p style="margin:0;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#57534e;">Primeira Igreja Batista em Lagoa Santa</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 24px 24px;">
                        @yield('content')
                    </td>
                </tr>
            </table>
            <p style="max-width:560px;margin:16px auto 0;font-size:13px;color:#57534e;">
                Este é um aviso automático do portal da PIBLS. Se não era para você, ignore esta mensagem.
            </p>
        </td>
    </tr>
</table>
</body>
</html>
