<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Http\Controllers;

use App\Modules\Ministries\Actions\CreateMinistryGroup;
use App\Modules\Ministries\Actions\DeleteMinistryGroup;
use App\Modules\Ministries\Actions\ListAdminMinistries;
use App\Modules\Ministries\Actions\UpdateMinistryGroup;
use App\Modules\Ministries\Http\Requests\ListAdminMinistriesRequest;
use App\Modules\Ministries\Http\Requests\StoreMinistryRequest;
use App\Modules\Ministries\Http\Requests\UpdateMinistryRequest;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * O catálogo de ministérios, grupos e Células de CL no painel (CAP-16). A permissão `ministerios.write` é conferida na
 * rota (`can:`), antes de qualquer corpo ser lido (BR-076).
 */
final class AdminMinistriesController
{
    /** `GET /api/admin/ministries`: o catálogo inteiro, com os campos internos. */
    public function index(ListAdminMinistriesRequest $request, ListAdminMinistries $list): JsonResponse
    {
        return response()->json(['data' => $list($request->category(), $request->isActive(), $request->string('q')->toString())]);
    }

    /** `GET /api/admin/ministries/{id}`: um item, para a tela de edição. */
    public function show(MinistryGroup $ministry, ListAdminMinistries $list): JsonResponse
    {
        return $this->respond($ministry, $list);
    }

    /** `POST /api/admin/ministries`: cadastra um item (BR-049). */
    public function store(StoreMinistryRequest $request, CreateMinistryGroup $create, ListAdminMinistries $list): JsonResponse
    {
        return $this->respond($create($request->fields(), $this->actorId($request)), $list, 201);
    }

    /** `PATCH /api/admin/ministries/{id}`: altera, ordena, ativa ou desativa. */
    public function update(UpdateMinistryRequest $request, MinistryGroup $ministry, UpdateMinistryGroup $update, ListAdminMinistries $list): JsonResponse
    {
        return $this->respond($update($ministry, $request->changes(), $this->actorId($request)), $list);
    }

    /** `DELETE /api/admin/ministries/{id}`: exclui só sem vínculos (BR-047). */
    public function destroy(MinistryGroup $ministry, DeleteMinistryGroup $delete): Response
    {
        $delete($ministry);

        return response()->noContent();
    }

    private function respond(MinistryGroup $ministry, ListAdminMinistries $list, int $status = 200): JsonResponse
    {
        return response()->json(['data' => $list->present(new Collection([$ministry]))[0]], $status);
    }

    private function actorId(Request $request): int
    {
        $user = $request->user();
        if ($user === null) {
            throw new AuthenticationException;
        }

        return (int) $user->getAuthIdentifier();
    }
}
