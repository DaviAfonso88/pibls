<?php

declare(strict_types=1);

namespace App\Modules\Events\Web;

use App\Modules\Events\Models\Event;
use App\Modules\Platform\Web\SitemapSource;

/**
 * Os eventos no `sitemap.xml` (contracts/web-routes.md): a lista `/eventos` e cada evento publicado, com `lastmod`. Com
 * `FEATURE_EVENTS` desligada, nada: a página nem existe.
 */
final class EventsSitemapSource implements SitemapSource
{
    public function entries(): array
    {
        if (config('features.events') !== true) {
            return [];
        }

        $entries = [['path' => '/eventos', 'lastmod' => null]];

        $events = Event::query()
            ->where('is_published', true)
            ->orderByDesc('starts_at')
            ->orderByDesc('id')
            ->get(['id', 'slug', 'starts_at', 'updated_at']);

        foreach ($events as $event) {
            $entries[] = [
                'path' => '/eventos/'.$event->slug,
                'lastmod' => ($event->updated_at ?? $event->starts_at)->copy()->utc()->format('Y-m-d'),
            ];
        }

        return $entries;
    }
}
