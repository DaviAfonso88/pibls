<?php

declare(strict_types=1);

namespace App\Shared\Logging;

use Sentry\Breadcrumb;
use Sentry\Event;
use Sentry\EventHint;
use Sentry\UserDataBag;

/**
 * `before_send` do Sentry (I-06): nenhum dado pessoal sai do servidor.
 *
 * O evento perde corpo, cookies, cabeçalhos e query string da requisição; o usuário fica só com o `id`; textos de
 * exceção, mensagem, extras e breadcrumbs têm e-mails e telefones mascarados.
 * Erros 4xx esperados nunca chegam aqui (ver `ignore_exceptions` em config/sentry.php).
 */
final class SentryScrubber
{
    public static function beforeSend(Event $event, ?EventHint $hint = null): Event
    {
        $request = $event->getRequest();
        $event->setRequest(array_filter([
            'method' => $request['method'] ?? null,
            // Só o caminho: query string pode carregar telefone ou e-mail
            'url' => isset($request['url']) && is_string($request['url'])
                ? strtok($request['url'], '?')
                : null,
        ]));

        $user = $event->getUser();
        $event->setUser($user === null || $user->getId() === null ? null : UserDataBag::createFromUserIdentifier($user->getId()));

        $message = $event->getMessage();
        if ($message !== null) {
            $event->setMessage(PiiScrubber::scrubText($message), []);
        }

        foreach ($event->getExceptions() as $exception) {
            $exception->setValue(PiiScrubber::scrubText($exception->getValue()));
        }

        $event->setExtra(self::scrubArray($event->getExtra()));

        foreach ($event->getContexts() as $name => $data) {
            $event->setContext((string) $name, self::scrubArray($data));
        }

        $event->setBreadcrumb(array_map(
            static fn (Breadcrumb $breadcrumb) => new Breadcrumb(
                $breadcrumb->getLevel(),
                $breadcrumb->getType(),
                $breadcrumb->getCategory(),
                $breadcrumb->getMessage() === null ? null : PiiScrubber::scrubText($breadcrumb->getMessage()),
                self::scrubArray($breadcrumb->getMetadata()),
                $breadcrumb->getTimestamp(),
            ),
            $event->getBreadcrumbs(),
        ));

        return $event;
    }

    /**
     * @param  array<array-key, mixed>  $data
     * @return array<array-key, mixed>
     */
    private static function scrubArray(array $data): array
    {
        $clean = PiiScrubber::scrub($data);

        return is_array($clean) ? $clean : [];
    }
}
