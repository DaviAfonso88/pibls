<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Access\Models\User;
use App\Modules\Events\Actions\ListTodayRegistrations;
use App\Modules\Events\Http\Resources\TodayRegistrationResource;
use App\Modules\Events\Models\EventRegistration;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * `GET /api/admin/registrations/today`: as inscrições de hoje para o Início do painel (nome abreviado, com o total do dia).
 * A flag `events` é conferida na rota; a permissão, na `EventRegistrationPolicy::viewToday`.
 */
final class TodayRegistrationsController
{
    public function __invoke(Request $request, ListTodayRegistrations $list): JsonResponse
    {
        Gate::authorize('viewToday', EventRegistration::class);

        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        $today = $list($user);

        return response()
            ->json([
                'data' => TodayRegistrationResource::collection($today['registrations'])->resolve($request),
                'meta' => ['total' => $today['total']],
            ])
            ->header('Cache-Control', 'no-store');
    }
}
