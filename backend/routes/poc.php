<?php

declare(strict_types=1);

use App\Poc\Http\ReadController;
use Illuminate\Support\Facades\Route;

// PoC F0-03 (T013). Controller invocável de propósito: `route:cache` não aceita closures.
// REMOVER na T015, junto com app/Poc/, a migration da PoC e o gancho em bootstrap/app.php.
Route::get('/poc/read', ReadController::class);
