<?php

declare(strict_types=1);

use App\Modules\Access\Http\PanelMiddleware;
use App\Modules\Events\Http\Controllers\AdminEventsController;
use App\Modules\Events\Http\Controllers\EventBannerController;
use App\Modules\Events\Http\Controllers\PublicEventsController;
use App\Modules\Events\Http\Controllers\PublicRegistrationController;
use App\Modules\Events\Http\Controllers\RegistrationsController;
use App\Modules\Events\Http\Controllers\TodayRegistrationsController;
use App\Shared\Http\RateLimiters;
use Illuminate\Support\Facades\Route;

// Carregado por routes/api.php, já sob o prefixo /api e o grupo de middleware `api`.
//
// R2: com FEATURE_EVENTS desligada todas respondem 404, como se não existissem (`feature:events` vem antes da sessão e da
// permissão). A permissão e o escopo do próprio ministério são da `EventPolicy`, conferida em cada Form Request e no
// controlador, porque dependem do ministério do evento e não cabem num `can:` fixo (BR-030, BR-075, BR-076).
// Público: leitura com o limite `public-read`; a inscrição segue a ordem dos contatos (limite, depois `web` com a sessão e o
// CSRF do Sanctum SPA, depois o honeypot, que descarta o envio de robô sem validar nada). `feature:events` vem antes de tudo.
Route::middleware('feature:events')->prefix('public/events')->group(function () {
    Route::middleware('throttle:'.RateLimiters::PUBLIC_READ)->group(function () {
        Route::get('/', [PublicEventsController::class, 'index'])->name('public.events.index');
        Route::get('{slug}', [PublicEventsController::class, 'show'])->name('public.events.show');
    });

    Route::post('{slug}/register', PublicRegistrationController::class)
        ->middleware(['throttle:'.RateLimiters::REGISTRATION_SUBMIT, 'web', 'honeypot:registration.honeypot'])
        ->name('public.events.register');
});

Route::middleware(['feature:events', ...PanelMiddleware::STACK])->prefix('admin/events')->group(function () {
    Route::get('/', [AdminEventsController::class, 'index'])->name('admin.events.index');
    Route::post('/', [AdminEventsController::class, 'store'])->name('admin.events.store');
    Route::get('{event}', [AdminEventsController::class, 'show'])->whereNumber('event')->name('admin.events.show');
    Route::patch('{event}', [AdminEventsController::class, 'update'])->whereNumber('event')->name('admin.events.update');
    Route::delete('{event}', [AdminEventsController::class, 'destroy'])->whereNumber('event')->name('admin.events.destroy');
    Route::post('{event}/banner', [EventBannerController::class, 'store'])->whereNumber('event')->name('admin.events.banner.store');
    Route::delete('{event}/banner', [EventBannerController::class, 'destroy'])->whereNumber('event')->name('admin.events.banner.destroy');

    // Inscritos (CAP-15): a inscrição na URL precisa ser do evento da URL, senão 404
    Route::scopeBindings()->whereNumber(['event', 'registration'])->group(function () {
        Route::get('{event}/registrations', [RegistrationsController::class, 'index'])->name('admin.events.registrations.index');
        Route::get('{event}/registrations/export.csv', [RegistrationsController::class, 'export'])
            ->middleware('throttle:'.RateLimiters::ADMIN_EXPORT)
            ->name('admin.events.registrations.export');
        Route::delete('{event}/registrations/{registration}', [RegistrationsController::class, 'destroy'])->name('admin.events.registrations.destroy');
    });
});

// Início do painel: as inscrições de hoje, de todos os eventos que a pessoa pode ler
Route::middleware(['feature:events', ...PanelMiddleware::STACK])
    ->get('admin/registrations/today', TodayRegistrationsController::class)
    ->name('admin.registrations.today');
