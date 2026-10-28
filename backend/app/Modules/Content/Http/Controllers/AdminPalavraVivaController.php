<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers;

use App\Modules\Access\Models\User;
use App\Modules\Content\Actions\CreatePalavraViva;
use App\Modules\Content\Actions\DeletePalavraViva;
use App\Modules\Content\Actions\ListAdminPalavraViva;
use App\Modules\Content\Actions\SavedPalavraViva;
use App\Modules\Content\Actions\UpdatePalavraViva;
use App\Modules\Content\Http\Requests\PageRequest;
use App\Modules\Content\Http\Requests\StorePalavraVivaRequest;
use App\Modules\Content\Http\Requests\UpdatePalavraVivaRequest;
use App\Modules\Content\Http\Resources\PalavraVivaAdminResource;
use App\Modules\Content\Models\PalavraVivaPost;
use App\Shared\Http\PageMeta;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * As mensagens da Palavra Viva no painel (CAP-03). A permissão `mensagens.write` é conferida na rota (`can:`), antes de
 * qualquer corpo ser lido (BR-076). Quando o servidor remove formatação do corpo, a resposta traz
 * `sanitization_warning: true` (BR-046).
 */
final class AdminPalavraVivaController
{
    /** `GET /api/admin/palavra-viva`: todas as mensagens, inclusive as agendadas. */
    public function index(PageRequest $request, ListAdminPalavraViva $list): JsonResponse
    {
        $posts = $list($request->integer('page', 1), $request->integer('per_page', ListAdminPalavraViva::DEFAULT_PER_PAGE));

        return response()->json([
            'data' => PalavraVivaAdminResource::collection($posts->items())->resolve($request),
            'meta' => PageMeta::of($posts),
        ]);
    }

    /** `GET /api/admin/palavra-viva/{id}`: a mensagem, para editar. */
    public function show(PalavraVivaPost $post): JsonResponse
    {
        return response()->json(['data' => (new PalavraVivaAdminResource($post->load('updater')))->resolve()]);
    }

    /** `POST /api/admin/palavra-viva` (BR-032, BR-044, BR-046). */
    public function store(StorePalavraVivaRequest $request, CreatePalavraViva $create): JsonResponse
    {
        return $this->respond($create($request->fields(), $request->publishedAt(), $this->user($request)), 201);
    }

    /** `PATCH /api/admin/palavra-viva/{id}`. */
    public function update(UpdatePalavraVivaRequest $request, PalavraVivaPost $post, UpdatePalavraViva $update): JsonResponse
    {
        return $this->respond($update($post, $request->changes(), $this->user($request)));
    }

    /** `DELETE /api/admin/palavra-viva/{id}`: exclusão lógica (ADR-009). */
    public function destroy(Request $request, PalavraVivaPost $post, DeletePalavraViva $delete): Response
    {
        $delete($post, $this->user($request));

        return response()->noContent();
    }

    private function respond(SavedPalavraViva $saved, int $status = 200): JsonResponse
    {
        $payload = ['data' => (new PalavraVivaAdminResource($saved->post->load('updater')))->resolve()];

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
