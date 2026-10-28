<?php

declare(strict_types=1);

namespace App\Modules\Content;

use App\Modules\Content\Events\PixSettingsChanged;
use App\Modules\Content\Listeners\AuditPixChange;
use App\Modules\Content\Listeners\QueuePixAlert;
use App\Modules\Content\Snapshots\HomeSnapshot;
use App\Modules\Content\Snapshots\SettingsSnapshot;
use App\Modules\Platform\Snapshots\SnapshotRegistry;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

final class ContentServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $registry = $this->app->make(SnapshotRegistry::class);

        $registry->register($this->app->make(SettingsSnapshot::class));
        $registry->register($this->app->make(HomeSnapshot::class));

        // Síncronos, de propósito: a auditoria e o alerta entram na transação da alteração do PIX
        Event::listen(PixSettingsChanged::class, [AuditPixChange::class, 'handle']);
        Event::listen(PixSettingsChanged::class, [QueuePixAlert::class, 'handle']);
    }
}
