<?php

declare(strict_types=1);

use App\Shared\Logging\PiiScrubber;

/*
| Observability → Logging: nunca gravar senha, token, cookie, corpo de requisição, campos 🔒,
| telefone ou e-mail do público.
*/

it('remove o valor de chaves que carregam dado pessoal ou segredo', function (string $key) {
    expect(PiiScrubber::scrub('qualquer valor', $key))->toBe(PiiScrubber::REDACTED);
})->with([
    'password', 'new_password', 'current_password', 'senha', 'token', 'access_token', 'XSRF-TOKEN', 'Cookie',
    'Authorization', 'email', 'contact_email', 'phone', 'guardian_phone', 'telefone', 'message', 'note', 'body',
    'payload', 'answers', 'private_address', 'participant_name', 'name', 'ip', 'ip_address', 'user_agent',
]);

it('mantém metadados seguros úteis para investigar', function (string $key) {
    expect(PiiScrubber::scrub('valor', $key))->toBe('valor');
})->with(['request_id', 'ipHash', 'limiter', 'route', 'action', 'httpStatus', 'durationMs', 'userId', 'release']);

it('não confunde chaves compostas inofensivas com dado pessoal', function () {
    expect(PiiScrubber::scrub('x', 'hostname'))->toBe('x')
        ->and(PiiScrubber::scrub('x', 'route_name'))->toBe('x')
        ->and(PiiScrubber::scrub('x', 'filename'))->toBe('x');
});

it('percorre estruturas aninhadas', function () {
    $clean = PiiScrubber::scrub([
        'limiter' => 'lead-submit',
        'form' => ['name' => 'Maria', 'phone' => '(31) 99999-8888', 'consent' => true],
        'items' => [['email' => 'a@b.com', 'id' => 7]],
    ]);

    expect($clean)->toBe([
        'limiter' => 'lead-submit',
        'form' => ['name' => PiiScrubber::REDACTED, 'phone' => PiiScrubber::REDACTED, 'consent' => true],
        'items' => [['email' => PiiScrubber::REDACTED, 'id' => 7]],
    ]);
});

it('mascara e-mails e telefones dentro de texto livre', function (string $text, string $expected) {
    expect(PiiScrubber::scrubText($text))->toBe($expected);
})->with([
    'e-mail' => ['Falha ao enviar para maria.silva+igreja@exemplo.com.br agora', 'Falha ao enviar para [e-mail] agora'],
    'celular com máscara' => ['ligar (31) 99999-8888 hoje', 'ligar [telefone] hoje'],
    'celular só dígitos' => ['tel 31999998888', 'tel [telefone]'],
    'celular com DDI' => ['wpp +55 31 99999-8888.', 'wpp [telefone].'],
    'fixo' => ['fixo 31 3688-1234', 'fixo [telefone]'],
    'sem dado pessoal' => ['Contato 42 recebido na release 2026.11.3', 'Contato 42 recebido na release 2026.11.3'],
    'ulid' => ['01JC8Z3K7Q2W9V5T4N6M8B1X0Y', '01JC8Z3K7Q2W9V5T4N6M8B1X0Y'],
]);

it('mascara texto dentro de arrays e deixa os demais tipos intactos', function () {
    $clean = PiiScrubber::scrub(['detail' => 'erro para a@b.com', 'count' => 3, 'ok' => true, 'ratio' => 0.5, 'none' => null]);

    expect($clean)->toBe(['detail' => 'erro para [e-mail]', 'count' => 3, 'ok' => true, 'ratio' => 0.5, 'none' => null]);
});
