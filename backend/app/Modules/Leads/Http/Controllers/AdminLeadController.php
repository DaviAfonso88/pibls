<?php

declare(strict_types=1);

namespace App\Modules\Leads\Http\Controllers;

use App\Modules\Access\Models\User;
use App\Modules\Leads\Actions\EraseLead;
use App\Modules\Leads\Actions\ListLeadAssignees;
use App\Modules\Leads\Actions\ListLeads;
use App\Modules\Leads\Actions\UpdateLead;
use App\Modules\Leads\Enums\LeadType;
use App\Modules\Leads\Http\Requests\EraseLeadRequest;
use App\Modules\Leads\Http\Requests\ListAssigneesRequest;
use App\Modules\Leads\Http\Requests\ListLeadsRequest;
use App\Modules\Leads\Http\Requests\UpdateLeadRequest;
use App\Modules\Leads\Http\Resources\LeadDetailResource;
use App\Modules\Leads\Http\Resources\LeadListResource;
use App\Modules\Leads\Models\Lead;
use App\Shared\Http\PageMeta;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/**
 * As caixas de contatos do painel (CAP-10 e CAP-11). A permissão é do TIPO do contato, conferida aqui e na LeadPolicy, nunca
 * só pela tela (BR-076). Um pedido de oração é invisível, com 404, a quem não tem `leads.oracao.read` (BR-007).
 */
final class AdminLeadController
{
    /** `GET /api/admin/leads`: a lista da caixa pedida. 403 sem a permissão de leitura dessa caixa. */
    public function index(ListLeadsRequest $request, ListLeads $list): JsonResponse
    {
        $viewer = $this->user($request);
        $prayer = $request->prayerInbox();

        Gate::authorize(($prayer ? LeadType::Oracao : LeadType::Contato)->readPermission()->value);

        $leads = $list(
            prayerInbox: $prayer,
            type: $request->leadType(),
            status: $request->leadStatus(),
            assignedTo: $request->assignedTo($viewer),
            from: $request->filled('from') ? (string) $request->input('from') : null,
            to: $request->filled('to') ? (string) $request->input('to') : null,
            search: $request->filled('q') ? (string) $request->input('q') : null,
            oldestFirst: $request->input('sort') === 'created_at',
            onlyOpen: $request->onlyOpen(),
            withoutAssignee: $request->withoutAssignee(),
            page: $request->integer('page', 1),
            perPage: $request->integer('per_page', ListLeads::DEFAULT_PER_PAGE),
        );

        return response()->json([
            'data' => LeadListResource::collection($leads->items())->resolve($request),
            'meta' => PageMeta::of($leads),
        ]);
    }

    /** `GET /api/admin/leads/{id}`: o detalhe, com a mensagem e o histórico. 404 sem a permissão do tipo (BR-007). */
    public function show(Request $request, Lead $lead): LeadDetailResource
    {
        Gate::authorize('view', $lead);

        return $this->detail($lead);
    }

    /** `PATCH /api/admin/leads/{id}`: status, responsável e anotação (BR-008, BR-009, BR-013). */
    public function update(UpdateLeadRequest $request, Lead $lead, UpdateLead $update): LeadDetailResource
    {
        // A permissão de gestão foi conferida no Form Request, antes de validar o corpo
        return $this->detail($update($lead, $this->user($request), $request->changes()));
    }

    /** `GET /api/admin/leads/assignees?type=`: quem pode ser responsável por esse tipo (BR-009). */
    public function assignees(ListAssigneesRequest $request, ListLeadAssignees $list): JsonResponse
    {
        $type = $request->leadType();

        Gate::authorize($type->managePermission()->value);

        return response()->json([
            'data' => $list($type)->map(fn (User $user) => ['id' => $user->getKey(), 'name' => $user->name])->all(),
        ]);
    }

    /** `DELETE /api/admin/leads/{id}`: exclusão definitiva a pedido do titular (BR-081). */
    public function destroy(EraseLeadRequest $request, Lead $lead, EraseLead $erase): Response
    {
        // A permissão de gestão foi conferida no Form Request, antes de validar o corpo
        $erase($lead, $this->user($request), (string) $request->input('reason'));

        return response()->noContent();
    }

    private function detail(Lead $lead): LeadDetailResource
    {
        return new LeadDetailResource($lead->load(['assignee', 'group', 'ministry', 'activities.actor']));
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
