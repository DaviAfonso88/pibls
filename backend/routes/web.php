<?php

declare(strict_types=1);

use App\Modules\Content\Http\Controllers\MetaShellController;
use App\Modules\Content\Http\Controllers\SitemapController;
use App\Modules\Events\Http\Controllers\EventMetaShellController;
use App\Shared\Http\RateLimiters;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use Laravel\Sanctum\Http\Controllers\CsrfCookieController;

// Em produção, `/` é servida pelo Apache (index.html pré-renderizado); o Laravel só atende /api, /sanctum e as rotas de
// meta (ADR-006). `Route::view` e não closure: `route:cache` (feito pelo ativador em `optimize`) não aceita closures.
Route::view('/', 'welcome');

// A rota do Sanctum é desligada em config/sanctum.php (`routes => false`) e declarada aqui, para aceitar o limiter
// `public-read` (API Standards → Infraestrutura).
Route::get('/sanctum/csrf-cookie', [CsrfCookieController::class, 'show'])
    ->middleware('throttle:'.RateLimiters::PUBLIC_READ)
    ->name('sanctum.csrf-cookie');

// Páginas de detalhe com meta injetada e o sitemap (ADR-004, contracts/web-routes.md). São leituras públicas e
// cacheáveis (`Cache-Control: public`), então não abrem sessão nem mandam cookie: um rastreador não ganha sessão.
Route::withoutMiddleware([StartSession::class, ShareErrorsFromSession::class, AddQueuedCookiesToResponse::class, PreventRequestForgery::class])
    ->middleware('throttle:'.RateLimiters::PUBLIC_READ)
    ->group(function () {
        Route::get('/palavra-viva/{slug}', MetaShellController::class)
            ->where('slug', '[a-z0-9-]+')
            ->name('meta.palavra-viva');
        // R2: com FEATURE_EVENTS desligada o controlador responde 404 com a página "não encontrado" da SPA
        Route::get('/eventos/{slug}', EventMetaShellController::class)
            ->where('slug', '[a-z0-9-]+')
            ->name('meta.eventos');
        Route::get('/sitemap.xml', SitemapController::class)->name('sitemap');
    });
