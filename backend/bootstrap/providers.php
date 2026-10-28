<?php

use App\Modules\Access\AccessServiceProvider;
use App\Modules\Content\ContentServiceProvider;
use App\Modules\Events\EventsServiceProvider;
use App\Modules\Leads\LeadsServiceProvider;
use App\Modules\Ministries\MinistriesServiceProvider;
use App\Providers\AppServiceProvider;

return [
    AppServiceProvider::class,
    // Cada módulo de negócio registra as suas definições de snapshot, os seus Gates e os seus ouvintes de eventos
    AccessServiceProvider::class,
    ContentServiceProvider::class,
    MinistriesServiceProvider::class,
    LeadsServiceProvider::class,
    EventsServiceProvider::class,
];
