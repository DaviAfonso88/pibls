<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Rotas da API (prefixo /api, grupo de middleware `api`)
|--------------------------------------------------------------------------
|
| Cada módulo declara as suas em app/Modules/<Modulo>/routes.php. Lista explícita, em vez de glob, para que a ordem
| (e a presença de um módulo) seja uma decisão revisável.
|
*/

foreach (['Platform', 'Access', 'Ministries', 'Content', 'Leads', 'Events'] as $module) {
    $routes = app_path("Modules/{$module}/routes.php");

    if (is_file($routes)) {
        require $routes;
    }
}
