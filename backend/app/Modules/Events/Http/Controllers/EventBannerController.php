<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Access\Models\User;
use App\Modules\Events\Actions\RemoveEventBanner;
use App\Modules\Events\Actions\ReplaceEventBanner;
use App\Modules\Events\Http\Requests\EventBannerRequest;
use App\Modules\Events\Models\Event;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/**
 * O banner do evento no painel (BR-045). Quem pode mexer no evento pode mexer no banner (`EventPolicy::manage`).
 */
final class EventBannerController
{
    /** `POST /api/admin/events/{id}/banner`: troca o banner; os arquivos anteriores são apagados. */
    public function store(EventBannerRequest $request, Event $event, ReplaceEventBanner $replace): JsonResponse
    {
        $event = $replace($event, $request->file('banner'), $this->user($request));

        return response()->json(['data' => [
            'banner_url' => $event->bannerUrl(),
            'banner_small_url' => $event->bannerSmallUrl(),
        ]]);
    }

    /** `DELETE /api/admin/events/{id}/banner`. */
    public function destroy(Request $request, Event $event, RemoveEventBanner $remove): Response
    {
        Gate::authorize('manage', $event);

        $remove($event, $this->user($request));

        return response()->noContent();
    }

    private function user(Request $request): User
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        return $user;
    }
}
