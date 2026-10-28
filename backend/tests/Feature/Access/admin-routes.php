<?php

declare(strict_types=1);

use App\Modules\Access\Models\User;
use App\Modules\Content\Models\Bulletin;
use App\Modules\Content\Models\PalavraVivaPost;
use App\Modules\Leads\Models\Lead;
use App\Modules\Ministries\Models\MinistryGroup;

/*
|--------------------------------------------------------------------------
| Tabela das rotas /api/admin/* para a matriz papel × rota (AuthorizationMatrixTest)
|--------------------------------------------------------------------------
|
| CADA HISTÓRIA QUE CRIA UMA ROTA DO PAINEL ACRESCENTA A LINHA DELA AQUI. O teste de completude falha se existir uma rota
| /api/admin/* fora desta tabela (BR-076: toda rota administrativa revalida a permissão no servidor).
|
| - `method` e `uri`: a rota, com `{id}` já trocado por um valor de exemplo. Para uma rota que precisa de um registro,
|   `make` devolve a `uri` depois de criá-lo (roda a cada papel testado).
| - `route`: o padrão da rota como o Laravel a registra (`api/admin/leads/{lead}`), para o teste de completude.
| - `permissions`: as chaves que liberam a rota (qualquer uma delas). Escopo `.own` conta como liberado para o papel que a
|   tem; o recorte por ministério é testado na Policy do recurso.
| - `guard`: `middleware` (padrão) = a rota tem `can:`; `controller` = a permissão depende do tipo do registro ou da caixa
|   pedida e é conferida no Form Request, no controlador ou na Policy.
| - `visibleTo` (opcional): se existe, quem não tem `permissions` recebe 404 (o recurso "não existe" para ele, BR-007), a
|   não ser que tenha alguma destas chaves de leitura, caso em que recebe 403. Sem a chave, quem não tem recebe 403.
| - `body` (opcional): corpo de uma escrita válida, para a validação não falar antes da permissão.
| - `validates` (opcional): a rota é multipart (recebe arquivo) e a matriz manda JSON; quem tem a permissão recebe 422 da
|   validação, o que prova que a permissão passou. Quem não tem recebe 403 como nas demais.
|
| @var list<array{method: string, uri: string, route: string, permissions: list<string>, guard?: string, visibleTo?: list<string>, body?: array<string, mixed>, make?: Closure}>
*/

return [
    ['method' => 'GET', 'uri' => '/api/admin/users', 'route' => 'api/admin/users', 'permissions' => ['users.read']],

    // Contatos (US4): a caixa geral e a de oração têm permissões próprias (BR-007)
    [
        'method' => 'GET', 'uri' => '/api/admin/leads?inbox=geral', 'route' => 'api/admin/leads',
        'permissions' => ['leads.read'], 'guard' => 'controller',
    ],
    [
        'method' => 'GET', 'uri' => '/api/admin/leads?inbox=oracao', 'route' => 'api/admin/leads',
        'permissions' => ['leads.oracao.read'], 'guard' => 'controller',
    ],
    [
        'method' => 'GET', 'uri' => '/api/admin/leads/assignees?type=CONTATO', 'route' => 'api/admin/leads/assignees',
        'permissions' => ['leads.manage'], 'guard' => 'controller',
    ],
    [
        'method' => 'GET', 'uri' => '/api/admin/leads/assignees?type=ORACAO', 'route' => 'api/admin/leads/assignees',
        'permissions' => ['leads.oracao.manage'], 'guard' => 'controller',
    ],
    [
        'method' => 'GET', 'uri' => '', 'route' => 'api/admin/leads/{lead}',
        'permissions' => ['leads.read'], 'guard' => 'controller', 'visibleTo' => [],
        'make' => fn () => '/api/admin/leads/'.Lead::factory()->visitante()->create()->getKey(),
    ],
    [
        'method' => 'GET', 'uri' => '', 'route' => 'api/admin/leads/{lead}',
        'permissions' => ['leads.oracao.read'], 'guard' => 'controller', 'visibleTo' => [],
        'make' => fn () => '/api/admin/leads/'.Lead::factory()->oracao()->create()->getKey(),
    ],
    [
        'method' => 'PATCH', 'uri' => '', 'route' => 'api/admin/leads/{lead}',
        'permissions' => ['leads.manage'], 'guard' => 'controller', 'visibleTo' => ['leads.read'],
        'body' => ['note' => 'Anotação de teste'],
        'make' => fn () => '/api/admin/leads/'.Lead::factory()->visitante()->create()->getKey(),
    ],
    [
        'method' => 'PATCH', 'uri' => '', 'route' => 'api/admin/leads/{lead}',
        'permissions' => ['leads.oracao.manage'], 'guard' => 'controller', 'visibleTo' => ['leads.oracao.read'],
        'body' => ['note' => 'Anotação de teste'],
        'make' => fn () => '/api/admin/leads/'.Lead::factory()->oracao()->create()->getKey(),
    ],
    [
        'method' => 'DELETE', 'uri' => '', 'route' => 'api/admin/leads/{lead}',
        'permissions' => ['leads.manage'], 'guard' => 'controller', 'visibleTo' => ['leads.read'],
        'body' => ['reason' => 'TITULAR_REQUEST'],
        'make' => fn () => '/api/admin/leads/'.Lead::factory()->visitante()->create()->getKey(),
    ],
    [
        'method' => 'DELETE', 'uri' => '', 'route' => 'api/admin/leads/{lead}',
        'permissions' => ['leads.oracao.manage'], 'guard' => 'controller', 'visibleTo' => ['leads.oracao.read'],
        'body' => ['reason' => 'TITULAR_REQUEST'],
        'make' => fn () => '/api/admin/leads/'.Lead::factory()->oracao()->create()->getKey(),
    ],

    // Boletins (US5): `boletins.write`, conferida na rota (`can:`) antes de ler o corpo
    ['method' => 'GET', 'uri' => '/api/admin/bulletins', 'route' => 'api/admin/bulletins', 'permissions' => ['boletins.write']],
    ['method' => 'POST', 'uri' => '/api/admin/bulletins', 'route' => 'api/admin/bulletins', 'permissions' => ['boletins.write'], 'validates' => true],
    [
        'method' => 'GET', 'uri' => '', 'route' => 'api/admin/bulletins/{bulletin}', 'permissions' => ['boletins.write'],
        'make' => fn () => '/api/admin/bulletins/'.Bulletin::factory()->create()->getKey(),
    ],
    [
        'method' => 'PATCH', 'uri' => '', 'route' => 'api/admin/bulletins/{bulletin}', 'permissions' => ['boletins.write'],
        'body' => ['title' => 'Título de teste'],
        'make' => fn () => '/api/admin/bulletins/'.Bulletin::factory()->create()->getKey(),
    ],
    [
        'method' => 'DELETE', 'uri' => '', 'route' => 'api/admin/bulletins/{bulletin}', 'permissions' => ['boletins.write'],
        'make' => fn () => '/api/admin/bulletins/'.Bulletin::factory()->create()->getKey(),
    ],
    [
        'method' => 'POST', 'uri' => '', 'route' => 'api/admin/bulletins/{bulletin}/pdf', 'permissions' => ['boletins.write'],
        'validates' => true,
        'make' => fn () => '/api/admin/bulletins/'.Bulletin::factory()->create()->getKey().'/pdf',
    ],

    // Configurações institucionais e catálogo (US7): `settings.write` e `ministerios.write`, conferidas na rota (`can:`)
    ['method' => 'GET', 'uri' => '/api/admin/settings', 'route' => 'api/admin/settings', 'permissions' => ['settings.write']],
    [
        'method' => 'PATCH', 'uri' => '/api/admin/settings', 'route' => 'api/admin/settings', 'permissions' => ['settings.write'],
        'body' => ['lords_supper_notice' => ['active' => false, 'text' => 'Ceia do Senhor neste domingo.']],
    ],
    ['method' => 'GET', 'uri' => '/api/admin/ministries', 'route' => 'api/admin/ministries', 'permissions' => ['ministerios.write']],
    [
        'method' => 'POST', 'uri' => '/api/admin/ministries', 'route' => 'api/admin/ministries', 'permissions' => ['ministerios.write'],
        'body' => ['category' => 'MINISTERIO', 'name' => 'Ministério de teste'],
    ],
    [
        'method' => 'GET', 'uri' => '', 'route' => 'api/admin/ministries/{ministry}', 'permissions' => ['ministerios.write'],
        'make' => fn () => '/api/admin/ministries/'.MinistryGroup::factory()->create()->getKey(),
    ],
    [
        'method' => 'PATCH', 'uri' => '', 'route' => 'api/admin/ministries/{ministry}', 'permissions' => ['ministerios.write'],
        'body' => ['name' => 'Nome de teste'],
        'make' => fn () => '/api/admin/ministries/'.MinistryGroup::factory()->create()->getKey(),
    ],
    [
        'method' => 'DELETE', 'uri' => '', 'route' => 'api/admin/ministries/{ministry}', 'permissions' => ['ministerios.write'],
        'make' => fn () => '/api/admin/ministries/'.MinistryGroup::factory()->create()->getKey(),
    ],

    // PIX (US6): só a Tesouraria (`pix.write`); a senha é reconfirmada na Action
    ['method' => 'GET', 'uri' => '/api/admin/settings/pix', 'route' => 'api/admin/settings/pix', 'permissions' => ['pix.write']],
    ['method' => 'POST', 'uri' => '/api/admin/settings/pix', 'route' => 'api/admin/settings/pix', 'permissions' => ['pix.write'], 'validates' => true],

    // Palavra Viva (US5): `mensagens.write`
    ['method' => 'GET', 'uri' => '/api/admin/palavra-viva', 'route' => 'api/admin/palavra-viva', 'permissions' => ['mensagens.write']],
    [
        'method' => 'POST', 'uri' => '/api/admin/palavra-viva', 'route' => 'api/admin/palavra-viva', 'permissions' => ['mensagens.write'],
        'body' => ['title' => 'Mensagem de teste', 'slug' => 'mensagem-de-teste', 'body' => '<p>Texto</p>'],
    ],
    [
        'method' => 'GET', 'uri' => '', 'route' => 'api/admin/palavra-viva/{post}', 'permissions' => ['mensagens.write'],
        'make' => fn () => '/api/admin/palavra-viva/'.PalavraVivaPost::factory()->create()->getKey(),
    ],
    [
        'method' => 'PATCH', 'uri' => '', 'route' => 'api/admin/palavra-viva/{post}', 'permissions' => ['mensagens.write'],
        'body' => ['title' => 'Título de teste'],
        'make' => fn () => '/api/admin/palavra-viva/'.PalavraVivaPost::factory()->create()->getKey(),
    ],
    [
        'method' => 'DELETE', 'uri' => '', 'route' => 'api/admin/palavra-viva/{post}', 'permissions' => ['mensagens.write'],
        'make' => fn () => '/api/admin/palavra-viva/'.PalavraVivaPost::factory()->create()->getKey(),
    ],

    // Eventos (US9, R2, com a flag ligada): `eventos.write` (qualquer ministério) ou `eventos.write.own` (o próprio). A lista
    // também abre para quem lê inscritos. As rotas de um evento recebem o líder pelo `make`, que cria o evento no ministério
    // dele: o recorte por ministério (outro → 404, sem ministério → 403) está em AdminEventsTest. Os inscritos (US11) seguem a mesma regra: ver e exportar com `eventos.inscricoes.read[.own]`, cancelar com a permissão de escrita.
    [
        'method' => 'GET', 'uri' => '/api/admin/events', 'route' => 'api/admin/events', 'guard' => 'controller',
        'permissions' => ['eventos.write', 'eventos.write.own', 'eventos.inscricoes.read', 'eventos.inscricoes.read.own'],
    ],
    [
        'method' => 'POST', 'uri' => '/api/admin/events', 'route' => 'api/admin/events', 'guard' => 'controller',
        'permissions' => ['eventos.write', 'eventos.write.own'], 'validates' => true,
    ],
    [
        'method' => 'GET', 'uri' => '', 'route' => 'api/admin/events/{event}', 'guard' => 'controller',
        'permissions' => ['eventos.write', 'eventos.write.own'],
        'make' => fn (?User $user = null) => '/api/admin/events/'.eventOf($user)->getKey(),
    ],
    [
        'method' => 'PATCH', 'uri' => '', 'route' => 'api/admin/events/{event}', 'guard' => 'controller',
        'permissions' => ['eventos.write', 'eventos.write.own'], 'body' => ['title' => 'Título de teste'],
        'make' => fn (?User $user = null) => '/api/admin/events/'.eventOf($user)->getKey(),
    ],
    [
        'method' => 'DELETE', 'uri' => '', 'route' => 'api/admin/events/{event}', 'guard' => 'controller',
        'permissions' => ['eventos.write', 'eventos.write.own'],
        'make' => fn (?User $user = null) => '/api/admin/events/'.eventOf($user)->getKey(),
    ],
    [
        'method' => 'POST', 'uri' => '', 'route' => 'api/admin/events/{event}/banner', 'guard' => 'controller',
        'permissions' => ['eventos.write', 'eventos.write.own'], 'validates' => true,
        'make' => fn (?User $user = null) => '/api/admin/events/'.eventOf($user)->getKey().'/banner',
    ],
    [
        'method' => 'DELETE', 'uri' => '', 'route' => 'api/admin/events/{event}/banner', 'guard' => 'controller',
        'permissions' => ['eventos.write', 'eventos.write.own'],
        'make' => fn (?User $user = null) => '/api/admin/events/'.eventOf($user)->getKey().'/banner',
    ],
    [
        'method' => 'GET', 'uri' => '', 'route' => 'api/admin/events/{event}/registrations', 'guard' => 'controller',
        'permissions' => ['eventos.inscricoes.read', 'eventos.inscricoes.read.own'],
        'make' => fn (?User $user = null) => registrationOf($user),
    ],
    [
        'method' => 'GET', 'uri' => '', 'route' => 'api/admin/events/{event}/registrations/export.csv', 'guard' => 'controller',
        'permissions' => ['eventos.inscricoes.read', 'eventos.inscricoes.read.own'],
        'make' => fn (?User $user = null) => registrationOf($user).'/export.csv',
    ],
    [
        'method' => 'DELETE', 'uri' => '', 'route' => 'api/admin/events/{event}/registrations/{registration}', 'guard' => 'controller',
        'permissions' => ['eventos.write', 'eventos.write.own'], 'body' => ['reason' => 'CANCELLED'],
        'make' => fn (?User $user = null) => registrationOf($user, one: true),
    ],
    // Início do painel: as inscrições de hoje, de todos os eventos que a pessoa pode ler (o recorte por ministério está em TodayRegistrationsTest)
    [
        'method' => 'GET', 'uri' => '/api/admin/registrations/today', 'route' => 'api/admin/registrations/today', 'guard' => 'controller',
        'permissions' => ['eventos.inscricoes.read', 'eventos.inscricoes.read.own'],
    ],
];
