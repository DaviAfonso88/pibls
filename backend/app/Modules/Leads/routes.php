<?php

declare(strict_types=1);

use App\Modules\Access\Http\PanelMiddleware;
use App\Modules\Leads\Http\Controllers\AdminLeadController;
use App\Modules\Leads\Http\Controllers\PublicLeadController;
use App\Shared\Http\RateLimiters;
use Illuminate\Support\Facades\Route;

// Carregado por routes/api.php, já sob o prefixo /api e o grupo de middleware `api`.
//
// Ordem dos middlewares: o limite vem primeiro (um robô barrado nem abre sessão); `web` traz a sessão e o CSRF do
// Sanctum SPA (cookie XSRF-TOKEN + cabeçalho X-XSRF-TOKEN); o honeypot descarta o envio de robô sem validar nada.
Route::post('/public/leads', PublicLeadController::class)
    ->middleware(['throttle:'.RateLimiters::LEAD_SUBMIT, 'web', 'honeypot:lead.honeypot'])
    ->name('public.leads.store');

// Painel: as caixas de contatos (CAP-10 e CAP-11). A permissão depende do TIPO do contato (a caixa pedida, ou o tipo do
// contato aberto), então é conferida no controlador e na LeadPolicy, não por um `can:` fixo na rota (BR-007, BR-076).
Route::middleware(PanelMiddleware::STACK)->prefix('admin/leads')->group(function () {
    Route::get('/', [AdminLeadController::class, 'index'])->name('admin.leads.index');
    Route::get('assignees', [AdminLeadController::class, 'assignees'])->name('admin.leads.assignees');
    Route::get('{lead}', [AdminLeadController::class, 'show'])->whereNumber('lead')->name('admin.leads.show');
    Route::patch('{lead}', [AdminLeadController::class, 'update'])->whereNumber('lead')->name('admin.leads.update');
    Route::delete('{lead}', [AdminLeadController::class, 'destroy'])->whereNumber('lead')->name('admin.leads.destroy');
});
