<?php

declare(strict_types=1);

use App\Modules\Access\Authorization\PermissionKey;
use App\Modules\Access\Http\PanelMiddleware;
use App\Modules\Content\Http\Controllers\AdminBulletinController;
use App\Modules\Content\Http\Controllers\AdminPalavraVivaController;
use App\Modules\Content\Http\Controllers\AdminSettingsController;
use App\Modules\Content\Http\Controllers\PixSettingsController;
use App\Modules\Content\Http\Controllers\PublicBulletinsController;
use App\Modules\Content\Http\Controllers\PublicPalavraVivaController;
use App\Modules\Content\Http\Controllers\PublicSettingsController;
use App\Shared\Http\RateLimiters;
use Illuminate\Support\Facades\Route;

// Carregado por routes/api.php, já sob o prefixo /api e o grupo de middleware `api`.
Route::get('/public/settings', PublicSettingsController::class)
    ->middleware('throttle:'.RateLimiters::PUBLIC_READ)
    ->name('public.settings');

Route::middleware('throttle:'.RateLimiters::PUBLIC_READ)->prefix('public')->group(function () {
    Route::get('bulletins', PublicBulletinsController::class)->name('public.bulletins.index');
    Route::get('palavra-viva', [PublicPalavraVivaController::class, 'index'])->name('public.palavra-viva.index');
    Route::get('palavra-viva/{slug}', [PublicPalavraVivaController::class, 'show'])
        ->where('slug', '[a-z0-9-]+')
        ->name('public.palavra-viva.show');
});

// Painel (CAP-02 e CAP-03). A permissão é um `can:` na rota, conferido antes de ler o corpo (BR-076).
Route::middleware([...PanelMiddleware::STACK, 'can:'.PermissionKey::BoletinsWrite->value])->prefix('admin/bulletins')->group(function () {
    Route::get('/', [AdminBulletinController::class, 'index'])->name('admin.bulletins.index');
    Route::post('/', [AdminBulletinController::class, 'store'])->name('admin.bulletins.store');
    Route::get('{bulletin}', [AdminBulletinController::class, 'show'])->whereNumber('bulletin')->name('admin.bulletins.show');
    Route::patch('{bulletin}', [AdminBulletinController::class, 'update'])->whereNumber('bulletin')->name('admin.bulletins.update');
    Route::delete('{bulletin}', [AdminBulletinController::class, 'destroy'])->whereNumber('bulletin')->name('admin.bulletins.destroy');
    Route::post('{bulletin}/pdf', [AdminBulletinController::class, 'replacePdf'])->whereNumber('bulletin')->name('admin.bulletins.pdf');
});

Route::middleware([...PanelMiddleware::STACK, 'can:'.PermissionKey::MensagensWrite->value])->prefix('admin/palavra-viva')->group(function () {
    Route::get('/', [AdminPalavraVivaController::class, 'index'])->name('admin.palavra-viva.index');
    Route::post('/', [AdminPalavraVivaController::class, 'store'])->name('admin.palavra-viva.store');
    Route::get('{post}', [AdminPalavraVivaController::class, 'show'])->whereNumber('post')->name('admin.palavra-viva.show');
    Route::patch('{post}', [AdminPalavraVivaController::class, 'update'])->whereNumber('post')->name('admin.palavra-viva.update');
    Route::delete('{post}', [AdminPalavraVivaController::class, 'destroy'])->whereNumber('post')->name('admin.palavra-viva.destroy');
});

// Configurações institucionais (CAP-17): `settings.write`. A chave `pix` tem rota própria, logo abaixo.
Route::middleware([...PanelMiddleware::STACK, 'can:'.PermissionKey::SettingsWrite->value])->prefix('admin/settings')->group(function () {
    Route::get('/', [AdminSettingsController::class, 'show'])->name('admin.settings.show');
    Route::patch('/', [AdminSettingsController::class, 'update'])->name('admin.settings.update');
});

// PIX (CAP-18): `pix.write`, conferida na rota antes de ler o corpo (BR-076). A reconfirmação de senha é da Action (BR-060).
Route::middleware([...PanelMiddleware::STACK, 'can:'.PermissionKey::PixWrite->value])->prefix('admin/settings/pix')->group(function () {
    Route::get('/', [PixSettingsController::class, 'show'])->name('admin.settings.pix.show');
    Route::post('/', [PixSettingsController::class, 'update'])->name('admin.settings.pix.update');
});
