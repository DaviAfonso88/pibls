<?php

declare(strict_types=1);

use App\Modules\Platform\Http\Controllers\HealthController;
use App\Shared\Http\RateLimiters;
use Illuminate\Support\Facades\Route;

// Carregado por routes/api.php, já sob o prefixo /api e o grupo de middleware `api`.
Route::get('/health', HealthController::class)
    ->middleware('throttle:'.RateLimiters::PUBLIC_READ)
    ->name('health');
