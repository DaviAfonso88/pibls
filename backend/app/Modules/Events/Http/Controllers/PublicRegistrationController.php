<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Actions\RegisterForEvent;
use App\Modules\Events\Http\Requests\RegisterForEventRequest;
use App\Modules\Events\Http\Resources\EventSummaryResource;
use Illuminate\Http\JsonResponse;

/**
 * `POST /api/public/events/{slug}/register` (R2): recebe a inscrição e responde 201 com o resumo. Limite de envios,
 * CSRF e honeypot são middlewares da rota; a regra de vagas e de duplicidade é da Action.
 */
final class PublicRegistrationController
{
    public function __invoke(string $slug, RegisterForEventRequest $request, RegisterForEvent $register): JsonResponse
    {
        $registration = $register($slug, $request->registration());

        return response()->json(['data' => [
            'id' => $registration->getKey(),
            'event_title' => $registration->event->title,
            'participant_name' => $registration->participant_name,
            'starts_at' => EventSummaryResource::instant($registration->event->starts_at),
            'confirmation_email_queued' => $registration->email !== null,
        ]], 201);
    }
}
