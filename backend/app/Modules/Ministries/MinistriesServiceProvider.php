<?php

declare(strict_types=1);

namespace App\Modules\Ministries;

use App\Modules\Ministries\Snapshots\MinistriesSnapshot;
use App\Modules\Platform\Snapshots\SnapshotRegistry;
use Illuminate\Support\ServiceProvider;

final class MinistriesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // A Platform só itera o registro; quem sabe montar o arquivo é o módulo dono do dado
        $this->app->make(SnapshotRegistry::class)->register($this->app->make(MinistriesSnapshot::class));
    }
}
