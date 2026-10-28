<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Access\Models\User;
use App\Modules\Events\Actions\CancelRegistration;
use App\Modules\Events\Actions\ExportRegistrations;
use App\Modules\Events\Actions\ListEventRegistrations;
use App\Modules\Events\Http\Requests\CancelRegistrationRequest;
use App\Modules\Events\Http\Requests\ListEventRegistrationsRequest;
use App\Modules\Events\Http\Resources\EventRegistrationResource;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use App\Shared\Http\PageMeta;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * As inscrições de um evento no painel (CAP-15): lista, CSV e cancelamento. A flag `events` é conferida na rota; a
 * permissão e o escopo do ministério, na `EventRegistrationPolicy`.
 */
final class RegistrationsController
{
    /** `GET /api/admin/events/{id}/registrations`: com `spots_total` (`null` = ilimitadas) e `spots_filled` no `meta`. */
    public function index(ListEventRegistrationsRequest $request, Event $event, ListEventRegistrations $list): JsonResponse
    {
        $registrations = $list(
            $event,
            $request->integer('page', 1),
            $request->integer('per_page', ListEventRegistrations::DEFAULT_PER_PAGE),
            $request->search(),
        );

        return response()
            ->json([
                'data' => EventRegistrationResource::collection($registrations->items())->resolve($request),
                'meta' => [
                    ...PageMeta::of($registrations),
                    'spots_total' => $event->max_spots,
                    'spots_filled' => $event->registrations()->count(),
                ],
            ])
            ->header('Cache-Control', 'no-store');
    }

    /** `GET /api/admin/events/{id}/registrations/export.csv`: por *streaming*, com a exportação auditada. */
    public function export(Request $request, Event $event, ExportRegistrations $export): StreamedResponse
    {
        Gate::authorize('viewAny', [EventRegistration::class, $event]);

        $csv = $export($event);

        return response()->stream(function () use ($csv): void {
            foreach ($csv->lines() as $line) {
                echo $line;
            }
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$csv->filename().'"',
            'Cache-Control' => 'no-store',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /** `DELETE /api/admin/events/{id}/registrations/{registrationId}`: definitiva, devolve a vaga (BR-034, BR-081). */
    public function destroy(CancelRegistrationRequest $request, Event $event, EventRegistration $registration, CancelRegistration $cancel): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        $cancel($registration, $user, (string) $request->input('reason'));

        return response()->noContent();
    }
}
