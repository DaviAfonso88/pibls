<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Actions\FindPublishedEvent;
use App\Modules\Events\Models\Event;
use App\Modules\Platform\Web\MetaShell;
use Illuminate\Http\Response;

/**
 * `GET /eventos/{slug}` (ADR-004): o HTML de fallback da SPA com a meta do evento injetada (título, resumo, `og:image` =
 * banner e JSON-LD `Event`), para o WhatsApp e os buscadores lerem sem executar JavaScript. Evento inexistente, rascunho ou
 * com `FEATURE_EVENTS` desligada devolve o mesmo HTML com status 404 e `noindex`; a SPA mostra a página de "não encontrado".
 */
final class EventMetaShellController
{
    private const SITE_NAME = 'Primeira Igreja Batista em Lagoa Santa';

    private const SHORT_NAME = 'PIBLS';

    private const LOCAL_ZONE = 'America/Sao_Paulo';

    public function __invoke(string $slug, FindPublishedEvent $find): Response
    {
        $event = $find($slug);

        if ($event === null) {
            return $this->html(
                MetaShell::inject(MetaShell::load(), [
                    'title' => 'Página não encontrada — '.self::SHORT_NAME,
                    'description' => 'Não encontramos o que você procurou.',
                    'url' => $this->absolute('/eventos/'.$slug),
                    'image' => $this->absolute('/og-default.png'),
                    'siteName' => self::SITE_NAME,
                ], null, noindex: true),
                404,
                'no-store',
            );
        }

        return $this->html(
            MetaShell::inject(MetaShell::load(), [
                'title' => $event->title.' — '.self::SHORT_NAME,
                'description' => $event->excerpt,
                'url' => $this->absolute('/eventos/'.$event->slug),
                'image' => $this->image($event),
                'siteName' => self::SITE_NAME,
            ], $this->jsonLd($event)),
            200,
            'public, max-age=300',
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function jsonLd(Event $event): array
    {
        $data = [
            '@context' => 'https://schema.org',
            '@type' => 'Event',
            'name' => $event->title,
            'description' => $event->excerpt,
            'startDate' => $event->starts_at->copy()->setTimezone(self::LOCAL_ZONE)->toIso8601String(),
            'eventStatus' => 'https://schema.org/EventScheduled',
            'eventAttendanceMode' => 'https://schema.org/OfflineEventAttendanceMode',
            'location' => ['@type' => 'Place', 'name' => $event->location, 'address' => $event->location],
            'image' => [$this->image($event)],
            'url' => $this->absolute('/eventos/'.$event->slug),
            'organizer' => ['@type' => 'Organization', 'name' => self::SITE_NAME],
        ];

        if ($event->ends_at !== null) {
            $data['endDate'] = $event->ends_at->copy()->setTimezone(self::LOCAL_ZONE)->toIso8601String();
        }

        return $data;
    }

    /** O banner grande, ou a imagem padrão da igreja. */
    private function image(Event $event): string
    {
        return $this->absolute($event->bannerUrl() ?? '/og-default.png');
    }

    private function absolute(string $path): string
    {
        return rtrim((string) config('app.url'), '/').$path;
    }

    private function html(string $html, int $status, string $cacheControl): Response
    {
        return response($html, $status, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => $cacheControl,
        ]);
    }
}
