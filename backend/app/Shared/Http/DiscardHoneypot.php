<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Honeypot dos formulários públicos (BR-002): o campo oculto `website` só chega preenchido de um robô. O envio é
 * descartado ANTES da validação e a resposta é o sucesso de sempre, para o robô não aprender nada. Registra só a
 * contagem (nível WARNING), sem o conteúdo do envio.
 *
 * Uso na rota: `honeypot:lead.honeypot` (o parâmetro é o nome do evento de log).
 */
final class DiscardHoneypot
{
    public function handle(Request $request, Closure $next, string $event = 'honeypot'): Response
    {
        if ($request->filled('website')) {
            Log::warning($event, ['path' => $request->path()]);

            return new JsonResponse(['data' => ['received' => true]], 201);
        }

        return $next($request);
    }
}
