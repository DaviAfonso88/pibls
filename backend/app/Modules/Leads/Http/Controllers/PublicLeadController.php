<?php

declare(strict_types=1);

namespace App\Modules\Leads\Http\Controllers;

use App\Modules\Leads\Actions\SubmitLead;
use App\Modules\Leads\Http\Requests\SubmitLeadRequest;
use Illuminate\Http\JsonResponse;

/**
 * `POST /api/public/leads`: recebe o contato dos cinco formulários públicos. Responde 201 sem o id do contato (evita
 * enumeração). Honeypot, limite de envios e CSRF são middlewares da rota.
 */
final class PublicLeadController
{
    public function __invoke(SubmitLeadRequest $request, SubmitLead $submit): JsonResponse
    {
        $submit($request->leadType(), $request->lead());

        return response()->json(['data' => ['received' => true]], 201);
    }
}
