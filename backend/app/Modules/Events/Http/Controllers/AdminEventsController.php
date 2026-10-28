<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Access\Models\User;
use App\Modules\Events\Actions\CreateEvent;
use App\Modules\Events\Actions\DeleteEvent;
use App\Modules\Events\Actions\ListAdminEvents;
use App\Modules\Events\Actions\SavedEvent;
use App\Modules\Events\Actions\UpdateEvent;
use App\Modules\Events\Http\Requests\ListAdminEventsRequest;
use App\Modules\Events\Http\Requests\StoreEventRequest;
use App\Modules\Events\Http\Requests\UpdateEventRequest;
use App\Modules\Events\Http\Resources\EventAdminResource;
use App\Modules\Events\Models\Event;
use App\Shared\Http\PageMeta;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/**
 * Os eventos no painel (CAP-12). A flag `events` é conferida na rota (404 desligada); a permissão e o escopo do próprio
 * ministério, na `EventPolicy`, dentro de cada Form Request (BR-030, BR-075, BR-076). Quando o servidor remove formatação
 * da descrição, a resposta traz `sanitization_warning: true` (BR-046).
 */
final class AdminEventsController
{
    /** `GET /api/admin/events`: com o total de inscritos e o estado derivado de cada evento. */
    public function index(ListAdminEventsRequest $request, ListAdminEvents $list): JsonResponse
    {
        $events = $list(
            $this->user($request),
            $request->integer('page', 1),
            $request->integer('per_page', ListAdminEvents::DEFAULT_PER_PAGE),
            $request->state(),
            $request->ministryId(),
            $request->sort(),
        );

        return response()->json([
            'data' => EventAdminResource::collection($events->items())->resolve($request),
            'meta' => PageMeta::of($events),
        ]);
    }

    /** `GET /api/admin/events/{id}`: o evento, para editar. */
    public function show(Request $request, Event $event): JsonResponse
    {
        Gate::authorize('manage', $event);

        return $this->respond(new SavedEvent($event, false));
    }

    /** `POST /api/admin/events` (BR-025, BR-026, BR-031, BR-032, BR-046). */
    public function store(StoreEventRequest $request, CreateEvent $create): JsonResponse
    {
        return $this->respond($create($request->fields(), $request->publish(), $this->user($request)), 201);
    }

    /** `PATCH /api/admin/events/{id}`: altera, publica, despublica ou encerra as inscrições. */
    public function update(UpdateEventRequest $request, Event $event, UpdateEvent $update): JsonResponse
    {
        return $this->respond($update($event, $request->changes(), $request->confirmsSchemaChange(), $this->user($request)));
    }

    /** `DELETE /api/admin/events/{id}`: definitiva, só sem inscrições (BR-028). */
    public function destroy(Request $request, Event $event, DeleteEvent $delete): Response
    {
        Gate::authorize('manage', $event);

        $delete($event, $this->user($request));

        return response()->noContent();
    }

    private function respond(SavedEvent $saved, int $status = 200): JsonResponse
    {
        $event = $saved->event->load(['ministry:id,name', 'updater:id,name'])->loadCount('registrations');
        $payload = ['data' => (new EventAdminResource($event))->resolve()];

        if ($saved->sanitizationWarning) {
            $payload['sanitization_warning'] = true;
        }

        return response()->json($payload, $status);
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
