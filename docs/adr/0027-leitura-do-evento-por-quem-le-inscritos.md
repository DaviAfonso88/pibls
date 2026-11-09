# ADR-027 — Quem lê inscritos também vê o evento e a lista de eventos no painel

- **Status:** Aceita
- **Data:** 2026-11-05 (correção pedida pelo responsável)

## Contexto

A matriz de permissões dá à Secretaria `eventos.inscricoes.read`: ver e exportar os inscritos de qualquer evento (CAP-15). A API já aceitava esse perfil em `GET /api/admin/events`, "para navegar até os inscritos", mas o resto do caminho não acompanhou:

- `GET /api/admin/events/{id}` exigia `eventos.write` ou `.own`. A tela `/admin/eventos/:id/inscritos` carrega o evento por essa rota (nome, formulário, vagas) para montar a lista, o CSV e o PDF. Para a Secretaria, a resposta era 403 e a tela mostrava "Não foi possível carregar o evento", **em qualquer evento**.
- O item "Eventos" do menu e a tela `/admin/eventos` exigiam as mesmas permissões de escrita. A Secretaria não tinha como chegar à lista, e os links "Ver todas" e "Inscrições hoje" do Início a levavam a "Você não tem acesso a esta área".

Os testes do frontend não pegaram a falha porque simulam a API e respondiam 200 para a Secretaria. O teste do servidor afirmava o 403. Os eventos são do R2 e estão desligados (`FEATURE_EVENTS=false`), então nada disso chegou a produção.

## Decisão

**Quem lê inscritos vê o evento e a lista de eventos, no mesmo escopo em que lê os inscritos, e continua sem alterar nada.**

- **API:** `GET /api/admin/events/{id}` passa a aceitar `eventos.write`, `eventos.write.own`, `eventos.inscricoes.read` e `eventos.inscricoes.read.own` (nova `EventPolicy::view`). O escopo é o da `EventRegistrationPolicy::viewAny`: `.read` vale para qualquer evento; `.read.own`, para os do próprio ministério e os gerais (ADR-025). Fora do escopo, 404 (BR-030); sem ministério vinculado, `.own` não concede nada (BR-075). `PATCH`, `DELETE`, o banner e o cancelamento de inscrição continuam só com escrita (`EventPolicy::manage`).
- **Painel:** "Eventos" aparece no menu e `/admin/eventos` abre para quem gerencia eventos ou lê inscritos. Para quem só lê, a lista é de consulta: sem "Novo evento" e sem "Editar", e o nome do evento leva aos inscritos. `/admin/eventos/novo` e `/admin/eventos/:id` continuam exigindo escrita.
- **"Editar" e "Cancelar inscrição" são decididos por evento**, com a mesma regra da `EventPolicy::manage`: quem soma papéis (Secretaria e Liderança de ministério, por exemplo) vê a lista de todos os eventos, mas só tem os botões nos do próprio ministério e nos gerais. O servidor continua decidindo (BR-076).

## Alternativas consideradas

- **Devolver o evento dentro da resposta de `GET …/registrations`:** evitaria mexer na permissão de `GET /{id}`, mas duplicaria o `EventAdmin` num segundo formato de resposta e faria a tela de inscritos depender de duas fontes para o mesmo dado.
- **Tela de inscritos sem os dados do evento:** sem o formulário não há como montar as colunas das respostas, nem o CSV e o PDF na ordem do formulário (FR-061).
- **Dar `eventos.write` à Secretaria:** resolveria a navegação, mas daria a ela o poder de criar, alterar e excluir eventos, que a matriz de permissões não prevê.

## Consequências

- *Positivas:* a Secretaria passa a cumprir o que a matriz já prometia (ver e exportar os inscritos de qualquer evento) pelo caminho normal do menu. A mudança não expõe dado novo: `GET /api/admin/events` já entregava o mesmo `EventAdmin` a esse perfil, no mesmo escopo.
- *Negativas:* uma Policy a mais para manter alinhada com a `EventRegistrationPolicy`; os testes de `AdminEventsTest` e a matriz papel × rota cobrem as duas.
- *A observar:* a regra "pode editar este evento" agora existe também no frontend (`canManageEvent`), como espelho da `EventPolicy::manage`. Se a Policy mudar, o espelho muda junto.
