<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers;

use App\Modules\Access\Models\User;
use App\Modules\Content\Actions\CreateBulletin;
use App\Modules\Content\Actions\DeleteBulletin;
use App\Modules\Content\Actions\ListAdminBulletins;
use App\Modules\Content\Actions\ReplaceBulletinPdf;
use App\Modules\Content\Actions\UpdateBulletin;
use App\Modules\Content\Http\Requests\ListAdminBulletinsRequest;
use App\Modules\Content\Http\Requests\ReplaceBulletinPdfRequest;
use App\Modules\Content\Http\Requests\StoreBulletinRequest;
use App\Modules\Content\Http\Requests\UpdateBulletinRequest;
use App\Modules\Content\Http\Resources\BulletinAdminResource;
use App\Modules\Content\Models\Bulletin;
use App\Shared\Http\PageMeta;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Os boletins do painel (CAP-02). A permissão `boletins.write` é conferida na rota (`can:`), antes de qualquer corpo
 * ser lido (BR-076).
 */
final class AdminBulletinController
{
    /** `GET /api/admin/bulletins`: todos os boletins, inclusive os agendados. */
    public function index(ListAdminBulletinsRequest $request, ListAdminBulletins $list): JsonResponse
    {
        $bulletins = $list(
            year: $request->filled('year') ? $request->integer('year') : null,
            status: $request->publicationStatus(),
            sort: (string) $request->input('sort', '-reference_date'),
            page: $request->integer('page', 1),
            perPage: $request->integer('per_page', ListAdminBulletins::DEFAULT_PER_PAGE),
        );

        return response()->json([
            'data' => BulletinAdminResource::collection($bulletins->items())->resolve($request),
            'meta' => PageMeta::of($bulletins),
        ]);
    }

    /** `GET /api/admin/bulletins/{id}`: o boletim, para a tela de edição. */
    public function show(Bulletin $bulletin): JsonResponse
    {
        return $this->respond($bulletin->load('updater'));
    }

    /** `POST /api/admin/bulletins`: cadastra com o PDF (BR-040, BR-041). */
    public function store(StoreBulletinRequest $request, CreateBulletin $create): JsonResponse
    {
        $bulletin = $create(
            $request->fields(),
            $request->file('pdf'),
            $request->publishedAt(),
            $this->user($request),
        );

        return $this->respond($bulletin->load('updater'), 201);
    }

    /** `PATCH /api/admin/bulletins/{id}`: altera os metadados. */
    public function update(UpdateBulletinRequest $request, Bulletin $bulletin, UpdateBulletin $update): JsonResponse
    {
        $bulletin = $update($bulletin, $request->changes(), $this->user($request));

        return $this->respond($bulletin->load('updater'));
    }

    /** `POST /api/admin/bulletins/{id}/pdf`: troca o PDF; o anterior é apagado do disco. */
    public function replacePdf(ReplaceBulletinPdfRequest $request, Bulletin $bulletin, ReplaceBulletinPdf $replace): JsonResponse
    {
        $bulletin = $replace($bulletin, $request->file('pdf'), $this->user($request));

        return $this->respond($bulletin->load('updater'));
    }

    /** `DELETE /api/admin/bulletins/{id}`: exclusão lógica (ADR-009). */
    public function destroy(Request $request, Bulletin $bulletin, DeleteBulletin $delete): Response
    {
        $delete($bulletin, $this->user($request));

        return response()->noContent();
    }

    private function respond(Bulletin $bulletin, int $status = 200): JsonResponse
    {
        return response()->json(['data' => (new BulletinAdminResource($bulletin))->resolve()], $status);
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
