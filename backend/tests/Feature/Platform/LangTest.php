<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Lang;

/*
| i18n / L10n: tudo em pt-BR, com os textos das regras de negócio exatamente como no architecture.md.
*/

/** @return array<string, list<string>> id da BR → mensagens entre aspas da última coluna da tabela do documento */
function businessRulesFromArchitecture(): array
{
    $document = base_path('../docs/architecture.md');
    if (! is_file($document)) {
        test()->markTestSkipped('docs/architecture.md não está montado neste ambiente.');
    }

    $rules = [];
    foreach (explode("\n", (string) file_get_contents($document)) as $line) {
        if (preg_match('/^\| (BR-\d{3}) \|/', $line, $match) !== 1) {
            continue;
        }

        $columns = array_map('trim', explode(' | ', trim($line, "| \t")));
        $messageColumn = end($columns);
        preg_match_all('/"([^"]+)"/', (string) $messageColumn, $quoted);
        $rules[$match[1]] = $quoted[1];
    }

    return $rules;
}

it('usa pt-BR como idioma da aplicação', function () {
    expect(config('app.locale'))->toBe('pt_BR')
        ->and(config('app.fallback_locale'))->toBe('pt_BR')
        ->and(config('app.timezone'))->toBe('UTC');
});

it('BR-004 e BR-024 a validação do Laravel já responde em pt-BR', function () {
    $validator = validator(['email' => 'nao-e-email'], ['name' => 'required', 'email' => 'email']);

    expect($validator->errors()->first('name'))->toBe('Este campo é obrigatório.')
        ->and($validator->errors()->first('email'))->toBe('Informe um e-mail válido.');
});

it('traduz as demais regras do framework com o nome do campo', function () {
    $validator = validator(['phone' => 'x', 'zip' => '123'], ['phone' => 'min:5', 'zip' => 'digits:8']);

    expect($validator->errors()->first('phone'))->toBe('O campo telefone precisa ter pelo menos 5 caracteres.')
        ->and($validator->errors()->first('zip'))->toBe('O campo CEP precisa ter 8 dígitos.');
});

it('não deixa nenhuma mensagem de validação em inglês', function () {
    $messages = Lang::get('validation', locale: 'pt_BR');
    $english = [];
    array_walk_recursive($messages, function (string $text, string|int $key) use (&$english) {
        if (preg_match('/\b(The|field|must|should|please)\b/', $text) === 1) {
            $english[] = "{$key}: {$text}";
        }
    });

    expect($english)->toBe([]);
});

it('tem a tradução de todas as regras que o framework traz', function () {
    // O arquivo em inglês que o próprio framework traz: toda chave dele precisa ter a versão em pt-BR
    $published = base_path('vendor/laravel/framework/src/Illuminate/Translation/lang/en/validation.php');

    $missing = array_diff_key(require $published, Lang::get('validation', locale: 'pt_BR'));
    unset($missing['custom'], $missing['attributes']);

    expect(array_keys($missing))->toBe([]);
});

it('os textos de business.php são exatamente os da tabela de regras do architecture.md', function () {
    $fromDocument = businessRulesFromArchitecture();
    $translated = Lang::get('business', locale: 'pt_BR');

    foreach ($translated as $rule => $texts) {
        expect(array_keys($fromDocument))->toContain($rule);
        foreach ((array) $texts as $text) {
            expect($fromDocument[$rule])->toContain($text);
        }
    }
});

it('toda regra do architecture.md com mensagem ao usuário tem texto em business.php', function () {
    $fromDocument = array_filter(businessRulesFromArchitecture());
    $translated = Lang::get('business', locale: 'pt_BR');

    foreach ($fromDocument as $rule => $texts) {
        // "Mensagem de sucesso genérica" (BR-002) não é texto de erro; os demais têm aspas na tabela
        expect(array_keys($translated))->toContain($rule);
        expect(array_values(array_filter(
            $texts,
            fn (string $text) => ! in_array($text, (array) $translated[$rule], true),
        )))->toBe([]);
    }
});

it('as mensagens do envelope de erro coincidem com as regras de negócio equivalentes', function () {
    expect(__('errors.too_many_requests'))->toBe(__('business.BR-003'))
        ->and(__('errors.unauthenticated'))->toBe(__('business.BR-074'))
        ->and(__('errors.forbidden'))->toBe(__('business.BR-076'))
        ->and(__('auth.failed'))->toBe(__('business.BR-070'))
        ->and(__('auth.throttle'))->toBe(__('business.BR-071'))
        ->and(__('passwords.token'))->toBe(__('business.BR-072'));
});
