<?php

declare(strict_types=1);

namespace App\Modules\Platform\Actions;

use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Health check (Observability → Health checks): a aplicação sobe e `SELECT 1` no banco funciona.
 */
class CheckHealth
{
    public function __invoke(): bool
    {
        try {
            DB::select('SELECT 1');

            return true;
        } catch (Throwable) {
            return false;
        }
    }
}
