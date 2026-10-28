<?php

declare(strict_types=1);

use App\Shared\Http\BusinessRuleException;
use App\Shared\Logging\SentryScrubber;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;
use Sentry\Breadcrumb;
use Sentry\Event;
use Sentry\ExceptionDataBag;
use Sentry\UserDataBag;

/*
| Observability → Error tracking (I-06): `before_send` remove PII; o usuário vai só pelo id.
*/

function sentryEvent(): Event
{
    $event = Event::createEvent();
    $event->setRequest([
        'method' => 'POST',
        'url' => 'https://pibls.com/api/public/leads?phone=31999998888&email=ana@exemplo.com',
        'data' => ['name' => 'Maria', 'phone' => '31999998888', 'message' => 'oração'],
        'cookies' => ['pibls_session' => 'segredo'],
        'headers' => ['Cookie' => 'segredo', 'X-XSRF-TOKEN' => 'segredo'],
        'query_string' => 'phone=31999998888',
    ]);
    $event->setUser(UserDataBag::createFromArray(['id' => 7, 'email' => 'ana@exemplo.com', 'username' => 'ana', 'ip_address' => '10.0.0.1']));
    $event->setMessage('Falha para ana@exemplo.com');
    $event->setExceptions([new ExceptionDataBag(new RuntimeException('SQL com 31 99999-8888'))]);
    $event->setExtra(['phone' => '31999998888', 'limiter' => 'lead-submit', 'detail' => 'joao@exemplo.com']);
    $event->setContext('app', ['email' => 'ana@exemplo.com', 'release' => '2026.11.3']);
    $event->setBreadcrumb([new Breadcrumb(Breadcrumb::LEVEL_INFO, Breadcrumb::TYPE_DEFAULT, 'app', 'contato de ana@exemplo.com', ['email' => 'ana@exemplo.com'])]);

    return $event;
}

it('mantém da requisição só o método e o caminho, sem corpo, cookies, cabeçalhos nem query string', function () {
    $event = SentryScrubber::beforeSend(sentryEvent());

    expect($event->getRequest())->toBe(['method' => 'POST', 'url' => 'https://pibls.com/api/public/leads']);
});

it('deixa o usuário só com o id', function () {
    $user = SentryScrubber::beforeSend(sentryEvent())->getUser();

    expect($user)->not->toBeNull()
        ->and($user->getId())->toBe(7)
        ->and($user->getEmail())->toBeNull()
        ->and($user->getUsername())->toBeNull()
        ->and($user->getIpAddress())->toBeNull();
});

it('remove o usuário quando não há id', function () {
    $event = sentryEvent();
    $event->setUser(UserDataBag::createFromArray(['email' => 'ana@exemplo.com']));

    expect(SentryScrubber::beforeSend($event)->getUser())->toBeNull();
});

it('mascara e-mail e telefone na mensagem, na exceção, nos extras, no contexto e nos breadcrumbs', function () {
    $event = SentryScrubber::beforeSend(sentryEvent());

    expect($event->getMessage())->toBe('Falha para [e-mail]')
        ->and($event->getExceptions()[0]->getValue())->toBe('SQL com [telefone]')
        ->and($event->getExtra())->toBe(['phone' => '[removido]', 'limiter' => 'lead-submit', 'detail' => '[e-mail]'])
        ->and($event->getContexts()['app'])->toBe(['email' => '[removido]', 'release' => '2026.11.3'])
        ->and($event->getBreadcrumbs()[0]->getMessage())->toBe('contato de [e-mail]')
        ->and($event->getBreadcrumbs()[0]->getMetadata())->toBe(['email' => '[removido]']);
});

it('o config/sentry.php liga o before_send e ignora os erros 4xx esperados', function () {
    $config = require base_path('config/sentry.php');

    expect($config['before_send'])->toBe([SentryScrubber::class, 'beforeSend'])
        ->and($config['send_default_pii'])->toBeFalse()
        ->and($config['ignore_exceptions'])->toContain(
            ValidationException::class,
            BusinessRuleException::class,
            AuthenticationException::class,
            AuthorizationException::class,
            ModelNotFoundException::class,
        )
        ->and($config['dsn'])->toBeNull();
});
