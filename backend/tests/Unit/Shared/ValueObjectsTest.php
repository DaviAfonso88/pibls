<?php

declare(strict_types=1);

use App\Shared\ValueObjects\Cnpj;
use App\Shared\ValueObjects\Consent;
use App\Shared\ValueObjects\EmailAddress;
use App\Shared\ValueObjects\EventPeriod;
use App\Shared\ValueObjects\InvalidValueObject;
use App\Shared\ValueObjects\PersonName;
use App\Shared\ValueObjects\PhoneNumber;
use App\Shared\ValueObjects\PixCopyPasteCode;
use App\Shared\ValueObjects\PostalAddress;
use App\Shared\ValueObjects\ScheduleItem;
use App\Shared\ValueObjects\Slug;
use App\Shared\ValueObjects\YoutubeUrl;

/** O motivo (`reason`) é o código estável que a camada de validação traduz na mensagem pt-BR da BR. */
function reasonOf(Closure $callback): string
{
    try {
        $callback();
    } catch (InvalidValueObject $e) {
        return $e->reason;
    }

    return 'não lançou';
}

// ---------------------------------------------------------------------------------------------------------------
// PhoneNumber
// ---------------------------------------------------------------------------------------------------------------

it('BR-004 normaliza o telefone para E.164 e exibe com máscara', function (string $input, string $e164, string $formatted) {
    $phone = PhoneNumber::from($input);

    expect($phone->e164())->toBe($e164)
        ->and($phone->formatted())->toBe($formatted)
        ->and((string) $phone)->toBe($e164);
})->with([
    'celular com máscara' => ['(31) 99999-8888', '+5531999998888', '(31) 99999-8888'],
    'celular só dígitos' => ['31999998888', '+5531999998888', '(31) 99999-8888'],
    'celular com espaços' => [' 31 99999 8888 ', '+5531999998888', '(31) 99999-8888'],
    'fixo de 10 dígitos' => ['(31) 3688-1234', '+553136881234', '(31) 3688-1234'],
    'com DDI e +' => ['+55 31 99999-8888', '+5531999998888', '(31) 99999-8888'],
    'com DDI sem +' => ['5531999998888', '+5531999998888', '(31) 99999-8888'],
    'o número do WhatsApp da igreja (8 dígitos depois do DDD)' => ['553196441952', '+553196441952', '(31) 9644-1952'],
    'DDD 55 (RS) com 10 dígitos não é confundido com o DDI' => ['5533334444', '+555533334444', '(55) 3333-4444'],
]);

it('BR-004 recusa telefone fora de 10 ou 11 dígitos ou com DDD inválido', function (string $input) {
    expect(reasonOf(fn () => PhoneNumber::from($input)))->toBe('invalid_phone');
})->with([
    'vazio' => [''],
    'letras' => ['abc'],
    '9 dígitos' => ['319999888'],
    '12 dígitos sem DDI' => ['319999988880'],
    '14 dígitos' => ['55319999988880'],
    'DDD 10' => ['1099998888'],
    'DDD 00' => ['0099998888'],
    'DDD 01 com 11 dígitos' => ['01999998888'],
]);

it('BR-004 aceita DDD de 11 a 99', function () {
    expect(PhoneNumber::from('11999998888')->ddd())->toBe('11')
        ->and(PhoneNumber::from('99999998888')->ddd())->toBe('99');
});

it('compara telefones pelo número, não pela máscara', function () {
    expect(PhoneNumber::from('(31) 99999-8888')->equals(PhoneNumber::from('+55 31 999998888')))->toBeTrue()
        ->and(PhoneNumber::from('31999998888')->equals(PhoneNumber::from('31999998889')))->toBeFalse()
        ->and(PhoneNumber::tryFrom('lixo'))->toBeNull()
        ->and(PhoneNumber::tryFrom(null))->toBeNull();
});

// ---------------------------------------------------------------------------------------------------------------
// EmailAddress
// ---------------------------------------------------------------------------------------------------------------

it('BR-004 guarda o e-mail em minúsculas e sem espaços nas pontas', function () {
    $email = EmailAddress::from('  Maria.Silva+Igreja@Exemplo.COM.br ');

    expect($email->value())->toBe('maria.silva+igreja@exemplo.com.br')
        ->and($email->domain())->toBe('exemplo.com.br')
        ->and($email->equals(EmailAddress::from('MARIA.SILVA+IGREJA@exemplo.com.br')))->toBeTrue();
});

it('BR-004 recusa e-mail inválido ou acima de 254 caracteres', function (string $input) {
    expect(reasonOf(fn () => EmailAddress::from($input)))->toBe('invalid_email');
})->with([
    'vazio' => [''],
    'sem arroba' => ['maria.exemplo.com'],
    'sem domínio' => ['maria@'],
    'sem usuário' => ['@exemplo.com'],
    'com espaço no meio' => ['ma ria@exemplo.com'],
    'dois arrobas' => ['a@b@exemplo.com'],
    'acima de 254' => [str_repeat('a', 64).'@'.str_repeat('b', 63).'.'.str_repeat('c', 63).'.'.str_repeat('d', 63).'.com'],
]);

it('aceita e-mail com exatamente 254 caracteres ou menos', function () {
    $local = str_repeat('a', 64);
    $email = $local.'@'.str_repeat('b', 63).'.'.str_repeat('c', 63).'.'.str_repeat('d', 55).'.com';

    expect(strlen($email))->toBeLessThanOrEqual(254)
        ->and(EmailAddress::from($email)->value())->toBe($email)
        ->and(EmailAddress::tryFrom('nao e email'))->toBeNull();
});

// ---------------------------------------------------------------------------------------------------------------
// PersonName
// ---------------------------------------------------------------------------------------------------------------

it('BR-004 limpa o nome: sem espaços nas pontas e com os internos colapsados', function () {
    $name = PersonName::from("  José   da \t Conceição  ");

    expect($name->value())->toBe('José da Conceição');
});

it('BR-022 compara nomes pela forma normalizada (minúsculas, sem acentos)', function () {
    $name = PersonName::from('José da Conceição');

    expect($name->normalized())->toBe('jose da conceicao')
        ->and($name->equals(PersonName::from('JOSE  DA CONCEICAO')))->toBeTrue()
        ->and($name->equals(PersonName::from('José da Silva')))->toBeFalse();
});

it('BR-004 recusa nome curto, longo ou sem letra', function (string $input) {
    expect(reasonOf(fn () => PersonName::from($input)))->toBe('invalid_name');
})->with([
    'vazio' => [''],
    'só espaços' => ['   '],
    'uma letra' => ['A'],
    'só números' => ['12345'],
    'só símbolos' => ['--'],
    '121 caracteres' => [str_repeat('a', 121)],
]);

it('BR-004 aceita nome de 2 a 120 caracteres, inclusive com apóstrofo e hífen', function () {
    expect(PersonName::from('Jo')->value())->toBe('Jo')
        ->and(PersonName::from(str_repeat('a', 120))->value())->toHaveLength(120)
        ->and(PersonName::from("D'Ávila-Souza")->value())->toBe("D'Ávila-Souza")
        ->and(PersonName::tryFrom('1'))->toBeNull();
});

// ---------------------------------------------------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------------------------------------------------

it('BR-032 aceita slug em minúsculas, números e hífens simples', function (string $slug) {
    expect(Slug::from($slug)->value())->toBe($slug);
})->with(['graca-e-paz', 'culto-2026', '7', 'a-b-c']);

it('BR-032 recusa slug fora do padrão', function (string $slug) {
    expect(reasonOf(fn () => Slug::from($slug)))->toBe('invalid_slug');
})->with([
    'vazio' => [''],
    'maiúscula' => ['Graca'],
    'acento' => ['graça'],
    'hífen no início' => ['-graca'],
    'hífen no fim' => ['graca-'],
    'hífen duplo' => ['graca--paz'],
    'espaço' => ['graca paz'],
    'underline' => ['graca_paz'],
    '161 caracteres' => [str_repeat('a', 161)],
]);

it('BR-032 compara slugs e tryFrom devolve null para o inválido', function () {
    expect(Slug::from('graca-e-paz')->equals(Slug::from('graca-e-paz')))->toBeTrue()
        ->and(Slug::from('graca-e-paz')->equals(Slug::from('graca')))->toBeFalse()
        ->and((string) Slug::from('graca-e-paz'))->toBe('graca-e-paz')
        ->and(Slug::tryFrom('Graça!'))->toBeNull()
        ->and(Slug::tryFrom(null))->toBeNull()
        ->and(Slug::tryFrom('graca')?->value())->toBe('graca');
});

it('BR-032 gera o slug a partir do título', function () {
    expect(Slug::fromTitle('Graça e Paz!')->value())->toBe('graca-e-paz')
        ->and(Slug::fromTitle('  Culto de Ação de Graças — 2026 ')->value())->toBe('culto-de-acao-de-gracas-2026')
        ->and(Slug::fromTitle(str_repeat('palavra ', 40))->value())->toHaveLength(159)
        ->and(reasonOf(fn () => Slug::fromTitle('!!! ???')))->toBe('invalid_slug');
});

// ---------------------------------------------------------------------------------------------------------------
// Cnpj
// ---------------------------------------------------------------------------------------------------------------

it('BR-061 aceita o CNPJ da igreja com ou sem máscara e o exibe formatado', function (string $input) {
    $cnpj = Cnpj::from($input);

    expect($cnpj->digits())->toBe('20969119000184')
        ->and($cnpj->formatted())->toBe('20.969.119/0001-84')
        ->and((string) $cnpj)->toBe('20969119000184');
})->with(['20969119000184', '20.969.119/0001-84', ' 20 969 119 0001 84 ']);

it('BR-061 recusa CNPJ com dígito verificador errado, tamanho errado ou repetido', function (string $input) {
    expect(reasonOf(fn () => Cnpj::from($input)))->toBe('invalid_cnpj');
})->with([
    'primeiro verificador' => ['20969119000194'],
    'segundo verificador' => ['20969119000185'],
    'curto' => ['2096911900018'],
    'longo' => ['209691190001840'],
    'só zeros' => ['00000000000000'],
    'só noves' => ['99999999999999'],
    'letras' => ['abcdefghijklmn'],
]);

it('BR-061 compara CNPJs pelos dígitos', function () {
    expect(Cnpj::from('20.969.119/0001-84')->equals(Cnpj::from('20969119000184')))->toBeTrue()
        ->and(Cnpj::tryFrom('123'))->toBeNull();
});

// ---------------------------------------------------------------------------------------------------------------
// PixCopyPasteCode
// ---------------------------------------------------------------------------------------------------------------

const PIX_SAMPLE = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D';

it('BR-062 calcula o CRC16-CCITT (vetor padrão 123456789 = 29B1)', function () {
    expect(PixCopyPasteCode::crc16('123456789'))->toBe('29B1')
        ->and(PixCopyPasteCode::crc16(''))->toBe('FFFF');
});

it('BR-062 aceita o exemplo do Manual do BR Code, que tem CRC 1D3D', function () {
    expect(PixCopyPasteCode::from(PIX_SAMPLE)->value())->toBe(PIX_SAMPLE)
        ->and(PixCopyPasteCode::from('  '.PIX_SAMPLE."\n")->value())->toBe(PIX_SAMPLE);
});

it('BR-062 aceita o CRC em minúsculas', function () {
    $lower = substr(PIX_SAMPLE, 0, -4).strtolower(substr(PIX_SAMPLE, -4));

    expect(PixCopyPasteCode::from($lower)->value())->toBe($lower);
});

it('BR-062 recusa código com CRC errado ou adulterado', function (string $code) {
    expect(reasonOf(fn () => PixCopyPasteCode::from($code)))->toBe('invalid_pix_code');
})->with([
    'CRC trocado' => [substr(PIX_SAMPLE, 0, -4).'0000'],
    'um caractere do payload alterado' => [str_replace('Fulano', 'Fulana', PIX_SAMPLE)],
    'sem CRC' => [substr(PIX_SAMPLE, 0, -8)],
    'não começa com 000201' => ['x'.PIX_SAMPLE],
    'vazio' => [''],
    'texto qualquer' => ['isto não é um código pix'],
    'tamanho de campo estoura o código' => ['000201'.'2699'.str_repeat('x', 20).'6304ABCD'],
]);

it('BR-062 recusa código acima de 512 caracteres, mesmo com CRC correto', function () {
    $payload = '000201'.'26'.'99'.str_repeat('x', 99);
    $payload .= '27'.'99'.str_repeat('y', 99);
    $payload .= '28'.'99'.str_repeat('z', 99);
    $payload .= '29'.'99'.str_repeat('w', 99);
    $payload .= '30'.'99'.str_repeat('v', 99);
    $payload .= '6304';
    $code = $payload.PixCopyPasteCode::crc16($payload);

    expect(strlen($code))->toBeGreaterThan(512)
        ->and(reasonOf(fn () => PixCopyPasteCode::from($code)))->toBe('invalid_pix_code')
        ->and(PixCopyPasteCode::tryFrom($code))->toBeNull()
        ->and(PixCopyPasteCode::tryFrom(null))->toBeNull();
});

// ---------------------------------------------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------------------------------------------

it('BR-001 recusa consentimento não aceito', function () {
    expect(reasonOf(fn () => Consent::given(false, '1.0')))->toBe('consent_required');
});

it('BR-001 e BR-082 gravam o momento em UTC e a versão vigente da política', function () {
    $consent = Consent::given(true, '2026-10-v2', new DateTimeImmutable('2026-10-22 10:30:00', new DateTimeZone('-03:00')));

    expect($consent->toAttributes())->toBe(['consent_at' => '2026-10-22 13:30:00', 'consent_version' => '2026-10-v2'])
        ->and($consent->at->getTimezone()->getName())->toBe('UTC');
});

it('BR-001 usa o instante atual quando não recebe um', function () {
    $before = time();
    $consent = Consent::given(true, '1.0');

    expect($consent->at->getTimestamp())->toBeGreaterThanOrEqual($before)->toBeLessThanOrEqual(time());
});

// ---------------------------------------------------------------------------------------------------------------
// EventPeriod
// ---------------------------------------------------------------------------------------------------------------

it('BR-025 recusa término anterior ao início', function () {
    expect(reasonOf(fn () => EventPeriod::of(new DateTimeImmutable('2026-11-08 10:00'), new DateTimeImmutable('2026-11-08 09:59'))))
        ->toBe('invalid_event_period');
});

it('BR-025 aceita término igual ou posterior ao início, e término vazio', function () {
    $start = new DateTimeImmutable('2026-11-08 10:00:00', new DateTimeZone('UTC'));

    expect(EventPeriod::of($start, $start)->effectiveEnd()->toDateTimeString())->toBe('2026-11-08 10:00:00')
        ->and(EventPeriod::of($start, new DateTimeImmutable('2026-11-08 12:00:00'))->effectiveEnd()->toDateTimeString())->toBe('2026-11-08 12:00:00')
        ->and(EventPeriod::of($start)->endsAt)->toBeNull()
        ->and(EventPeriod::of($start)->effectiveEnd()->toDateTimeString())->toBe('2026-11-08 10:00:00');
});

it('BR-025 compara os instantes em UTC, qualquer que seja o fuso de entrada', function () {
    $period = EventPeriod::of(
        new DateTimeImmutable('2026-11-08 10:00:00', new DateTimeZone('-03:00')),
        new DateTimeImmutable('2026-11-08 14:00:00', new DateTimeZone('UTC')),
    );

    expect($period->startsAt->toDateTimeString())->toBe('2026-11-08 13:00:00')
        ->and($period->endsAt?->toDateTimeString())->toBe('2026-11-08 14:00:00');
});

it('sabe se o evento começou e se terminou (derivado de coalesce(ends_at, starts_at))', function () {
    $period = EventPeriod::of(new DateTimeImmutable('2026-11-08 10:00:00 UTC'), new DateTimeImmutable('2026-11-08 12:00:00 UTC'));

    expect($period->hasStarted(new DateTimeImmutable('2026-11-08 09:59:59 UTC')))->toBeFalse()
        ->and($period->hasStarted(new DateTimeImmutable('2026-11-08 10:00:00 UTC')))->toBeTrue()
        ->and($period->hasEnded(new DateTimeImmutable('2026-11-08 12:00:00 UTC')))->toBeFalse()
        ->and($period->hasEnded(new DateTimeImmutable('2026-11-08 12:00:01 UTC')))->toBeTrue();
});

// ---------------------------------------------------------------------------------------------------------------
// ScheduleItem
// ---------------------------------------------------------------------------------------------------------------

function scheduleData(array $override = []): array
{
    return array_merge([
        'day' => 'Domingo', 'recurrence' => 'semanal', 'activity' => 'Culto Matinal', 'time' => '10:10',
        'mode' => 'Presencial e YouTube',
    ], $override);
}

it('guarda um item do quadro de horários', function () {
    $item = ScheduleItem::from(scheduleData(['activity' => '  Culto   Matinal ']));

    expect($item->toArray())->toBe(scheduleData());
});

it('recusa horário fora de HH:MM e texto vazio ou longo demais', function (array $override) {
    expect(reasonOf(fn () => ScheduleItem::from(scheduleData($override))))->toBe('invalid_schedule_item');
})->with([
    'hora 24' => [['time' => '24:00']],
    'minuto 60' => [['time' => '10:60']],
    'sem zero à esquerda' => [['time' => '9:00']],
    'texto no horário' => [['time' => 'dez e dez']],
    'horário ausente' => [['time' => null]],
    'atividade vazia' => [['activity' => '   ']],
    'atividade longa' => [['activity' => str_repeat('a', 121)]],
    'modalidade ausente' => [['mode' => null]],
]);

it('aceita até 20 itens no quadro de horários', function () {
    $twenty = array_fill(0, 20, scheduleData());

    expect(ScheduleItem::listFrom($twenty))->toHaveCount(20)
        ->and(reasonOf(fn () => ScheduleItem::listFrom([...$twenty, scheduleData()])))->toBe('too_many_schedule_items');
});

// ---------------------------------------------------------------------------------------------------------------
// PostalAddress
// ---------------------------------------------------------------------------------------------------------------

function addressData(array $override = []): array
{
    return array_merge([
        'street' => 'Rua das Flores', 'number' => '123', 'complement' => 'Sala 2', 'neighborhood' => 'Centro',
        'city' => 'Lagoa Santa', 'state' => 'mg', 'zip' => '33400-000',
    ], $override);
}

it('guarda o endereço com UF em maiúsculas e CEP só com dígitos', function () {
    $address = PostalAddress::from(addressData());

    expect($address->state)->toBe('MG')
        ->and($address->zip)->toBe('33400000')
        ->and($address->formatted())->toBe('Rua das Flores, 123, Sala 2 - Centro, Lagoa Santa/MG - CEP 33400-000')
        ->and($address->toArray()['zip'])->toBe('33400000');
});

it('aceita endereço sem complemento', function () {
    $address = PostalAddress::from(addressData(['complement' => '  ']));

    expect($address->complement)->toBeNull()
        ->and($address->formatted())->toBe('Rua das Flores, 123 - Centro, Lagoa Santa/MG - CEP 33400-000');
});

it('recusa CEP sem 8 dígitos, UF desconhecida e campo obrigatório vazio', function (array $override, string $reason) {
    expect(reasonOf(fn () => PostalAddress::from(addressData($override))))->toBe($reason);
})->with([
    'CEP curto' => [['zip' => '3340000'], 'invalid_zip'],
    'CEP longo' => [['zip' => '334000000'], 'invalid_zip'],
    'UF inexistente' => [['state' => 'XX'], 'invalid_state'],
    'UF por extenso' => [['state' => 'Minas Gerais'], 'invalid_state'],
    'logradouro vazio' => [['street' => ''], 'invalid_address'],
    'bairro ausente' => [['neighborhood' => null], 'invalid_address'],
    'cidade ausente' => [['city' => null], 'invalid_address'],
    'número longo' => [['number' => str_repeat('1', 21)], 'invalid_address'],
]);

// ---------------------------------------------------------------------------------------------------------------
// YoutubeUrl
// ---------------------------------------------------------------------------------------------------------------

it('BR-044 aceita links do YouTube e extrai o id do vídeo', function (string $url) {
    $youtube = YoutubeUrl::from($url);

    expect($youtube->videoId())->toBe('dQw4w9WgXcQ')
        ->and($youtube->url())->toBe($url)
        ->and($youtube->thumbnailUrl())->toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
})->with([
    'watch' => ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    'watch com outros parâmetros' => ['https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=10s'],
    'mobile' => ['https://m.youtube.com/watch?v=dQw4w9WgXcQ'],
    'youtu.be' => ['https://youtu.be/dQw4w9WgXcQ'],
    'youtu.be com tempo' => ['https://youtu.be/dQw4w9WgXcQ?t=42'],
    'embed' => ['https://www.youtube.com/embed/dQw4w9WgXcQ'],
    'shorts' => ['https://www.youtube.com/shorts/dQw4w9WgXcQ'],
    'live' => ['https://www.youtube.com/live/dQw4w9WgXcQ'],
    'http' => ['http://www.youtube.com/watch?v=dQw4w9WgXcQ'],
]);

it('BR-044 recusa o que não é link do YouTube', function (string $url) {
    expect(reasonOf(fn () => YoutubeUrl::from($url)))->toBe('invalid_youtube_url');
})->with([
    'vazio' => [''],
    'outro site' => ['https://vimeo.com/123456789'],
    'host parecido' => ['https://www.youtube.com.evil.com/watch?v=dQw4w9WgXcQ'],
    'subdomínio não listado' => ['https://music.youtube.com/watch?v=dQw4w9WgXcQ'],
    'usuário na URL' => ['https://youtube.com@evil.com/watch?v=dQw4w9WgXcQ'],
    'youtube.com no caminho' => ['https://evil.com/youtube.com/watch?v=dQw4w9WgXcQ'],
    'esquema perigoso' => ['javascript://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    'sem esquema' => ['www.youtube.com/watch?v=dQw4w9WgXcQ'],
    'canal sem vídeo' => ['https://www.youtube.com/@batistaemlagoasanta'],
    'id curto' => ['https://youtu.be/abc'],
    'id com caractere inválido' => ['https://youtu.be/dQw4w9WgXc!'],
    'watch sem v' => ['https://www.youtube.com/watch'],
]);

it('YoutubeUrl::tryFrom devolve null para o que não é do YouTube', function () {
    expect(YoutubeUrl::tryFrom('https://vimeo.com/1'))->toBeNull()
        ->and(YoutubeUrl::tryFrom(null))->toBeNull()
        ->and(YoutubeUrl::tryFrom('https://youtu.be/dQw4w9WgXcQ')?->videoId())->toBe('dQw4w9WgXcQ');
});
