<?php

declare(strict_types=1);

use App\Shared\Sanitizer\HtmlSanitizer;

/*
| BR-046: texto formatado é sanitizado; marcação fora da lista de permissão é removida e o editor avisa.
| Lista: p, br, strong, em, ul, ol, li, a[href] (http/https/mailto, rel forçado), blockquote, h2, h3.
*/

function sanitizer(): HtmlSanitizer
{
    return new HtmlSanitizer(sys_get_temp_dir().'/pibls-htmlpurifier-test');
}

it('BR-046 mantém a marcação permitida e não avisa', function (string $html) {
    $result = sanitizer()->sanitize($html);

    expect($result->html)->toBe($html)->and($result->wasModified)->toBeFalse();
})->with([
    'parágrafo' => ['<p>Graça e paz a todos.</p>'],
    'negrito e itálico' => ['<p><strong>Forte</strong> e <em>suave</em></p>'],
    'quebra de linha' => ['<p>linha 1<br>linha 2</p>'],
    'lista não ordenada' => ['<ul><li>um</li><li>dois</li></ul>'],
    'lista ordenada' => ['<ol><li>um</li><li>dois</li></ol>'],
    'citação' => ['<blockquote><p>Deus é amor.</p></blockquote>'],
    'títulos' => ['<h2>Título</h2><h3>Subtítulo</h3>'],
    'acentos e entidades' => ['<p>Ação &amp; Fé: coração &lt;3</p>'],
]);

it('BR-046 mantém o link com http, https ou mailto e força rel="noopener noreferrer"', function (string $href) {
    $result = sanitizer()->sanitize('<p><a href="'.$href.'">link</a></p>');

    expect($result->html)->toBe('<p><a href="'.$href.'" rel="noopener noreferrer">link</a></p>')
        ->and($result->wasModified)->toBeFalse();
})->with([
    'https' => ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    'http' => ['http://pibls.com/boletins'],
    'mailto' => ['mailto:secretaria@pibls.com'],
    'relativo' => ['/contribua'],
    'âncora' => ['#horarios'],
]);

it('BR-046 troca o rel e o target digitados, sem avisar (o editor os acrescenta sozinho)', function () {
    $result = sanitizer()->sanitize('<p><a href="https://pibls.com" target="_blank" rel="nofollow">site</a></p>');

    expect($result->html)->toBe('<p><a href="https://pibls.com" rel="noopener noreferrer">site</a></p>')
        ->and($result->wasModified)->toBeFalse();
});

it('BR-046 remove script, estilo e frames, e avisa', function (string $html, string $expected) {
    $result = sanitizer()->sanitize($html);

    expect($result->html)->toBe($expected)->and($result->wasModified)->toBeTrue();
})->with([
    'script com conteúdo' => ['<p>Oi</p><script>alert(1)</script>', '<p>Oi</p>'],
    'script no meio do texto' => ['<p>Oi<script>alert(1)</script>!</p>', '<p>Oi!</p>'],
    'style' => ['<style>p{display:none}</style><p>Oi</p>', '<p>Oi</p>'],
    'iframe' => ['<p>Oi</p><iframe src="https://evil.com"></iframe>', '<p>Oi</p>'],
    'imagem com onerror' => ['<p>Oi</p><img src="x" onerror="alert(1)">', '<p>Oi</p>'],
    'objeto' => ['<object data="x.swf"></object><p>Oi</p>', '<p>Oi</p>'],
    'formulário' => ['<form action="https://evil.com"><input name="a"></form><p>Oi</p>', '<p>Oi</p>'],
    'comentário' => ['<p>Oi</p><!-- segredo -->', '<p>Oi</p>'],
]);

it('BR-046 remove atributos de evento e de estilo e avisa', function () {
    $result = sanitizer()->sanitize('<p onclick="alert(1)" style="color:red" class="x" id="y">Oi</p>');

    expect($result->html)->toBe('<p>Oi</p>')->and($result->wasModified)->toBeTrue();
});

it('BR-046 tira a tag fora da lista mas mantém o texto, e avisa', function (string $html, string $expected) {
    $result = sanitizer()->sanitize($html);

    expect($result->html)->toBe($expected)->and($result->wasModified)->toBeTrue();
})->with([
    'div' => ['<div>texto</div>', 'texto'],
    'span' => ['<p>um <span style="color:red">dois</span></p>', '<p>um dois</p>'],
    'h1' => ['<h1>Título</h1>', 'Título'],
    'sublinhado' => ['<p><u>sublinhado</u></p>', '<p>sublinhado</p>'],
    'fonte antiga' => ['<p><font color="red">vermelho</font></p>', '<p>vermelho</p>'],
]);

it('BR-046 recusa links com esquema perigoso (a tag fica, o href não), e avisa', function (string $href) {
    $result = sanitizer()->sanitize('<p><a href="'.$href.'">clique</a></p>');

    expect($result->html)->not->toContain('href=')
        ->and(strtolower($result->html))->not->toContain('javascript')->not->toContain('vbscript')->not->toContain('data:')
        ->and($result->html)->toContain('clique')
        ->and($result->wasModified)->toBeTrue();
})->with([
    'javascript' => ['javascript:alert(1)'],
    'javascript maiúsculo' => ['JaVaScRiPt:alert(1)'],
    'javascript com espaço antes' => ['  javascript:alert(1)'],
    'vbscript' => ['vbscript:msgbox(1)'],
    'data' => ['data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
    'file' => ['file:///etc/passwd'],
]);

it('BR-046 neutraliza o esquema escondido por tab ou entidade (vira endereço relativo codificado) e avisa', function (string $href) {
    $result = sanitizer()->sanitize('<p><a href="'.$href.'">clique</a></p>');

    // Sem o esquema intacto o navegador não executa nada: o valor vira um caminho relativo codificado
    expect(strtolower($result->html))->not->toContain('javascript')->not->toContain('script:')
        ->and($result->html)->not->toMatch('/href="\s*[a-z]+:/i')
        ->and($result->html)->toContain('clique')
        ->and($result->wasModified)->toBeTrue();
})->with([
    'tab dentro do esquema' => ["java\tscript:alert(1)"],
    'entidade dentro do esquema' => ['jav&#x09;ascript:alert(1)'],
]);

it('BR-046 neutraliza vetores clássicos de XSS', function (string $payload) {
    $result = sanitizer()->sanitize($payload);

    $lower = strtolower($result->html);
    foreach (['<script', 'onerror', 'onload', 'onclick', 'onmouseover', 'javascript:', '<svg', '<img', '<iframe', 'expression('] as $forbidden) {
        expect($lower)->not->toContain($forbidden);
    }
    expect($result->wasModified)->toBeTrue();
})->with([
    '<script>alert("XSS")</script>',
    '<IMG SRC="javascript:alert(\'XSS\');">',
    '<img src=x onerror=alert(1)>',
    '<svg/onload=alert(1)>',
    '<body onload=alert(1)>',
    '<a href="javascript:alert(1)" onmouseover="alert(2)">x</a>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<p style="background:url(javascript:alert(1))">x</p>',
    '<div style="width: expression(alert(1))">x</div>',
    '<math><mi//xlink:href="data:x,<script>alert(1)</script>">',
    '<<script>alert(1);//<</script>',
    '<scr<script>ipt>alert(1)</scr</script>ipt>',
    '<a href="https://ok.com" onclick="alert(1)">x</a>',
]);

it('BR-046 é idempotente: sanitizar o resultado não muda nada nem avisa de novo', function () {
    $once = sanitizer()->sanitize('<p>Oi <script>x</script><a href="javascript:1" onclick="2">a</a> <div>b</div></p>');
    $twice = sanitizer()->sanitize($once->html);

    expect($twice->html)->toBe($once->html)->and($twice->wasModified)->toBeFalse();
});

it('trata texto vazio e texto sem marcação', function () {
    expect(sanitizer()->sanitize('')->html)->toBe('')
        ->and(sanitizer()->sanitize('   ')->wasModified)->toBeFalse()
        ->and(sanitizer()->sanitize('Só texto')->html)->toBe('Só texto')
        ->and(sanitizer()->sanitize('Só texto')->wasModified)->toBeFalse();
});

it('entrega o texto puro e a contagem de caracteres, sem marcação', function () {
    $result = sanitizer()->sanitize('<h2>Título</h2><p>Primeira <strong>linha</strong>.<br>Segunda &amp; última.</p><ul><li>um</li><li>dois</li></ul>');

    expect($result->plainText())->toBe('Título Primeira linha. Segunda & última. um dois')
        ->and($result->textLength())->toBe(mb_strlen('Título Primeira linha. Segunda & última. um dois'))
        ->and((string) $result)->toBe($result->html);
});
