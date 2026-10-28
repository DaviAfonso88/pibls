<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Feature flags
|--------------------------------------------------------------------------
|
| Booleanos do `.env`, expostos ao frontend em `GET /api/public/settings` → `features`.
| Uso principal: entregar o R1 com o módulo de eventos desligado (R2). Remover a flag duas releases depois de a
| funcionalidade ficar ativa em definitivo (DevOps → Feature flags).
|
*/

return [

    // R2: eventos e inscrições. Desligada, as rotas de eventos respondem 404 e saem do menu e do sitemap.
    'events' => filter_var(env('FEATURE_EVENTS', false), FILTER_VALIDATE_BOOLEAN),

];
