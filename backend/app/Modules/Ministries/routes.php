<?php

declare(strict_types=1);

use App\Modules\Access\Authorization\PermissionKey;
use App\Modules\Access\Http\PanelMiddleware;
use App\Modules\Ministries\Http\Controllers\AdminMinistriesController;
use App\Modules\Ministries\Http\Controllers\PublicMinistriesController;
use App\Shared\Http\RateLimiters;
use Illuminate\Support\Facades\Route;

// Carregado por routes/api.php, já sob o prefixo /api e o grupo de middleware `api`.
Route::get('/public/ministries', PublicMinistriesController::class)
    ->middleware('throttle:'.RateLimiters::PUBLIC_READ)
    ->name('public.ministries');

// Painel (CAP-16). A permissão é um `can:` na rota, conferido antes de ler o corpo (BR-076).
Route::middleware([...PanelMiddleware::STACK, 'can:'.PermissionKey::MinisteriosWrite->value])->prefix('admin/ministries')->group(function () {
    Route::get('/', [AdminMinistriesController::class, 'index'])->name('admin.ministries.index');
    Route::post('/', [AdminMinistriesController::class, 'store'])->name('admin.ministries.store');
    Route::get('{ministry}', [AdminMinistriesController::class, 'show'])->whereNumber('ministry')->name('admin.ministries.show');
    Route::patch('{ministry}', [AdminMinistriesController::class, 'update'])->whereNumber('ministry')->name('admin.ministries.update');
    Route::delete('{ministry}', [AdminMinistriesController::class, 'destroy'])->whereNumber('ministry')->name('admin.ministries.destroy');
});
