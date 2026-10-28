<?php

declare(strict_types=1);

namespace App\Modules\Access;

use App\Modules\Access\Authorization\PermissionGate;
use App\Modules\Access\Events\PasswordChanged;
use App\Modules\Access\Listeners\RevokeSessionsAndNotify;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

final class AccessServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Um Gate por `permission_key` (Security → Autorização)
        $this->app->make(PermissionGate::class)->register();

        Event::listen(PasswordChanged::class, [RevokeSessionsAndNotify::class, 'handle']);
    }
}
