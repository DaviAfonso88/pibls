---

description: "Lista de tarefas do Novo Portal PIBLS (R1 + R2)"
---

# Tasks: Novo Portal PIBLS

**Input**: Design documents from `/specs/001-novo-portal-pibls/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: **obrigatórios** neste projeto (Constituição, Princípio V). Cada história tem as tarefas de teste **antes** da implementação. Os testes devem falhar antes de existir o código. Toda BR tem teste com o id no nome, e toda rota do painel entra na matriz papel × rota.

**Organization**: tarefas agrupadas por história da spec (US1 a US12). Entre parênteses fica o id da tarefa equivalente no backlog do `architecture.md` (F0, A, PL, M, C, L, QA, G, E).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: história da spec (US1 a US12)
- Caminhos relativos à raiz do monorepo (`plan.md` → Project Structure)

## Path Conventions

- **Backend**:
  - código: `backend/app/Modules/<Modulo>/…`, `backend/app/Shared/…`;
  - testes: `backend/tests/{Unit,Feature,Arch}/<Modulo>/…Test.php`.
- **Frontend**:
  - código: `frontend/app/{routes/public,routes/admin,features/<f>,shared}/…`;
  - testes: `…/__tests__/*.test.ts(x)`.
- **Outros**: E2E em `e2e/specs/*.spec.ts`; carga em `load/*.js`; deploy em `deploy/…`; documentação em `docs/{adr,runbooks,manual-do-painel}/…`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: inicialização do monorepo, ferramentas e CI mínimo (F0-01, F0-04).

- [X] T001 Criar o monorepo com `frontend/`, `backend/`, `deploy/`, `e2e/`, `load/`, `docs/{adr,runbooks,manual-do-painel}/` e `.editorconfig` na raiz (F0-01)
- [X] T002 Inicializar o Laravel 13 em `backend/` com `config.platform.php = 8.4` em `backend/composer.json`, `composer.lock` versionado e os *service providers* não usados (broadcasting) removidos de `backend/bootstrap/providers.php`
- [X] T003 [P] Inicializar o React Router 7 (*framework mode*) em `frontend/` com TypeScript `strict`, `engines.node = 24` em `frontend/package.json`, `package-lock.json` versionado e `frontend/react-router.config.ts` com `ssr: false`
- [X] T004 [P] Configurar Pint (preset `laravel`) e Larastan nível 6 em `backend/pint.json` e `backend/phpstan.neon`
- [X] T005 [P] Configurar o ESLint 9 em `frontend/eslint.config.js` e o Prettier em `frontend/.prettierrc`. Regras do ESLint:
  - flat config com typescript-eslint `strict` e jsx-a11y;
  - `import/no-restricted-paths` (features ↛ features, public ↛ admin, shared ↛ features);
  - `no-restricted-imports` (Base UI só em `shared/ui`; proibir outras bibliotecas de UI e de CSS-in-JS);
  - proibição de `dangerouslySetInnerHTML` fora do componente de HTML sanitizado.
- [X] T006 [P] Instalar e configurar os runners de teste:
  - Pest com o plugin `arch` em `backend/tests/Pest.php`, e a cobertura (PCOV, só no CI e local) medida em `backend/phpunit.xml`, com `<source>` restrito a `Actions`, `Policies`, `ValueObjects` e `Enums` de `app/Modules/*` e a `app/Shared/ValueObjects` (Constituição V);
  - Vitest + Testing Library + MSW 2 em `frontend/vitest.config.ts`, com `@vitest/coverage-v8`, `coverage.include` em `app/features/**` e `app/shared/**` e `coverage.thresholds.lines = 70`;
  - Playwright + `@axe-core/playwright` em `e2e/playwright.config.ts`.
- [X] T007 Criar `docker-compose.yml` na raiz (F0-04) e `docker/php/php.ini` com os valores mínimos da Infrastructure. Serviços:
  - `php:8.4-apache` **sem OPcache**, com as extensões da Technology Stack;
  - `mysql:8.0` e o perfil `mysql57`;
  - `axllent/mailpit`.
- [X] T008 Criar o CI mínimo em `.github/workflows/ci.yml`, com as Actions fixadas por SHA. Jobs:
  - `frontend`: tsc, ESLint, Prettier, Vitest com `--coverage` (falha abaixo de 70% de linhas em `features/` e `shared/`);
  - `backend`: Pint, Larastan, Pest com `--coverage --min=80` (Actions, Policies, ValueObjects e Enums), na matriz MySQL 5.7 e 8.0 + PHP 8.4 sem OPcache;
  - `security`: `composer audit`, `npm audit --omit=dev --audit-level=high`, Semgrep CE.
- [X] T009 [P] Configurar o Dependabot (Composer, npm, GitHub Actions; semanal) em `.github/dependabot.yml`
- [X] T010 [P] Escrever `README.md` (raiz), `backend/README.md` e `frontend/README.md`: como rodar, testes e links para `architecture.md` e runbooks. Registrar as versões exatas fixadas na Technology Stack do `architecture.md`
- [ ] T011 Ativar *branch protection* em `main` (CI verde obrigatório, sem push direto) e 2FA no GitHub, e registrar em `docs/runbooks/setup-hospedagem.md`
- [X] T204 Rodar o TestSprite da Fase 1 (convenção em Notes) como teste de fumaça dos dois esqueletos e deixar a ferramenta pronta para as fases seguintes:
  - `testsprite_check_account_info` confirma a conta e os créditos;
  - com `docker compose up -d`, o backend responde na rota inicial do Laravel;
  - o frontend (`npm run dev`) renderiza a rota inicial.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: gate de desempenho, deploy sem SSH, schema completo, base do backend, do frontend e da plataforma.

**⚠️ CRITICAL**: nenhuma história começa antes desta fase. **T014 é um gate**: se a PoC falhar, pare e abra uma ADR antes de qualquer módulo.

### Gate técnico (F0-02, F0-03)

- [ ] T012 Inventariar a conta HostGator e atualizar TBD-01, TBD-02 e TBD-04 em `to-be-determined.md` (F0-02). Levantar:
  - nome do servidor e versão do MySQL;
  - MultiPHP INI, *entry processes*, inodes, disco e e-mails por hora;
  - intervalo mínimo do cron;
  - datacenter, SLA e termos sobre testes de carga.
- [X] T013 Implementar a PoC (F0-03):
  - Laravel 13 mínimo com `GET /api/poc/read`, consulta real com *join*, `php artisan optimize` e classmap autoritativo, em `backend/routes/poc.php`;
  - script k6 com 10 usuários concorrentes em `load/poc.js`.
- [ ] T014 Executar a PoC na conta (sem OPcache) e registrar o p95 em `docs/adr/0005-laravel-13-php-84.md`. **GATE**:
  - **p95 ≤ 500 ms**: ADR-005 → Aceita no `architecture.md` e TBD-05 → Resolved;
  - **senão**: ADR-019 (plano B, Slim 4) e **parar**.
- [ ] T015 Remover a rota e o código da PoC (`backend/routes/poc.php`), mantendo só `load/poc.js` para referência

### Deploy sem SSH (F0-05)

- [X] T016 Escrever `deploy/finalize.php`, conforme DevOps → Ativador. PHP puro, sem `shell_exec`. Passos:
  - `flock`, `rollback.json` e conferência do SHA-256 do manifest;
  - extração com `PharData`, depois `pibls:doctor`;
  - `migrate --database=migrator` e `optimize` via `proc_open(PHP_BINARY)`;
  - cópia de `assets/` e depois dos `.html` (temporário + `rename`), sem tocar `uploads/`, `data/`, `.well-known/` nem `cgi-bin/`;
  - troca atômica de `current.php`, status JSON e *heartbeat*.
- [X] T017 [P] Escrever `deploy/htaccess/public_html.htaccess` e `deploy/htaccess/uploads.htaccess`. O primeiro segue a ordem de resolução e os cabeçalhos de `contracts/web-routes.md`, com CSP e cache por tipo; o segundo nega execução
- [X] T018 [P] Escrever os modelos de servidor: `deploy/templates/current.php`, `deploy/templates/env.example` (com `FEATURE_EVENTS`, `RETENTION_*`, `PIX_ALERT_RECIPIENTS` e `PRIVACY_POLICY_VERSION`), `deploy/templates/cron.txt` e o *wrapper* `deploy/templates/artisan.php`, que resolve a release ativa
- [X] T019 Implementar `php artisan pibls:doctor` em `backend/app/Modules/Platform/Console/DoctorCommand.php`. Confere:
  - versão do PHP e extensões;
  - INI (`memory_limit`, limites de upload, `max_execution_time`);
  - escrita em `uploads/`, `data/` e `storage/`;
  - banco e versão do MySQL;
  - suporte a WebP;
  - `PIX_ALERT_RECIPIENTS`;
  - espaço em disco.
- [X] T020 Escrever os testes do ativador em `deploy/tests/FinalizeTest.php`:
  - checksum inválido, `doctor` falho e `migrate` falho mantêm a release anterior;
  - o rollback restaura o ponteiro e o HTML;
  - um lock concorrente sai sem efeito.
- [X] T021 Criar `.github/workflows/deploy.yml` e `.github/workflows/rollback.yml` (com `release_id`):
  - build e pacote `release-<id>.tar.gz` com `manifest.json`;
  - upload FTPS (`lftp`) com o manifest por último;
  - espera do `status/<id>.json` (até 15 min), depois `GET /api/health` com a release;
  - E2E de fumaça em homologação;
  - Environment `production` com aprovação e janela seg–qua 9h–18h (America/Sao_Paulo), com exceção `hotfix=true` + justificativa;
  - o job de produção falha se houver marcador `TODO(TBD-` em `backend/database/data/` ou `frontend/app/content/` (conteúdo provisório nunca vai para produção).
- [ ] T022 Criar `homolog.pibls.com` e documentar tudo em `docs/runbooks/setup-hospedagem.md`:
  - subdomínio com raiz `homolog_html/`, Basic Auth e `noindex`;
  - banco próprio e usuários `pibls_app` (DML) e `pibls_migrator` (DDL);
  - `.env`, cron e conta FTP restrita a `deploy/inbox`.
- [ ] T023 Ensaiar 3 deploys e 3 rollbacks em homologação (cada um ≤ 10 min) e registrar tempos e problemas em `docs/runbooks/rollback.md` (critério do F0-05)

### Schema e dados obrigatórios (F0-06) — depende de T014

- [X] T024 Criar as migrations do schema completo, R1 + R2, em `backend/database/migrations/`, conforme `data-model.md` e Database Strategy. Regras:
  - colunas geradas *stored* para unicidade com exclusão lógica;
  - `CHECK` nomeados como reforço;
  - nada exclusivo do MySQL 8.0.
- [X] T025 Criar as migrations idempotentes de dados obrigatórios (`upsert`) em `backend/database/migrations/…_seed_*.php`, lendo `backend/database/data/initial_content.php`:
  - 14 permissões e matriz dos 7 papéis;
  - todas as chaves de `site_settings` com os valores do Apêndice A do PRD;
  - catálogo inicial de ministérios.
  Itens da TBD-11 ficam marcados como `TODO(TBD-11)`.
- [X] T026 [P] Criar os models Eloquent em `backend/app/Modules/*/Models/`, com cast `encrypted` nos campos 🔒 e `preventLazyLoading()` em local e CI, e as factories `pt_BR` em `backend/database/factories/`. Testar em `backend/tests/Feature/Platform/EncryptedFieldsTest.php` que, para cada campo 🔒 do `data-model.md`, o valor lido direto do banco (`DB::table(...)->value(...)`) difere do texto gravado e o model devolve o texto original (FR-064, ADR-016)
- [X] T027 [P] Criar o seeder local com um usuário por papel de referência (senha de `TEST_USERS_PASSWORD`) e dados falsos em `backend/database/seeders/LocalDevelopmentSeeder.php`
- [X] T028 Escrever o teste de migrations em `backend/tests/Feature/Platform/MigrationsTest.php` e acrescentar o passo `migrate:fresh` → `migrate:rollback` → `migrate` ao job `backend` de `.github/workflows/ci.yml`, nas duas versões do MySQL

### Base do backend (F0-07)

- [X] T029 Implementar o envelope de erro `{error:{code,message,details,traceId}}` e o mapeamento de exceções (422, 409 com códigos de negócio, 401, 403, 404, 413, 419, 429 com `Retry-After`, 500, 503) em `backend/app/Shared/Http/ErrorRenderer.php`, com teste em `backend/tests/Feature/Platform/ErrorEnvelopeTest.php`
- [X] T030 [P] Implementar o middleware `X-Request-Id` (aceita ULID válido, senão gera um) com propagação para log, Sentry, `audit_logs` e jobs em `backend/app/Shared/Http/RequestId.php`
- [X] T031 [P] Configurar a observabilidade do backend:
  - logs JSON com os campos obrigatórios e filtro de PII em `backend/config/logging.php` e `backend/app/Shared/Logging/JsonFormatter.php`;
  - Sentry (UE) com `before_send` sem PII e sem 4xx esperados em `backend/config/sentry.php`.
- [X] T032 [P] Implementar `GET /api/health` (200 com `release`, 503 sem detalhes) em `backend/app/Modules/Platform/Http/Controllers/HealthController.php`, com teste
- [X] T033 [P] Definir os *rate limiters* nomeados de API Standards em `backend/app/Shared/Http/RateLimiters.php`, com chaves por hash de IP, telefone ou e-mail e o store `database`
- [X] T034 [P] Implementar os Value Objects em `backend/app/Shared/ValueObjects/`, com testes por BR em `backend/tests/Unit/Shared/ValueObjectsTest.php`: `PhoneNumber`, `EmailAddress`, `PersonName` (com forma normalizada), `Slug`, `Cnpj`, `PixCopyPasteCode` (CRC16), `Consent`, `EventPeriod`, `ScheduleItem`, `PostalAddress` e `YoutubeUrl`
- [X] T035 [P] Implementar `SanitizedHtml` com HTMLPurifier em `backend/app/Shared/Sanitizer/HtmlSanitizer.php`, com teste de BR-046 em `backend/tests/Unit/Shared/HtmlSanitizerTest.php`:
  - lista de permissão: `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`, `a[href]`, `blockquote`, `h2`, `h3`;
  - `rel="noopener noreferrer"` forçado;
  - indicador de remoção.
- [X] T036 [P] Implementar o `AuditLogger` e o enum `AuditAction` em `backend/app/Modules/Platform/Audit/`, com teste que proíbe dado pessoal em `changes` (`backend/tests/Unit/Platform/AuditLoggerTest.php`)
- [X] T037 Implementar o `UploadStore` em `backend/app/Modules/Platform/Files/UploadStore.php`, com testes de PDF falso, *polyglot* e remoção de EXIF em `backend/tests/Unit/Platform/UploadStoreTest.php`. Regras:
  - MIME real com `finfo` e assinatura;
  - nome aleatório de 32 hex, em `uploads/{tipo}/AAAA/`;
  - reencode com GD sem EXIF;
  - variantes WebP de 1600 e 800 px.
- [X] T038 Escrever os testes de arquitetura em `backend/tests/Arch/ArchitectureTest.php`:
  - Controllers sem `DB::` nem `Model::query()`;
  - dependências entre módulos conforme o Domain Model;
  - `Platform` sem módulos de negócio;
  - nenhum código escreve em `user_permissions`, `permissions` ou `role_templates` (BR-077).
- [X] T039 Configurar o Scramble (só em local e homologação, em `/docs/api`) e o passo de CI que exporta o OpenAPI 3.1 para `docs/openapi.json`, arquivo versionado. Regras (`architecture.md` → API Standards → Documentação; Testing → Contrato):
  - o CI falha se o export diferir do arquivo versionado (`git diff --exit-code docs/openapi.json`);
  - os tipos do frontend saem desse arquivo (T049);
  - `specs/001-novo-portal-pibls/contracts/openapi.yaml` é a referência de projeto, conferida na revisão do PR que muda a API, sem comparação automática. Uma divergência intencional atualiza o contrato no mesmo PR, com ADR quando mudar uma decisão.
- [X] T040 [P] Implementar as feature flags: `backend/config/features.php` (`FEATURE_EVENTS`) e o middleware `EnsureFeatureEnabled` em `backend/app/Shared/Http/EnsureFeatureEnabled.php`, que responde 404 com a flag desligada, com teste

### Plataforma compartilhada (PL-01, PL-02)

- [X] T041 Implementar a fila de e-mail em `backend/app/Modules/Platform/Mail/` e `backend/routes/console.php` (PL-01):
  - Mailable base em pt-BR (texto + HTML simples);
  - worker no agendador (`queue:work --stop-when-empty --max-time=240 --max-jobs=20`, `withoutOverlapping`);
  - 5 tentativas com *backoff*;
  - allowlist de destinatários na homologação;
  - *heartbeat* no Healthchecks;
  - log `mail.sent` com o tipo do aviso e o atraso entre enfileirar e enviar, sem o destinatário (base do SC-019).
- [X] T042 Testar a fila em `backend/tests/Feature/Platform/MailQueueTest.php`:
  - o job é gravado na mesma transação (*rollback* não deixa job);
  - 5 falhas levam a `failed_jobs`;
  - a allowlist bloqueia destinatário real na homologação.
- [X] T043 Implementar o gerador de snapshots em `backend/app/Modules/Platform/Snapshots/` (PL-02):
  - `SnapshotWriter` com temporário + `rename`;
  - listener de `PublicContentChanged`;
  - comandos `pibls:snapshots:refresh` e `pibls:snapshots:refresh-scheduled`.
- [X] T044 Testar os snapshots em `backend/tests/Feature/Platform/SnapshotsTest.php`: gravação atômica (um leitor concorrente sempre recebe JSON válido), regeneração ≤ 1 s e regeneração agendada de conteúdo que passou a valer

### Base do frontend (F0-08)

- [X] T045 Inicializar o Tailwind 4 (`@tailwindcss/vite` antes de `reactRouter()` em `frontend/vite.config.ts`) e o shadcn/ui (`npx shadcn@latest init -b base`, `frontend/components.json` com `base-nova`, `neutral` e os aliases do plano). Configurar `frontend/app/app.css`:
  - tokens em `:root` + `@theme inline`;
  - regra de `prefers-reduced-motion`;
  - aviso de navegador desatualizado **fora de `@layer`**, sob `@supports not (color: color-mix(in srgb, red, blue))`.
- [X] T046 [P] Adicionar pelo CLI os componentes do shadcn listados em Frontend → Componentes reutilizáveis em `frontend/app/shared/ui/`, com textos em pt-BR e um comentário de alteração local no topo
- [X] T047 [P] Implementar o cliente HTTP em `frontend/app/shared/http/client.ts`, com testes em `frontend/app/shared/http/__tests__/client.test.ts`:
  - `GET /sanctum/csrf-cookie` antes da primeira escrita;
  - `X-XSRF-TOKEN` e `X-Request-Id` (ULID);
  - uma nova tentativa em 419;
  - mapeamento do `ErrorEnvelope` para os erros de campo.
- [X] T048 [P] Implementar os formatadores pt-BR (data, hora, data por extenso, telefone, CEP e CNPJ; `America/Sao_Paulo` fixo) em `frontend/app/shared/format/`, com testes em `frontend/app/shared/format/__tests__/format.test.ts`
- [X] T049 [P] Criar o script `npm run api:types` (`openapi-typescript docs/openapi.json` → `frontend/app/shared/api-types.ts`) e o passo de CI que falha se houver diferença
- [X] T050 Criar `frontend/app/root.tsx` e a tabela de rotas `frontend/app/routes.ts`. O `root.tsx` inclui:
  - `QueryClientProvider` com as regras de cache do plano;
  - `<Meta/>`, `<Links/>` e o `ErrorBoundary` do `@sentry/react`;
  - `BrowserOutdatedNotice`;
  - layout público com menu, que esconde Eventos se `features.events` for falso.
- [X] T051 [P] Criar os compostos do projeto em `frontend/app/shared/ui/`, com testes de acessibilidade em `frontend/app/shared/ui/__tests__/composites.test.tsx`: `EmptyState`, `ErrorState`, `StatusBadge`, `ConfirmDialog`, `DataTable` (tabela que vira cartões abaixo de `md`), `PhoneInput`, `ConsentCheckbox`, `Honeypot`, `DatePicker` e `FileDrop`
- [X] T052 [P] Criar o orçamento de bundle em `frontend/scripts/bundle-check.mjs` (JS público ≤ 150 KB gzip sem o chunk do painel; CSS ≤ 40 KB) e o job `a11y-perf` em `.github/workflows/ci.yml`: build servido com o `.htaccess` emulado, Playwright + axe bloqueante e Lighthouse CI como aviso
- [X] T053 [P] Centralizar os textos da interface em `frontend/app/shared/messages.ts` e `backend/lang/pt_BR/*.php`, incluindo as mensagens de validação do Laravel em pt-BR e os textos exatos das BRs
- [X] T054 Implementar o leitor de snapshots com *fallback* em `frontend/app/shared/http/snapshots.ts`, com testes (FR-011). Ordem: `/data/*.json` → API → snapshot gravado no build, este com o aviso "Algumas informações podem estar desatualizadas."
- [X] T205 Rodar o TestSprite da Fase 2 sobre a fundação, com o app local no ar:
  - backend: `GET /api/health` (200 com `release`); rota inexistente respondendo no envelope `{error:{code,message,details,traceId}}`; `GET /sanctum/csrf-cookie`;
  - frontend: a aplicação carrega sem erro de console e sem acionar o `ErrorBoundary`.

**Checkpoint**: fundação pronta. O deploy e o rollback em homologação funcionam, e o schema passa nas duas versões do MySQL.

---

## Phase 3: User Story 1 - Visitante conhece a igreja e planeja a primeira visita (Priority: P1) 🎯 MVP

**Goal**: site público pré-renderizado com horários, avisos, como chegar, quem somos, ministérios, grupos e Células de CL, com dados vindos de snapshots (PL-02, M-01, C-01 público, C-05).

**Independent Test**: com o conteúdo inicial carregado pela migration de seed, abrir cada página pública a 360 px. Conferir:
- horários, endereço e mapa sob toque, história, ministérios e grupos;
- a ausência do endereço residencial no HTML e em `/data/ministries.json`;
- a pré-visualização no WhatsApp.

Uma mudança de horário feita no banco aparece em até 1 min (o painel vem na US7).

### Tests for User Story 1 ⚠️

- [X] T055 [P] [US1] Testes de feature de `GET /api/public/settings` em `backend/tests/Feature/Content/PublicSettingsTest.php`: BR-050 (só as chaves públicas, nunca `notification_recipients`) e `features.events`
- [X] T056 [P] [US1] Testes de feature de `GET /api/public/ministries` em `backend/tests/Feature/Ministries/PublicMinistriesTest.php`:
  - BR-048 (nunca `private_address` nem `contact_email`);
  - só itens ativos, na ordem de exibição;
  - filtros `category` e `neighborhood`;
  - 422 para categoria inválida.
- [X] T057 [P] [US1] Teste de contrato snapshot = API para `settings.json`, `ministries.json` e `home.json` em `backend/tests/Feature/Platform/SnapshotContractTest.php`, cobrindo BR-042, BR-048 e BR-050
- [X] T058 [P] [US1] E2E das páginas públicas em `e2e/specs/public-pages.spec.ts`. Viewport de 360 px, cobrindo:
  - página inicial completa;
  - mapa só depois do toque;
  - filtro de grupos por perfil e bairro, sem endereço residencial no HTML;
  - pré-seleções de "Quero participar" e "Falar com este ministério";
  - 404 amigável;
  - *fallback* "desatualizado";
  - Open Graph por página;
  - axe sem violações *serious* ou *critical*.

### Implementation for User Story 1

- [X] T059 [P] [US1] Criar `PublicSettingsResource` e `PublicSettingsController` (`GET /api/public/settings`, `Cache-Control: public, max-age=60`) em `backend/app/Modules/Content/Http/`
- [X] T060 [P] [US1] Criar `PublicMinistryResource` e `PublicMinistriesController` (`GET /api/public/ministries`) em `backend/app/Modules/Ministries/Http/`
- [X] T061 [US1] Registrar as definições dos snapshots `settings.json`, `ministries.json` e `home.json` (com `upcoming_events = []` enquanto a flag estiver desligada), usando os mesmos Resources da API, em `backend/app/Modules/Platform/Snapshots/Definitions/`
- [X] T062 [P] [US1] Criar a página inicial em `frontend/app/routes/public/home.tsx` e `frontend/app/features/content/components/`. Conteúdo:
  - boas-vindas e quadro de horários;
  - avisos da campanha (com chamada para `/contribua`) e da Ceia, quando ativos;
  - botões do YouTube (ao vivo e canal) e do WhatsApp;
  - destaques de `home.json`.
- [X] T063 [P] [US1] Criar a página "Como chegar" com `MapFacade` (iframe só depois do toque) e os links do Google Maps e do Waze em `frontend/app/routes/public/como-chegar.tsx` e `frontend/app/shared/ui/map-facade.tsx`
- [X] T064 [P] [US1] Criar as páginas de ministérios e de grupos em `frontend/app/routes/public/ministerios.tsx` e `frontend/app/routes/public/grupos.tsx`:
  - ministérios com "Falar com este ministério" → `/contato?ministerio=<id>`;
  - grupos com filtro por perfil, Células de CL filtráveis por bairro e lema 1Pe 4:10;
  - "Quero participar" → `/sou-visitante?grupo=<id>`.
- [X] T065 [P] [US1] Criar o conteúdo fixo de "Quem somos" em `frontend/app/content/quem-somos.ts` e a página `frontend/app/routes/public/quem-somos.tsx`, com teste da idade em `frontend/app/content/__tests__/quem-somos.test.ts` (C-05; textos da TBD-11). Conteúdo:
  - linha do tempo;
  - idade calculada desde 13/01/1985;
  - os 8 ex-pastores;
  - CBB, com acesso à Declaração de Fé;
  - biografia do pastor titular.
- [X] T066 [P] [US1] Criar a página 404 amigável (Início, Horários, Contato) em `frontend/app/routes/public/not-found.tsx` e o helper de meta e Open Graph por rota pública em `frontend/app/shared/seo/meta.ts`
- [X] T067 [P] [US1] Criar o `YouTubeFacade` (miniatura de `i.ytimg.com`, `youtube-nocookie` só depois do clique) em `frontend/app/shared/ui/youtube-facade.tsx`, com teste
- [X] T068 [US1] Configurar o `prerender` das 14 rotas públicas em `frontend/react-router.config.ts` e o script `npm run deploy:local`, que serve o build pelo Apache local com o `.htaccess` real Nesta fase entram as 5 rotas que já existem (`/`, `/quem-somos`, `/ministerios`, `/grupos`, `/como-chegar`); as demais entram em `PRERENDERED_ROUTES` junto com cada tela.
- [X] T206 [US1] Rodar o TestSprite da US1 sobre o site público, com o conteúdo do seed:
  - frontend: página inicial (horários e avisos), "Como chegar" (mapa só depois do toque), ministérios e grupos com filtro por perfil e bairro, "Quero participar" e "Falar com este ministério" levando às pré-seleções, 404 amigável;
  - backend: `GET /api/public/settings` sem `notification_recipients`; `GET /api/public/ministries` sem `private_address` nem `contact_email`, e 422 para categoria inválida.

**Checkpoint**: o site público funciona sozinho, com o conteúdo do seed, e pode ser demonstrado em homologação.

---

## Phase 4: User Story 2 - Visitante ou membro envia um contato e a equipe certa é avisada (Priority: P1)

**Goal**: cinco formulários públicos com consentimento, antispam, limites e roteamento das notificações pela fila (L-01).

**Independent Test**: enviar um contato de cada tipo e conferir no banco (status `NOVO`) e no Mailpit os avisos aos destinatários de cada tipo (o de oração sem o texto). Não depende da caixa de entrada.

**Pré-requisito**: confirmar a Q-13 da TBD-11 (campos de "Quero ser membro") antes da T074. Sem resposta, vale a tabela do FR-013, e uma mudança posterior mexe só na validação e no formulário.

### Tests for User Story 2 ⚠️

- [X] T069 [P] [US2] Testes de feature de `POST /api/public/leads`, por tipo, em `backend/tests/Feature/Leads/SubmitLeadTest.php`:
  - BR-001 (consentimento) e BR-082 (versão da política);
  - BR-002 (honeypot: 201 sem gravar) e BR-003 (limites por IP e por telefone ou e-mail);
  - BR-004 (obrigatórios e formatos), BR-005 (telefone ou e-mail) e BR-006 (ministério ou grupo ativo);
  - 201 sem id e 419 sem CSRF.
- [X] T070 [P] [US2] Testes do roteamento de notificações em `backend/tests/Feature/Leads/LeadNotificationTest.php`:
  - um job por destinatário;
  - `MINISTERIO` vai para o `contact_email` do ministério ou, sem ele, para a lista do tipo;
  - BR-007: o e-mail de `ORACAO` vai sem o texto;
  - BR-011: tipo sem destinatário grava o contato e registra o aviso;
  - FR-019: falha de SMTP não desfaz o contato.
- [X] T071 [P] [US2] Testes de componente dos 5 formulários em `frontend/app/features/leads/__tests__/forms.test.tsx`: Zod espelhando as BRs, 422 mapeado para os campos, honeypot oculto e consentimento obrigatório, botão desabilitado durante o envio e alerta com "Tentar novamente" / "Falar no WhatsApp"
- [X] T072 [P] [US2] E2E de envio dos 5 tipos em `e2e/specs/leads-submit.spec.ts`: confirmação, avisos no Mailpit após `schedule:run`, o 4º envio do mesmo telefone em 10 min recusado e pré-seleção por `?grupo` e `?ministerio`

### Implementation for User Story 2

- [X] T073 [P] [US2] Criar os enums `LeadType` e `LeadStatus` em `backend/app/Modules/Leads/Enums/`
- [X] T074 [US2] Criar o `SubmitLeadRequest`, com regras por tipo (tabela "Campos obrigatórios por tipo" de `data-model.md`) e limites de mensagem por tipo, em `backend/app/Modules/Leads/Http/Requests/SubmitLeadRequest.php`
- [X] T075 [US2] Implementar a Action `SubmitLead` em `backend/app/Modules/Leads/Actions/SubmitLead.php`. Numa transação, grava o contato como `NOVO`, com `consent_at`, `consent_version` e `status_changed_at`, e despacha `LeadReceived`
- [X] T076 [US2] Implementar o listener `QueueLeadNotifications` e os Mailables em `backend/app/Modules/Leads/Listeners/` e `backend/app/Modules/Leads/Mail/`. Os Mailables são `LeadReceivedMail` (tipo, data e link do painel) e a variante de `ORACAO` sem o texto
- [X] T077 [US2] Criar o `PublicLeadController` e a rota `POST /api/public/leads`, com `lead-submit`, CSRF e honeypot `website`, em `backend/app/Modules/Leads/Http/Controllers/PublicLeadController.php` e `backend/app/Modules/Leads/routes.php`
- [X] T078 [P] [US2] Criar os schemas Zod por tipo e a camada de API em `frontend/app/features/leads/schemas.ts` e `frontend/app/features/leads/api.ts`
- [X] T079 [US2] Criar as páginas `/sou-visitante` (`?grupo`), `/quero-ser-membro`, `/pedido-de-oracao` e `/contato` (`?ministerio` → `MINISTERIO`) em `frontend/app/routes/public/`, com tela de confirmação "Recebemos seu contato! …" e alvos de toque de 44 px
- [X] T080 [P] [US2] Criar a página `/privacidade` com a política versionada (texto provisório até a TBD-06) em `frontend/app/content/privacidade.ts` e `frontend/app/routes/public/privacidade.tsx`, e `PRIVACY_POLICY_VERSION` em `backend/config/pibls.php`
- [X] T207 [US2] Rodar o TestSprite da US2 sobre os formulários públicos:
  - frontend: os 5 tipos de contato, com pré-seleção por `?grupo` e `?ministerio`. Envio válido mostra "Recebemos seu contato!", o consentimento é obrigatório e o erro 422 aparece no campo;
  - backend: `POST /api/public/leads` responde 201 sem id; 419 sem CSRF; honeypot `website` preenchido responde 201 sem gravar; o 4º envio do mesmo telefone em 10 min é recusado.

**Checkpoint**: contatos chegam ao banco e aos destinatários. US1 e US2 funcionam sozinhas.

---

## Phase 5: User Story 3 - Operador entra no painel e vê só o que pode usar (Priority: P1)

**Goal**: login, sessão, redefinição de senha, autorização por permissão e diretório somente leitura (A-01, A-02, A-03).

**Independent Test**: provisionar um usuário por papel seguindo só `docs/runbooks/provisionar-usuario.md`. Entrar com cada um e conferir o menu e o bloqueio dos demais módulos (tela e API). Testar a redefinição de senha pelo Mailpit e a desativação com a sessão aberta.

### Tests for User Story 3 ⚠️

- [X] T081 [P] [US3] Testes de feature de autenticação em `backend/tests/Feature/Access/AuthenticationTest.php`:
  - login, logout e `me`;
  - BR-070 (mensagem única) e BR-071 (5 falhas em 15 min → bloqueio de 15 min; 20 por IP);
  - BR-074 (desativado → 401);
  - inatividade de 60 min e tempo absoluto de 12 h;
  - id de sessão regenerado e auditoria `auth.*`.
- [X] T082 [P] [US3] Testes de feature da redefinição de senha em `backend/tests/Feature/Access/PasswordResetTest.php`:
  - BR-072 (uso único e 60 min) e BR-073 (de 12 caracteres a 72 bytes, HIBP);
  - HIBP indisponível → *fail-open* com aviso no log (`Http::fake`);
  - resposta sempre igual;
  - todas as sessões apagadas e o aviso "Sua senha foi alterada" enfileirado.
- [X] T083 [P] [US3] Criar a matriz papel × rota (7 papéis × cada rota `/api/admin/*`, mais BR-075 e BR-076) em `backend/tests/Feature/Access/AuthorizationMatrixTest.php`, alimentada por uma tabela de dados que **cada história seguinte estende**
- [X] T084 [P] [US3] Testes de feature de `GET /api/admin/users` (somente leitura; sem rota de escrita, BR-077) em `backend/tests/Feature/Access/UserDirectoryTest.php`
- [X] T085 [P] [US3] Testes de componente de `RequireAuth`, `RequirePermission`, menu por permissão e redirecionamento em 401 em `frontend/app/features/access/__tests__/guards.test.tsx`
- [X] T086 [P] [US3] E2E de acesso em `e2e/specs/access.spec.ts`: login por papel, bloqueio, redefinição pelo Mailpit e acesso direto sem permissão ("Você não tem acesso a esta área" + 403)

### Implementation for User Story 3

- [X] T087 [US3] Configurar o Sanctum SPA (stateful) e a sessão no driver `database` em `backend/config/sanctum.php` e `backend/config/session.php`. Cookie `pibls_session` `HttpOnly`, `Secure` e `SameSite=Strict`; `SESSION_LIFETIME=60`
- [X] T088 [US3] Implementar os middlewares de sessão absoluta (`login_at`, 12 h) e de usuário ativo em toda requisição em `backend/app/Modules/Access/Http/Middleware/`
- [X] T089 [US3] Implementar o `PermissionGate` em `backend/app/Modules/Access/Authorization/PermissionGate.php`. Ele carrega `user_permissions` uma vez por requisição, define um Gate por `permission_key` e trata o escopo `.own` por `ministry_id`
- [X] T090 [US3] Implementar as Actions `Login` e `Logout` e o `AuthController` (`/api/auth/login`, `/logout`, `/me`) com o limiter `login`, `last_login_at` e auditoria, em `backend/app/Modules/Access/`
- [X] T091 [US3] Implementar `RequestPasswordReset` e `ResetPassword` e os Mailables em `backend/app/Modules/Access/`:
  - HIBP por prefixo SHA-1 de 5 caracteres, com timeout e *fail-open*;
  - bcrypt custo 12;
  - evento `PasswordChanged`, que apaga as sessões e enfileira o aviso.
- [X] T092 [P] [US3] Implementar `GET /api/admin/users` (`users.read`) em `backend/app/Modules/Access/Http/Controllers/UserDirectoryController.php`
- [X] T093 [P] [US3] Implementar `php artisan pibls:hash-password` em `backend/app/Modules/Access/Console/HashPasswordCommand.php` e escrever `docs/runbooks/provisionar-usuario.md` (SQL por papel a partir de `role_templates`; desativação)
- [X] T094 [US3] Implementar `AuthContext` (`can()`), `RequireAuth`, `RequirePermission`, `PermissionGate` (componente) e o tratamento global de 401 ("Sua sessão expirou. Entre novamente.") em `frontend/app/features/access/`
- [X] T095 [US3] Criar as telas e o layout do painel em `frontend/app/routes/admin/`:
  - `/admin/entrar`, `/admin/esqueci-senha` e `/admin/redefinir-senha`;
  - layout com menu por permissão, `Sheet` abaixo de `lg` e `noindex`;
  - `/admin`, com atalhos e contatos parados (filtro `status=NOVO` e `to = hoje − 3 dias`).
- [X] T096 [P] [US3] Criar `/admin/usuarios` (diretório somente leitura) em `frontend/app/routes/admin/usuarios.tsx`
- [X] T208 [US3] Rodar o TestSprite da US3 sobre o acesso ao painel, com um usuário de cada papel do `LocalDevelopmentSeeder`:
  - frontend: login e logout; o menu mostra só os módulos permitidos; o acesso direto a uma área sem permissão mostra "Você não tem acesso a esta área"; `/admin/esqueci-senha` dá a mesma resposta para e-mail existente ou não;
  - backend: `POST /api/auth/login` com credencial errada devolve a mensagem única (BR-070), sem repetir até o bloqueio da BR-071, para não travar os usuários do seeder; as rotas `/api/admin/*` negam quem não tem a permissão.

**Checkpoint**: o painel abre com autorização correta. As histórias de painel (US4 a US7, US9 a US11) podem começar.

---

## Phase 6: User Story 4 - Equipe atende cada contato até a conclusão (Priority: P1)

**Goal**: caixa geral e caixa de oração, com status, responsável, histórico, WhatsApp e exclusão a pedido do titular (L-02).

**Independent Test**: com contatos de cada tipo vindos da US2, entrar como Secretaria, Oração e Pastoral. Conferir o que cada um vê, mudar status, atribuir responsável, anotar e excluir a pedido do titular.

### Tests for User Story 4 ⚠️

- [X] T097 [P] [US4] Testes de feature de `GET /api/admin/leads` e `GET /api/admin/leads/{id}` em `backend/tests/Feature/Leads/InboxTest.php`:
  - caixas `geral` e `oracao`;
  - BR-007: pedido de oração responde 404 para `leads.read`;
  - filtros, busca por nome ou telefone e allowlist de `sort`;
  - BR-010 (`waiting_days`) e BR-012 (responsável inativo).
- [X] T098 [P] [US4] Testes de feature do atendimento em `backend/tests/Feature/Leads/LeadHandlingTest.php`:
  - `PATCH`: BR-008 (transições), BR-009 (responsável com gestão do tipo; voltar a `NOVO` limpa o responsável), BR-013 (nota ≤ 1.000) e `LeadActivity` gravada;
  - `GET /assignees`;
  - `DELETE`: BR-081, com auditoria `lead.erased` sem PII e histórico apagado em cascata.
- [X] T099 [US4] Acrescentar as rotas `/api/admin/leads*` à matriz em `backend/tests/Feature/Access/AuthorizationMatrixTest.php`
- [X] T100 [P] [US4] Testes de componente da lista (filtros na URL, destaque de mais de 3 dias, "Anônimo") e do detalhe (transições permitidas, `ConfirmDialog` de exclusão) em `frontend/app/features/leads/__tests__/inbox.test.tsx`
- [X] T101 [P] [US4] E2E de atendimento por papel (Secretaria, Oração, Pastoral) em `e2e/specs/leads-inbox.spec.ts`

### Implementation for User Story 4

- [X] T102 [US4] Implementar a `LeadPolicy` (leitura e gestão por tipo; 404 sem a permissão do tipo) em `backend/app/Modules/Leads/Policies/LeadPolicy.php`
- [X] T103 [US4] Implementar o `AdminLeadController` (lista e detalhe) em `backend/app/Modules/Leads/Http/Controllers/AdminLeadController.php` e os Resources de lista (sem `message`) e de detalhe (com `message` decifrada, `activities` e `whatsapp_url`)
- [X] T104 [US4] Implementar as Actions `ChangeLeadStatus`, `AssignLead` e `AddLeadNote` (tabela de transições, `LeadActivity`, `status_changed_at`, `LeadStatusChanged`) em `backend/app/Modules/Leads/Actions/`
- [X] T105 [US4] Implementar a Action `EraseLead` (exclusão definitiva + `LeadErased` → auditoria) e `GET /api/admin/leads/assignees` em `backend/app/Modules/Leads/`
- [X] T106 [US4] Criar as telas `/admin/contatos[/:id]` e `/admin/oracao[/:id]` em `frontend/app/routes/admin/` e `frontend/app/features/leads/`:
  - `DataTable` com filtros na URL;
  - detalhe com histórico, "Responder no WhatsApp", status, responsável e anotação;
  - exclusão com confirmação.
  Nenhum rascunho local (FR-077).
- [ ] T209 [US4] Rodar o TestSprite da US4 sobre o atendimento, com contatos criados pelo formulário público e os papéis Secretaria, Oração e Pastoral:
  - caixa geral e caixa de oração mostram só o que o papel pode ler (pedido de oração fora da caixa geral: BR-007);
  - filtros na URL e destaque dos contatos parados há mais de 3 dias;
  - mudança de status (transição inválida recusada: BR-008), responsável, anotação e "Responder no WhatsApp";
  - exclusão a pedido do titular, com o `ConfirmDialog`.

**Checkpoint**: o ciclo do contato está completo, e a métrica primária (concluídos em até 7 dias) pode ser medida.

---

## Phase 7: User Story 5 - Comunicação publica boletins e mensagens; membros leem (Priority: P2)

**Goal**: boletins com PDF e Palavra Viva com editor restrito, agendamento, meta injetada, sitemap e rascunho local (C-02, C-03).

**Independent Test**: com o usuário da Comunicação, cadastrar, agendar, substituir e excluir boletins e mensagens. Conferir as páginas públicas, "Ler boletim" / "Baixar PDF", `og:title` via `curl` e a restauração do rascunho depois de a sessão expirar.

### Tests for User Story 5 ⚠️

- [X] T107 [P] [US5] Testes de feature do painel de boletins em `backend/tests/Feature/Content/BulletinAdminTest.php`:
  - BR-040 (edição única entre os não excluídos);
  - BR-041 (PDF verdadeiro de até 10 MB; 413 e 422);
  - BR-042 (agendado fica invisível);
  - a substituição do PDF apaga o arquivo anterior;
  - exclusão lógica, regeneração de snapshots e auditoria.
- [X] T108 [P] [US5] Testes de feature de `GET /api/public/bulletins` (12 por página, ordem por `reference_date`, filtro mês e ano, 422) em `backend/tests/Feature/Content/PublicBulletinsTest.php`
- [X] T109 [P] [US5] Testes de feature da Palavra Viva, no painel e no público, em `backend/tests/Feature/Content/PalavraVivaTest.php`:
  - BR-032 (slug único entre os não excluídos);
  - BR-044 (só YouTube);
  - BR-046 (`sanitization_warning`);
  - BR-042 (agendada fica invisível);
  - 10 por página.
- [X] T110 [P] [US5] Testes de `GET /palavra-viva/{slug}` (meta e JSON-LD `Article` com HTML escapado, 404 para agendada ou excluída, `Cache-Control`) e de `GET /sitemap.xml` em `backend/tests/Feature/Content/MetaInjectionTest.php`
- [X] T111 [US5] Acrescentar `/api/admin/bulletins*` e `/api/admin/palavra-viva*` à matriz em `backend/tests/Feature/Access/AuthorizationMatrixTest.php`
- [X] T112 [P] [US5] Testes do rascunho local (FR-077) em `frontend/app/shared/drafts/__tests__/drafts.test.ts`:
  - chave por usuário, formulário e id;
  - *debounce* de 1 s e validade de 7 dias;
  - limpeza ao salvar, ao descartar e no logout.
  Somar um teste de lint que falha ao importar `shared/drafts` em `features/leads`.
- [X] T113 [P] [US5] Testes de componente do `RichTextEditor` (só os formatos permitidos, aviso de remoção) e do `FileDrop` (progresso) em `frontend/app/features/content/__tests__/editor.test.tsx`
- [X] T114 [P] [US5] E2E de conteúdo em `e2e/specs/content.spec.ts`:
  - boletim com PDF de 10 MB, boletim agendado e PDF falso;
  - "Ler boletim" (nova aba) e "Baixar PDF";
  - mensagem com `<script>` colado;
  - sessão expirada com restauração do rascunho.

### Implementation for User Story 5

- [X] T115 [US5] Implementar as Actions de boletim (`CreateBulletin`, `UpdateBulletin`, `ReplaceBulletinPdf`, `DeleteBulletin`) e o `AdminBulletinController` em `backend/app/Modules/Content/`, com `PublicContentChanged` e auditoria
- [X] T116 [P] [US5] Implementar o `PublicBulletinsController` (`GET /api/public/bulletins`) em `backend/app/Modules/Content/Http/Controllers/PublicBulletinsController.php`
- [X] T117 [US5] Implementar as Actions da Palavra Viva (gerar o `excerpt`, extrair o `youtube_video_id`, sanitizar) e os controllers do painel e do público em `backend/app/Modules/Content/`
- [X] T118 [US5] Implementar o `MetaShellController` em `backend/app/Modules/Content/Http/Controllers/` e as rotas web em `backend/routes/web.php`:
  - `MetaShellController` lê `__spa-fallback.html` e injeta `<title>`, `description`, Open Graph e JSON-LD, escapados;
  - o `SitemapController` cobre as rotas fixas e as mensagens; os eventos entram na US9.
- [X] T119 [US5] Implementar o módulo `frontend/app/shared/drafts/` (FR-077, plan.md → Pontos de integração 1) e a regra de ESLint que só permite importá-lo em `features/content` e `features/events`
- [X] T120 [P] [US5] Implementar o `RichTextEditor` (TipTap + StarterKit restrito aos formatos do `SanitizedHtml`, estilizado com Tailwind e `prose` na leitura) em `frontend/app/shared/ui/rich-text-editor.tsx`
- [X] T121 [US5] Criar as páginas públicas em `frontend/app/routes/public/`:
  - `/boletins`: filtro mês e ano, "Ler boletim" com `target="_blank" rel="noopener"` e "Baixar PDF" com `download`, estado vazio;
  - `/palavra-viva`: lista de 10 por página;
  - `/palavra-viva/:slug`: `prose` e `YouTubeFacade`.
- [X] T122 [US5] Criar as telas `/admin/boletins[/novo|/:id]` (`FileDrop`, agendamento em America/Sao_Paulo) e `/admin/palavra-viva[/novo|/:id]` (`RichTextEditor`, aviso de sanitização, rascunho local) em `frontend/app/routes/admin/`
- [X] T210 [US5] (2026-10-22: backend 5/5; frontend 6/8, com upload de PDF e colagem de HTML não exercitáveis pelo agente e cobertos por Playwright 10/10; ver `testsprite_tests/testsprite-mcp-test-report-us5.md`) Rodar o TestSprite da US5 sobre boletins e Palavra Viva, como Comunicação:
  - boletim: criar com PDF, agendar (fica invisível no público), substituir o PDF e excluir; PDF falso recusado (BR-041);
  - mensagem: um `<script>` colado sai sanitizado, com o aviso (BR-046); mensagem agendada dá 404 no público;
  - público: `/boletins` ("Ler boletim", "Baixar PDF" e filtro por mês e ano), `/palavra-viva` e `/palavra-viva/:slug`.

**Checkpoint**: boletins e mensagens são publicados sem desenvolvedor.

---

## Phase 8: User Story 6 - Membro contribui via PIX; Tesouraria mantém os dados com segurança (Priority: P2)

**Goal**: página "Contribua" com cópia da chave e painel da Tesouraria com reconfirmação de senha, auditoria e alerta (C-04).

**Independent Test**: copiar a chave num celular, com e sem Clipboard API. Como Tesouraria, alterar com a senha errada, com a senha certa e sem `PIX_ALERT_RECIPIENTS`, e conferir a auditoria e o alerta no Mailpit.

**Pré-requisito**: confirmar a Q-11 da TBD-11 (uma chave PIX ou uma por finalidade) antes da T127. Sem resposta, vale uma única chave (spec → Assumptions → PIX).

### Tests for User Story 6 ⚠️

- [X] T123 [P] [US6] Testes de feature de `POST /api/admin/settings/pix` em `backend/tests/Feature/Content/PixSettingsTest.php`:
  - BR-060 (senha errada não muda nada);
  - BR-061 (CNPJ) e BR-062 (CRC16);
  - BR-063 (sem destinatários → 409);
  - BR-045 (QR PNG ou JPEG até 1 MB);
  - auditoria `pix.updated` com o valor anterior e o novo, alerta enfileirado e snapshot regenerado.
- [X] T124 [US6] Acrescentar `/api/admin/settings/pix` à matriz em `backend/tests/Feature/Access/AuthorizationMatrixTest.php` (só TESOURARIA)
- [X] T125 [P] [US6] Testes de componente do `PixCopy` ("Chave copiada!" e o *fallback* "toque e segure para copiar") em `frontend/app/shared/ui/__tests__/pix-copy.test.tsx`
- [X] T126 [P] [US6] E2E do PIX (página pública e as três situações do painel) em `e2e/specs/pix.spec.ts`

### Implementation for User Story 6

- [X] T127 [US6] Implementar a Action `UpdatePixSettings` em `backend/app/Modules/Content/Actions/UpdatePixSettings.php`. Ordem:
  1. confere `current_password`;
  2. confere `PIX_ALERT_RECIPIENTS`;
  3. valida os VOs e grava o QR pelo `UploadStore`;
  4. despacha `PixSettingsChanged`.
- [X] T128 [US6] Implementar os listeners de `PixSettingsChanged` em `backend/app/Modules/Content/Listeners/`: auditoria com o valor anterior e o novo, e `PixAlertMail` para `PIX_ALERT_RECIPIENTS` (destinatários vêm do `.env`, fora do painel)
- [X] T129 [US6] Criar o `PixSettingsController` (`POST /api/admin/settings/pix`, multipart) em `backend/app/Modules/Content/Http/Controllers/PixSettingsController.php`
- [X] T130 [P] [US6] Criar a página `/contribua` em `frontend/app/routes/public/contribua.tsx`, com:
  - QR Code, favorecido e chave formatada;
  - código Copia e Cola, se houver;
  - `PixCopy`;
  - guia de 3 passos e versículo 2Co 9:7.
- [X] T131 [P] [US6] Criar a tela `/admin/pix` (formulário com diálogo de reconfirmação de senha e mensagens das BR-060 a BR-063; sem rascunho local) em `frontend/app/routes/admin/pix.tsx`
- [X] T132 [P] [US6] Escrever `docs/runbooks/pix-alterado-indevidamente.md`
- [X] T211 [US6] (4 de 5 casos passaram: TC002, TC006, TC009, TC015. TC001 ficou bloqueado porque o agente não escolhe arquivo no campo do QR Code; a alteração com sucesso está coberta pelo Playwright. O TC002 falhou duas vezes por fixture local, já corrigida: snapshot sujo do Pest, agora isolado em `phpunit.xml`, e QR de 1 pixel. Relatório: `testsprite_tests/testsprite-mcp-test-report-us6.md`) Rodar o TestSprite da US6 sobre o PIX:
  - público: `/contribua` mostra QR Code, favorecido e chave, e o botão copia a chave ("Chave copiada!");
  - Tesouraria: alterar com a senha errada não muda nada (BR-060); com a senha certa, `/contribua` mostra o novo valor; sem `PIX_ALERT_RECIPIENTS` a alteração é recusada (BR-063);
  - outro papel não acessa `/admin/pix`.

**Checkpoint**: PIX público e alteração segura funcionam.

---

## Phase 9: User Story 7 - Secretaria mantém os dados institucionais atualizados sem desenvolvedor (Priority: P2)

**Goal**: painel de configurações (horários, avisos, endereço, links, destinatários) e catálogo de ministérios, grupos e células (C-01, M-01 painel).

**Independent Test**: como Secretaria, alterar cada configuração e cada tipo de item do catálogo. Conferir o reflexo nas páginas públicas em até 1 minuto e a autoria na auditoria.

### Tests for User Story 7 ⚠️

- [X] T133 [P] [US7] Testes de feature de `GET /api/admin/settings` e `PATCH /api/admin/settings` em `backend/tests/Feature/Content/AdminSettingsTest.php`:
  - validação por chave (até 20 horários, CEP de 8 dígitos, limites dos avisos);
  - BR-051 (até 10 e-mails) e BR-011 (`warnings`);
  - `pix` recusada nesta rota;
  - auditoria `setting.updated` e snapshot regenerado.
- [X] T134 [P] [US7] Testes de feature de `/api/admin/ministries` em `backend/tests/Feature/Ministries/AdminMinistriesTest.php`:
  - BR-047 (`ITEM_IN_USE`) e BR-049 (dia e horário; bairro);
  - `private_address` e `contact_email` só no painel;
  - item inativo some do público;
  - auditoria e snapshot.
- [X] T135 [US7] Acrescentar `/api/admin/settings` e `/api/admin/ministries*` à matriz em `backend/tests/Feature/Access/AuthorizationMatrixTest.php`
- [X] T136 [P] [US7] Testes de componente do editor de horários (até 20 itens, HH:mm) e da lista de destinatários em `frontend/app/features/content/__tests__/settings-form.test.tsx`
- [ ] T137 [P] [US7] E2E de configurações e catálogo (mudança refletida em `/` em até 1 min) em `e2e/specs/settings.spec.ts`

### Implementation for User Story 7

- [X] T138 [US7] Implementar os schemas de validação por `SettingKey` em `backend/app/Modules/Content/Settings/SettingSchemas.php`
- [X] T139 [US7] Implementar a Action `UpdateSettings` (substitui só as chaves enviadas e despacha `PublicContentChanged` para chave pública) e o `AdminSettingsController` (`GET` com `warnings` e `PATCH`) em `backend/app/Modules/Content/`
- [X] T140 [US7] Implementar as Actions `CreateMinistryGroup`, `UpdateMinistryGroup` e `DeleteMinistryGroup` (checagem de referências) e o `AdminMinistriesController` em `backend/app/Modules/Ministries/`
- [X] T141 [US7] Criar a tela `/admin/configuracoes` (horários, avisos, endereço, links, WhatsApp, redes e destinatários por tipo, com o banner de tipo sem destinatário) em `frontend/app/routes/admin/configuracoes.tsx`
- [X] T142 [US7] Criar a tela `/admin/ministerios[/novo|/:id]` (formulário por categoria, ordenação, ativar e desativar, exclusão com a mensagem da BR-047) em `frontend/app/routes/admin/ministerios/`
- [X] T212 [US7] (2026-10-23: 10 de 12 casos passaram. TC001 falhou por expectativa do plano, não por defeito: o aviso da Ceia é manual e vem desligado, e o endereço de seed ainda é `TODO(TBD-11)`. TC020 ficou bloqueado porque o agente perdeu a referência do campo de e-mail; a BR-051 está coberta por Vitest e Pest. Relatório: `testsprite_tests/testsprite-mcp-test-report-us7.md`) Rodar o TestSprite da US7 sobre as configurações e o catálogo, como Secretaria:
  - horários, avisos, endereço, links e destinatários: alterar e ver o reflexo em `/` em até 1 min; limites de validação (até 20 horários e até 10 e-mails: BR-051);
  - ministérios, grupos e células: criar, editar, desativar (some do público) e excluir um item em uso (mensagem da BR-047);
  - `private_address` e `contact_email` só aparecem no painel, nunca no público.

**Checkpoint**: autonomia editorial completa (BG-3).

---

## Phase 10: User Story 12 - Responsável técnico opera o portal com segurança e recupera falhas rápido (Priority: P3)

**Goal**: backups cifrados, expurgo LGPD, resumo diário, alertas, runbooks e kit de contingência (PL-03, PL-04, PL-05, QA-04).

**Independent Test**: em homologação, simular uma queda e uma rotina parada e conferir os alertas. Restaurar o banco e os arquivos a partir do B2 num banco local. Rodar o expurgo com relógio simulado.

### Tests for User Story 12 ⚠️

- [X] T143 [P] [US12] (2026-10-23: `BackupTest.php`, 24 testes; o envio ao B2 usa `Storage::fake`, sem o bucket real) Testes de backup em `backend/tests/Feature/Platform/BackupTest.php`:
  - dump cifrado com a chave pública, que não abre sem a privada;
  - retenção de 48 h na conta;
  - envio ao B2 (`Storage::fake`), com o mensal no dia 1;
  - *heartbeat* e `/fail`.
- [X] T144 [P] [US12] (2026-10-23: `RetentionPurgeTest.php`, 19 testes, com os prazos aprovados em 2026-10-23) Testes do expurgo com datas simuladas em `backend/tests/Feature/Platform/RetentionPurgeTest.php`:
  - BR-080 e os prazos e bases de cálculo do FR-065 (`ORACAO` concluído e não concluído, demais contatos, inscrições);
  - histórico apagado em cascata;
  - só as quantidades em `audit_logs` (`retention.purged`);
  - `failed_jobs` com 30 dias e auditoria com 24 meses.
- [X] T145 [P] [US12] (2026-10-23: `DailyReportTest.php`, 27 testes, incluindo o `pibls:mail:failure-check`) Testes do resumo diário (seções do Observability; bloco mensal no dia 1, com as métricas do SC-003, SC-004, SC-006 e SC-019 calculadas sobre dados simulados) e de `pibls:mail:failure-check` (mais de 10 falhas definitivas em 1 h → ping `/fail`) em `backend/tests/Feature/Platform/DailyReportTest.php`

### Implementation for User Story 12

- [X] T146 [US12] (2026-10-23: comando em `Platform/Console/BackupDbCommand.php` (o Laravel só descobre comandos nessa pasta) e a lógica em `Platform/Backup/`; acrescentados `pibls:backup:keygen` e `pibls:backup:decrypt`, o interruptor `BACKUPS_ENABLED` (só a produção liga) e dump com estrutura (sem dados) de `cache`, `cache_locks` e `sessions`) Implementar `pibls:backup:db` (`druidfi/mysqldump-php`, cifragem com `crypto_secretstream` + `crypto_box_seal`, limpeza de mais de 48 h) em `backend/app/Modules/Platform/Backup/`
- [X] T147 [US12] (2026-10-23: o disco `b2` está em `config/filesystems.php`; **testado só com disco falso**, o bucket real depende da T152) Implementar `pibls:backup:offsite` (B2 via flysystem S3 com chave sem permissão de exclusão, mensal no dia 1, sincronização incremental de `uploads/`, *heartbeat*) em `backend/app/Modules/Platform/Backup/`
- [X] T148 [US12] (2026-10-23: os prazos ficam em `config/pibls.php` (`RETENTION_*`), não num `retention.php` separado; `RetentionPurger` em `Platform/Retention/`, comandos em `Platform/Console/`) Implementar `pibls:retention:purge` (prazos de `backend/config/retention.php`, lidos de `RETENTION_*`) e `pibls:audit:prune` em `backend/app/Modules/Platform/Retention/`
- [X] T149 [US12] (2026-10-23: `Platform/Reports/` (`DailyReport`, `DailyReportMail`, `LogReader`, `UptimeRobot`) e as views `mail/daily-report`) Implementar `pibls:daily-report` e o Mailable em `backend/app/Modules/Platform/Reports/`. O resumo traz:
  - a release ativa e o p95 por rota (do *access log*) comparado às metas;
  - os erros e a fila;
  - os backups e o disco;
  - os contatos parados há mais de 3 dias e as inscrições do dia;
  - no dia 1, o bloco mensal, sem dados pessoais:
    - contatos recebidos e concluídos por tipo, e a taxa de concluídos em até 7 dias (SC-003);
    - a mediana do tempo entre o envio e a primeira mudança de status (SC-004, de `lead_activities`);
    - as semanas com o boletim publicado até domingo às 8h (SC-006, `published_at` × `reference_date`, contadas a partir do go-live);
    - o p95 do atraso dos avisos por e-mail (SC-019, do log `mail.sent` da T041);
    - a disponibilidade do mês (UptimeRobot).
- [X] T150 [US12] (2026-10-23: o comando está em `Platform/Console/MailFailureCheckCommand.php`, não em `Platform/Mail/`, pela regra de descoberta de comandos) Implementar `pibls:mail:failure-check` em `backend/app/Modules/Platform/Mail/MailFailureCheckCommand.php`
- [X] T151 [US12] (2026-10-23: `SchedulerTest.php` (10 testes) e `ReleaseCleanupTest.php` (9); acrescentado o `pibls:releases:cleanup` (semanal, `Platform/Releases/`), que a tabela previa e não existia) Completar o agendador em `backend/routes/console.php`, conforme Infrastructure → Tarefas do agendador (frequências e horários America/Sao_Paulo, `withoutOverlapping`)
- [ ] T152 [US12] (2026-10-23, **versão enxuta (ADR-021)**: pronta quando houver o bucket do B2 com a chave sem exclusão, `BACKUPS_ENABLED=true` + `BACKUP_PUBLIC_KEY` + `B2_*` no `.env` de produção, **2 checks** do Healthchecks (worker e cópia externa), **1 monitor** do UptimeRobot e o teste de uso único do `pibls:backup:db` e do `pibls:backup:offsite` com o arquivo no bucket e o check verde. Sentry e resumo diário são opcionais. **Pendente de execução pelo responsável**; passo a passo de 1 h em `docs/runbooks/operacao-enxuta.md`) Configurar os serviços externos e registrar em `docs/runbooks/setup-hospedagem.md`, conferindo os planos gratuitos (TBD-07):
  - UptimeRobot: `/` e `/api/health` a cada 5 min, SSL a menos de 14 dias, push e e-mail para o responsável, e-mail para a liderança;
  - Healthchecks: worker e ativador (15 min), dump (30 min), cópia externa (2 h);
  - Sentry (UE).
- [X] T153 [P] [US12] (2026-10-23: os 6 runbooks escritos; falta só a leitura da liderança) Escrever os runbooks em `docs/runbooks/`: `site-fora-do-ar.md`, `emails-nao-chegam.md`, `restaurar-backup.md`, `conta-comprometida.md`, `lgpd-pedido-do-titular.md` (15 dias, acesso e portabilidade) e `atualizacao-anual.md`
- [ ] T154 [US12] (2026-10-23, **versão enxuta (ADR-021)**: ensaio local concluído (backup cifrado, abertura com a chave privada e restauração com contagens idênticas, `restaurar-backup.md` §5). Pronta quando houver **um** ensaio a partir do B2 real, com a chave privada, depois da primeira cópia (depende da T152); depois, uma vez por ano. Passo 7 de `operacao-enxuta.md`) Restaurar o banco e os arquivos completos a partir do B2 num banco local, com a chave privada, e registrar o procedimento e o tempo em `docs/runbooks/restaurar-backup.md` (critério do PL-03)
- [ ] T155 [US12] (2026-10-23, **versão enxuta (ADR-021)**: pronta quando um cofre KeePassXC com as 6 entradas essenciais (cPanel, domínio, `.env`, chave privada dos backups, GitHub, B2) estiver com **uma pessoa de confiança da liderança**, que o abriu uma vez, e registrada em `kit-de-contingencia.md` §5. **Pendente de execução pela liderança**; passo 8 de `operacao-enxuta.md`) Montar o kit de contingência (KeePassXC com cPanel, domínio, `.env`, chave privada dos backups, GitHub e recuperação de 2FA), entregá-lo à liderança e registrar a entrega em `docs/runbooks/kit-de-contingencia.md` (QA-04)
- [X] T202 [US12] (2026-10-23: `rotina-de-manutencao.md`, `.github/workflows/lembretes.yml`, `deploy/ci/abrir-lembretes.sh` e os checklists em `deploy/lembretes/`; o workflow só roda de fato depois do primeiro push ao GitHub) Escrever `docs/runbooks/rotina-de-manutencao.md` com o calendário de `architecture.md` → DevOps → Rotina de manutenção, mais a conferência mensal do LCP de campo no Search Console / CrUX (Observability → Métricas; SC-002). Criar `.github/workflows/lembretes.yml`, que abre uma issue com o checklist de cada data: mensal, trimestral, semestral e anual (fevereiro). O primeiro teste trimestral de restauração é o da T154 (Constituição VII)
- [X] T213 [US12] (2026-10-23: 11 de 11 casos passaram, 5 de frontend e 6 de backend; o TC009 falhou na primeira execução por causa do roteiro gerado, que não conhecia o envelope `{data: …}`, e passou na segunda sem nenhuma mudança no app; relatório: `testsprite_tests/testsprite-mcp-test-report-fase10.md`) Rodar o TestSprite da Fase 10 em escopo reduzido: a fase é de Artisan e cron, sem tela nova. Cobrir só `GET /api/health` (200 com `release`), o login e uma página pública, para provar que o agendador e o expurgo não quebraram o app. Backup, expurgo e alertas seguem cobertos só pelo Pest (T143 a T145)

**Checkpoint**: operação pronta para o go-live (RTO ≤ 4 h, RPO ≤ 1 h).

> **Situação em 2026-10-23: código e testes prontos, checkpoint ainda aberto.** A operação segue a **versão enxuta da ADR-021**: a meta realista é voltar em um dia útil perdendo até 24 h (o RTO de 4 h e o RPO de 1 h valem só para o roteiro completo). Faltam três tarefas que dependem de pessoas e de serviços externos, não de código: T152 (B2, 2 checks, 1 monitor), T154 (um ensaio de restauração a partir do B2 real) e T155 (cofre com uma pessoa da liderança). Tudo em `docs/runbooks/operacao-enxuta.md`, cerca de 1 hora.

---

## Phase 11: User Story 8 - A igreja troca o site antigo sem perder e-mail, links nem histórico (Priority: P3)

**Goal**: qualidade final, migração do legado e cutover do WordPress com retorno possível (QA-01 a QA-03, G-01).

**Independent Test**: ensaiar a troca e o retorno em homologação. Conferir os 301 a partir do inventário e o envio e recebimento de e-mail antes e depois.

**Gates de entrada**: US1 a US7 e US12 validadas em homologação; TBD-03, TBD-06, TBD-08, TBD-09 e TBD-11 (conteúdo final do seed e das páginas fixas) resolvidas. A TBD-10 não é gate: sem ela, o site entra com a paleta neutra, e a T203 fica para depois.

- [ ] T156 [US8] Levantar a linha de base do Search Console (para o SC-009), o inventário do WordPress (URLs mais acessadas, plugins, mídia) e os registros de DNS de e-mail (MX, SPF, DKIM, DMARC) em `docs/runbooks/cutover.md` (TBD-08)
- [X] T157 [P] [US8] Implementar `php artisan pibls:import-legacy` em `backend/app/Modules/Content/Console/ImportLegacyCommand.php`, com teste em `backend/tests/Feature/Content/ImportLegacyTest.php` (FR-071). O comando lê a planilha (edição, data, título, caminho do PDF; mensagens) e preserva `reference_date` e `published_at`
- [ ] T158 [US8] Escrever o mapa de redirecionamentos 301 na regra 3 de `deploy/htaccess/public_html.htaccess` e o teste de cada URL do inventário em `e2e/specs/redirects.spec.ts`
- [X] T159 [US8] Completar o E2E em `e2e/specs/full/` (todos os formulários, fluxos do painel por papel, redefinição, PIX) com axe em todas as páginas públicas e telas principais do painel (QA-01)
  - Feito: `e2e/specs/full/` (`publico-axe`, `painel-por-papel`, `jornada-visitante`): 7 papéis × 9 telas no axe, 7 páginas públicas, jornada do visitante e da oração anônima. A 1ª rodada achou 2 defeitos reais, corrigidos: a tela "sem acesso" do painel não tinha `<title>` (WCAG 2.4.2) e as abas inativas tinham contraste 4,42:1 (`text-foreground/60` → `text-muted-foreground`). Rodar com `E2E_USERS_PASSWORD`, `E2E_TEST_TIMEOUT=240000`, `E2E_EXPECT_TIMEOUT=45000` e `cache:clear` entre rodadas.
- [ ] T160 [P] [US8] Criar `.github/workflows/zap.yml` (OWASP ZAP baseline semanal em homologação) e revisar o checklist OWASP ASVS nível 1 em `docs/runbooks/asvs-l1.md`, sem achado alto aberto (QA-01)
- [X] T201 [US8] Implementar a medição de uso sem cookies (FR-076) com a ferramenta escolhida na TBD-09 (plan.md → Pontos de integração 4):
  - um único script, configurado no build por `VITE_ANALYTICS_SRC` (vazio = nenhum script), carregado em `frontend/app/root.tsx` só nas rotas públicas, nunca em `/admin*`;
  - origem da ferramenta na CSP de `deploy/htaccess/public_html.htaccess` (`script-src` e, se necessário, `connect-src`), no mesmo PR (`contracts/web-routes.md`);
  - E2E em `e2e/specs/analytics.spec.ts`: depois de navegar pelas páginas públicas, nenhum cookie nem item de `localStorage` da ferramenta, e nenhuma requisição a terceiros além da origem configurada.
  - Feito (ADR-022, GoatCounter): `frontend/app/shared/observability/analytics.tsx` (10 testes Vitest) montado em `root.tsx`; variáveis `VITE_ANALYTICS_SRC` e `VITE_ANALYTICS_ENDPOINT` no `deploy.yml`; CSP com `gc.zgo.at` e `*.goatcounter.com` (`TemplatesTest`); `e2e/specs/analytics.spec.ts` passa nos dois modos (sem medição e ligada, com `E2E_ANALYTICS_ORIGINS` e `E2E_ANALYTICS_STUB=1`). Frase nova na Política de Privacidade (precisa da aprovação da liderança). **Antes do go-live:** criar a conta no GoatCounter e preencher as duas variáveis no GitHub (`setup-hospedagem.md`).
- [ ] T161 [US8] Rodar `load/navigation.js` (k6, 100 usuários por 10 min) contra a homologação na janela de manutenção e registrar o p95 de leitura (≤ 800 ms), o de escrita (≤ 1,5 s) e a taxa de erro (< 1%) em `docs/runbooks/carga.md` (QA-02; SC-012)
- [ ] T162 [US8] Conduzir os testes de usabilidade e escrever `docs/manual-do-painel/` (boletim, mensagem, contato, horários, PIX) (QA-03):
  - 5 pessoas que não conhecem a igreja (SC-001);
  - Comunicação publicando o boletim em até 15 min (SC-005);
  - 2 a 3 membros com mais de 60 anos (SC-016).
- [ ] T163 [US8] Ensaiar em homologação o retorno ao site antigo, sem alterar DNS, em ≤ 15 min (renomear `public_html` e recolocar o `wp_legacy`, preservando `.well-known/`), e registrar em `docs/runbooks/cutover.md`
- [ ] T203 [US8] (parcial em 2026-10-23: cores do Manual da Marca nos tokens e no e-mail; logotipo no cabeçalho, no rodapé, no menu e no login do painel; favicon, ícones e Open Graph gerados do símbolo; fotos dos cultos otimizadas e nas páginas. Falta só a tipografia, se a marca tiver fonte própria) Aplicar a identidade visual quando a TBD-10 for resolvida: cores nos tokens de `frontend/app/app.css`, logotipo, favicon e imagem padrão de Open Graph e, se houver fonte da marca, `woff2` auto-hospedado (`architecture.md` → Performance → Fontes). Conferir o contraste AA com o axe
- [ ] T214 [US8] Rodar a regressão completa do TestSprite antes da conferência de prontidão (T164) e do cutover (T165), contra o app local servido por `npm run deploy:local` (com o `.htaccess` real) e dados fictícios. Cobrir:
  - todas as páginas públicas e os 5 formulários;
  - os fluxos do painel por papel (contatos, boletins, Palavra Viva, PIX, configurações, ministérios e usuários).
  O resultado entra na T164. Nunca contra produção, nem durante o cutover. Os 301 e a medição de uso seguem na T158 e na T201
- [ ] T164 [US8] Conferir a prontidão para o go-live: atualizar `architecture.md` → Go-Live Readiness, com cada linha em 🟢 ou com a justificativa aceita pelo responsável. Inclui o Lighthouse em perfil móvel (4G simulado) nas páginas públicas da homologação, com LCP ≤ 2,5 s (SC-002, medida de laboratório; a de campo entra na T202)
- [ ] T165 [US8] Executar o cutover, conforme `docs/runbooks/cutover.md`, numa janela seg–qua 9h–18h:
  - backup completo do WordPress fora da hospedagem, com restauração conferida;
  - mover para `wp_legacy/`, sem tocar nameservers nem DNS de e-mail;
  - teste de envio e recebimento do e-mail institucional;
  - envio do `sitemap.xml` ao Search Console.
- [ ] T166 [US8] Fazer o acompanhamento pós-go-live e registrar cada marco em `docs/runbooks/cutover.md`:
  - 7 dias de monitoramento de 404 (ajustar os 301);
  - aos 30 dias estáveis, arquivar o WordPress fora da hospedagem e removê-lo da conta;
  - aos 90 dias, destruir o arquivo.

**Checkpoint**: **R1 no ar**.

---

## Phase 12: User Story 9 - Líder de ministério cria e publica um evento com formulário de inscrição (Priority: P4, R2)

**Goal**: eventos no painel com construtor de formulário, banner, escopo do próprio ministério e publicação (E-01). Tudo atrás de `FEATURE_EVENTS`.

**Independent Test**: com um líder (escopo do próprio ministério) e um usuário da Comunicação (todos), criar, editar, publicar, despublicar e tentar excluir eventos. Conferir as regras de escopo e de validação.

**Gate de entrada**: R1 no ar e **TBD-12 resolvida**.

- [X] T167 [US9] (2026-10-23: propagada em `architecture.md` com a BR-083, em `data-model.md`, em `contracts/openapi.yaml` e no `spec.md`. A ADR-019 já era a da rota única do painel, então a decisão é a **ADR-020**, em `docs/adr/0020-consentimento-dados-de-saude.md`. A confirmação da liderança pastoral segue pendente, registrada na TBD-12) Registrar a decisão da TBD-12, tomada pelo responsável em 2026-10-20: adotar o marcador `sensitive` no `FormField` e um segundo consentimento específico para dados de saúde, gravado em `health_consent_at`. Confirmar com a liderança. Escrever a ADR-020 em `docs/adr/0020-consentimento-dados-de-saude.md` e atualizar, no mesmo PR, `architecture.md`, `data-model.md` (`FormField`, `event_registrations`) e `contracts/openapi.yaml`

### Tests for User Story 9 ⚠️

- [X] T168 [P] [US9] Testes de feature do painel de eventos em `backend/tests/Feature/Events/AdminEventsTest.php`:
  - datas e vagas: BR-025, BR-026 e BR-027;
  - exclusão e formulário: BR-028 e BR-029 (`confirm_schema_change`; respostas preservadas com o rótulo);
  - escopo e unicidade: BR-030 (`.own` → 404) e BR-032;
  - banner: BR-045, com variantes WebP;
  - "Encerrar inscrições";
  - flag desligada → 404.
- [X] T169 [P] [US9] Testes unitários do `FormSchema` (BR-031: 30 campos, `key` única no padrão, 2 a 30 opções sem repetição, tipos; marcador `sensitive` conforme a ADR-020 e a BR-083) em `backend/tests/Unit/Events/FormSchemaTest.php`
- [X] T170 [US9] Acrescentar `/api/admin/events*` (exceto inscritos) à matriz em `backend/tests/Feature/Access/AuthorizationMatrixTest.php`, incluindo LIDER_MINISTERIO com e sem ministério (BR-075)
- [X] T171 [P] [US9] Testes de componente do construtor de formulário (adicionar, ordenar, opções; confirmação ao remover ou trocar o tipo com inscrições; confirmação da BR-033 ao publicar com prazo vencido) em `frontend/app/features/events/__tests__/form-builder.test.tsx`

### Implementation for User Story 9

- [X] T172 [P] [US9] Implementar os Value Objects `FormField` e `FormSchema` em `backend/app/Modules/Events/ValueObjects/`
- [X] T173 [P] [US9] Implementar a `EventPolicy` (`eventos.write` em tudo; `.own` só no ministério do usuário; 404 fora do escopo) em `backend/app/Modules/Events/Policies/EventPolicy.php`
- [X] T174 [US9] Implementar as Actions `CreateEvent`, `UpdateEvent` (vagas, schema com confirmação, `registration_deadline` = agora para encerrar), `PublishEvent`, `UnpublishEvent` e `DeleteEvent` em `backend/app/Modules/Events/Actions/`, com `PublicContentChanged` e auditoria
- [X] T175 [US9] Implementar `POST /api/admin/events/{id}/banner` e `DELETE /api/admin/events/{id}/banner` com o `UploadStore` (WebP de 1600 e 800 px) em `backend/app/Modules/Events/Http/Controllers/EventBannerController.php`
- [X] T176 [US9] Implementar o `AdminEventsController` (lista com `registrations_count` e estado derivado; CRUD) com o middleware `EnsureFeatureEnabled:events` em `backend/app/Modules/Events/`
- [X] T177 [US9] Estender, com a flag ligada, a meta injetada de `GET /eventos/{slug}` (JSON-LD `Event`, `og:image` = banner), o `sitemap.xml` (eventos publicados) e o `home.json` (`upcoming_events`), em `backend/app/Modules/Events/Http/` e `backend/app/Modules/Platform/Snapshots/Definitions/`
- [X] T178 [US9] Criar as telas `/admin/eventos[/novo|/:id]` em `frontend/app/routes/admin/eventos/` e `frontend/app/features/events/`. Formulário do evento com:
  - construtor de campos com classes literais;
  - banner;
  - "Publicar", "Despublicar" e "Encerrar inscrições";
  - rascunho local sem o banner.
  - Feito em 2026-10-23 (`features/events/`, rotas `routes/admin/eventos.tsx` e `evento.tsx`): lista com filtros na URL, formulário, imagem de capa, construtor (subir e descer por botões, sem arrastar), publicar, despublicar, encerrar e reabrir inscrições, rascunho local sem a imagem. **Divergências do board `AdminEvento`, registradas aqui (a arquitetura prevalece):** (1) o construtor oferece os 7 tipos da API (BR-031), não os 4 do mock, mais o marcador "É informação de saúde" (ADR-020); (2) sem o campo "Descrição da imagem" (a API não tem alt do banner; a imagem é decorativa na tela); (3) o link "Ver inscritos" entra com a US11 (Fase 14); (4) "Reabrir inscrições" tira o prazo e só aparece com o evento por começar e com vaga; (5) sem limite mínimo/máximo de caracteres nas perguntas de texto (só `min`/`max` de número); (6) o ministério vem do snapshot público e, para quem só tem `.own`, fica fixo no do usuário. Pontos de extensão novos para o `Content` não depender do `Events`: ver `architecture.md` → Regras de dependência.
- [X] T215 [US9] Rodar o TestSprite da US9 sobre os eventos no painel, com `FEATURE_EVENTS=true` no ambiente local, como Comunicação e como líder de ministério:
  - criar, editar, publicar, despublicar e excluir evento; construtor de formulário (adicionar, ordenar, opções); banner;
  - datas e vagas inválidas recusadas (BR-025 a BR-027);
  - o líder só vê e edita eventos do próprio ministério (outro ministério → 404: BR-030);
  - com a flag desligada, `/api/admin/events*` responde 404.
  - Feito em 2026-10-23: 12 de 12 casos passaram (Comunicação, líder e Secretaria; criar, validar, construtor, publicar, encerrar, reabrir, despublicar, excluir, escopo e sitemap/home). A flag desligada e o envio da imagem ficam no Pest e no Vitest (ver o relatório). Relatório: `testsprite_tests/testsprite-mcp-test-report-us9.md`.

**Checkpoint**: eventos são criados e publicados (com a flag ligada só em homologação).

---

## Phase 13: User Story 10 - Participante se inscreve em um evento com garantia de vaga (Priority: P4, R2)

**Goal**: página do evento, formulário dinâmico e inscrição com garantia de vaga e não duplicidade sob concorrência (E-02).

**Independent Test**: num evento com N vagas, fazer inscrições normais, duplicadas, com menores, fora do prazo e um envio simultâneo maior que as vagas. Exatamente N são aceitas.

### Tests for User Story 10 ⚠️

- [X] T179 [P] [US10] Testes de feature de `POST /api/public/events/{slug}/register` em `backend/tests/Feature/Events/RegisterForEventTest.php`:
  - consentimento e honeypot: BR-001 e BR-002;
  - prazo e vagas: BR-020 e BR-021;
  - duplicidade: BR-022, com a normalização de maiúsculas, acentos e espaços (nome diferente com o mesmo telefone é aceito);
  - menores e respostas: BR-023 e BR-024;
  - consentimento de saúde (`health_consent` exigido com campo `sensitive`, gravado em `health_consent_at`): BR-083 e ADR-020;
  - confirmação enfileirada só com e-mail; falha de e-mail não desfaz a inscrição.
  - Feito em 2026-10-23 (`RegisterForEventTest.php`, 50 casos com o id da BR no nome): consentimento e honeypot, prazo e vagas, duplicidade normalizada, menores, respostas por tipo, consentimento de saúde (migration `health_consent_at`), confirmação só com e-mail.
- [X] T180 [P] [US10] Teste de concorrência em `backend/tests/Feature/Events/RegistrationConcurrencyTest.php` e script de rajada em `load/registration-burst.js`. Com processos paralelos, dois cenários (Constituição V):
  - N vagas e mais de N envios simultâneos resultam em **exatamente N** inscrições (BR-021);
  - vários envios simultâneos com o mesmo telefone e o mesmo nome (variando maiúsculas, acentos e espaços) resultam em **exatamente 1** inscrição, e os demais recebem 409 `DUPLICATE_REGISTRATION` (BR-022).
  O teste é bloqueante antes de ligar o R2.
  - Feito em 2026-10-23 (`RegistrationConcurrencyTest.php`, grupo `concurrency`, processos filhos via `Process::pool`): N vagas e mais de N envios resultam em exatamente N; a mesma pessoa variando caixa, acento e espaço resulta em 1 inscrição e 11 `DUPLICATE_REGISTRATION`. `load/registration-burst.js` (k6) confere `count == SPOTS`. Atenção para a T194: o limiter `registration-submit` (60 por 10 min por IP) impede 300 envios de um IP só; use vários IPs ou `ALLOW_THROTTLE=1`.
- [X] T181 [P] [US10] Testes de componente do formulário dinâmico a partir do `form_schema` (os 7 tipos, obrigatoriedade, limites, bloco do responsável legal, erro por campo) em `frontend/app/features/events/__tests__/registration-form.test.tsx`
  - Feito em 2026-10-23 (`registration-form.test.tsx`, 16 casos): os 7 tipos, obrigatoriedade, limites, bloco do responsável, bloco de saúde, erro por campo vindo do 422.
- [X] T182 [P] [US10] E2E de inscrição em `e2e/specs/registration.spec.ts`: com e sem menores, duplicada, vagas esgotadas (sem o formulário), prazo vencido e evento despublicado ("Evento não encontrado")
  - Feito em 2026-10-23 (`e2e/specs/registration.spec.ts`, projeto `publico-360`): pula sem `E2E_USERS_PASSWORD` ou com a flag desligada; o Líder de Ministério cria os eventos pela API e os remove ao final.

### Implementation for User Story 10

- [X] T183 [P] [US10] Implementar o Value Object `RegistrationAnswers` (valida contra o `FormSchema` vigente e guarda o rótulo da época) em `backend/app/Modules/Events/ValueObjects/RegistrationAnswers.php`
  - Feito em 2026-10-23 (`RegistrationAnswers` e `InvalidRegistrationAnswers`; frases da BR-024 em `lang/pt_BR/business.php`).
- [X] T184 [US10] Implementar a Action `RegisterForEvent` em `backend/app/Modules/Events/Actions/RegisterForEvent.php`. Numa transação:
  1. `SELECT … FOR UPDATE` na linha do evento;
  2. verifica prazo e vagas;
  3. insere com a constraint única e trata a violação como `DUPLICATE_REGISTRATION`;
  4. despacha `RegistrationCreated`.
  - Feito em 2026-10-23 (`RegisterForEvent`: `lockForUpdate` por slug publicado, prazo e vagas, responsável, saúde, respostas e constraint única).
- [X] T185 [US10] Implementar o listener e o `RegistrationConfirmationMail` em `backend/app/Modules/Events/Listeners/` e `backend/app/Modules/Events/Mail/`
  - Feito em 2026-10-23 (`RegistrationCreated`, `QueueRegistrationConfirmation` síncrono na transação, `RegistrationConfirmationMail` sem respostas).
- [X] T186 [US10] Implementar o `PublicEventsController` (`GET /api/public/events`, `GET /api/public/events/{slug}` com o estado derivado e `spots_left`) e `POST …/register` com o limiter `registration-submit`, atrás da flag, em `backend/app/Modules/Events/Http/Controllers/`
  - Feito em 2026-10-23 (`PublicEventsController`, `PublicRegistrationController`, rotas atrás de `feature:events`; `docs/openapi.json` e `api-types.ts` regenerados).
- [X] T187 [US10] Criar as páginas `/eventos` (próximos e anteriores; "não encontrado" com a flag desligada) e `/eventos/:slug` (formulário dinâmico, vagas atualizadas a cada 30 s com a página visível, estado esgotado, resumo da inscrição) em `frontend/app/routes/public/`
  - Feito em 2026-10-23 (`/eventos` pré-renderizada, `/eventos/:slug` não; formulário em `React.lazy` para caber no orçamento de bundle, pior rota 155,9 KB de 160). Divergências do board: sem espaços reservados de banner, pergunta de escolha única com até 4 opções vira rádio e acima disso uma lista, bloco de saúde destacado.
- [X] T216 [US10] Rodar o TestSprite da US10 sobre a inscrição em `/eventos` e `/eventos/:slug`, com `FEATURE_EVENTS=true`:
  - inscrição válida, com e sem menores;
  - inscrição duplicada recusada com `DUPLICATE_REGISTRATION` (BR-022);
  - vagas esgotadas (sem o formulário) e prazo vencido;
  - evento despublicado mostra "Evento não encontrado"; com a flag desligada, `/eventos` mostra a página de "não encontrado".
  A garantia de vaga sob concorrência segue só na T180 e na T194: o TestSprite não faz rajada
  - Feito em 2026-10-24: 8 de 8 casos passaram (lista, inscrição válida, validação, duplicada, menores, esgotado, prazo vencido e rascunho/inexistente). A flag desligada fica no Vitest e no Pest. Relatório em `testsprite_tests/testsprite-mcp-test-report-us10.md`. O E2E do Playwright (T182) pegou o `include_past=true` recusado pelo Laravel (422); corrigido para `1`.

**Checkpoint**: inscrições com garantia de vaga.

---

## Phase 14: User Story 11 - Líder acompanha, exporta e cancela inscrições (Priority: P4, R2)

**Goal**: lista de inscritos, CSV no servidor, PDF no navegador, cancelamento e ativação do R2 em produção (E-03, E-04).

**Independent Test**: num evento com inscrições, abrir a lista, exportar o CSV (abrir no Excel em pt-BR) e o PDF de 500 inscritos (≤ 10 s), e cancelar uma inscrição, conferindo que a vaga volta.

### Tests for User Story 11 ⚠️

- [X] T188 [P] [US11] Testes de feature dos inscritos em `backend/tests/Feature/Events/RegistrationsAdminTest.php`:
  - lista até 500 com `spots_total` e `spots_filled`;
  - CSV em UTF-8 com BOM, separador `;`, colunas do FR-061, só o cabeçalho quando vazio, snapshot do formato, `admin-export` e auditoria `registrations.exported`;
  - `DELETE`: BR-034 e BR-081 (libera a vaga);
  - escopo `.own` → 404.
  - Feito em 2026-10-24 (`RegistrationsAdminTest.php`, 21 casos com o id da BR no nome): lista com `spots_total`/`spots_filled` e busca, CSV (BOM, `;`, CRLF, proteção contra fórmula, só cabeçalho quando vazio, `admin-export`, auditoria `registrations.exported` só com `{count}`), `DELETE` com BR-034 e BR-081 (auditoria `registration.cancelled` e `registration.erased`, sem PII), `.own` em evento de outro ministério → 404.
- [X] T189 [US11] Acrescentar `/api/admin/events/{id}/registrations*` à matriz em `backend/tests/Feature/Access/AuthorizationMatrixTest.php`
  - Feito em 2026-10-24 (3 linhas em `admin-routes.php` e o helper `registrationOf`; a matriz inteira passa, 380 casos).
- [X] T190 [P] [US11] Teste do gerador de PDF (A4 paisagem, cabeçalho do evento, mesmas colunas do CSV; 500 linhas) em `frontend/app/features/events/__tests__/pdf-export.test.ts`
  - Feito em 2026-10-24 (`pdf-export.test.ts`, 9 casos): definição do documento sem a biblioteca (A4 paisagem, cabeçalho, mesmas colunas do CSV, `headerRows: 1`, 501 linhas) e um PDF de verdade com 500 inscrições.
- [X] T191 [P] [US11] E2E dos inscritos (contador, CSV, PDF de 500 em ≤ 10 s com a CPU do Chromium desacelerada 4×, para aproximar o computador de referência do SC-014, cancelamento) em `e2e/specs/registrations-admin.spec.ts`
  - Feito em 2026-10-24 (`e2e/specs/registrations-admin.spec.ts`, projeto `painel-desktop`, 8 casos): contador e progresso, busca na URL, CSV (BOM, cabeçalho, apóstrofo contra fórmula), PDF, cancelar com "Manter" e com confirmação (a vaga volta no site), exclusão LGPD, estado vazio e o PDF de 500 com a CPU 4× mais lenta. As 500 inscrições vêm de `E2E_VOLUME_EVENT_ID` (o limite de envios do site impede criá-las pela API; seed temporário no Docker). **Medição no Docker local de Windows:** a busca das 500 leva ~3 s (6 s a frio) e o PDF leva ~6 a 8 s depois dos dados chegarem; do clique ao arquivo foram 12,6 a 14,8 s. O teste exige ≤ 10 s para a geração e ≤ 15 s no total (10 s + 5 s do servidor local lento). **O SC-014 (≤ 10 s do clique ao arquivo) só se confirma no computador de referência e em homologação: conferir na T194.**

### Implementation for User Story 11

- [X] T192 [US11] Implementar o `RegistrationsController` (lista; `export.csv` por *streaming*; `DELETE` com `reason`) e a `EventRegistrationPolicy` em `backend/app/Modules/Events/`
  - Feito em 2026-10-24 (`RegistrationsController` fino + Actions `ListEventRegistrations`, `CancelRegistration`, `ExportRegistrations` e `RegistrationsExport`, `EventRegistrationPolicy`; `Cache-Control: no-store` na lista; `docs/openapi.json` e `api-types.ts` regenerados).
- [X] T193 [US11] Criar a tela `/admin/eventos/:id/inscritos` em `frontend/app/routes/admin/eventos/inscritos.tsx` e `frontend/app/features/events/pdf-export.ts`:
  - contador "X de Y vagas preenchidas" e tabela com as respostas na ordem do formulário;
  - "Exportar CSV";
  - "Exportar PDF", com `pdfmake` via `import()` só no clique;
  - cancelamento com confirmação.
  - Feito em 2026-10-24 (`registrations-page.tsx`, `cancel-registration-dialog.tsx`, `pdf-export.ts`, `registration-columns.ts`; `pdfmake` 0.2.23 só no clique, pior rota 156,1 KB de 160). Divergências: a rota é `routes/admin/inscritos.tsx` (arquivo plano), com link "Ver inscritos" no formulário do evento e "Inscritos" na lista; do board AdminInscritos: telefone completo (o design mascarava), coluna "Responsável" (só em evento com menores) no lugar de "Menor", escolha do motivo (desistência ou LGPD) no diálogo, colunas das respostas dinâmicas pelo `form_schema`.
- [ ] T194 [US11] Rodar `load/registration-burst.js` em homologação (300 tentativas em 15 min, 250 vagas → exatamente 250), ligar `FEATURE_EVENTS` em produção na janela e registrar em `docs/runbooks/ativacao-r2.md` (E-04; SC-013)
- [ ] T195 [US11] Duas releases depois da ativação definitiva, remover a flag `FEATURE_EVENTS` de `backend/config/features.php`, do middleware e do frontend
- [X] T217 [US11] Rodar o TestSprite da US11 sobre os inscritos, como líder do ministério dono do evento:
  - `/admin/eventos/:id/inscritos`: contador "X de Y vagas preenchidas" e respostas na ordem do formulário;
  - "Exportar CSV" e "Exportar PDF" baixam o arquivo;
  - cancelar uma inscrição, com confirmação, devolve a vaga;
  - líder de outro ministério recebe 404.
  O desempenho do PDF de 500 inscritos (≤ 10 s) segue só na T191
  - Feito em 2026-10-24: 5 de 5 casos passaram (lista e contador, busca, CSV e PDF, cancelar com confirmação, 404 para líder de outro ministério). Na primeira rodada TC002 e TC003 falharam por checar o resultado antes de a busca e o PDF terminarem (o app local é lento; o E2E do Playwright, que espera, passa); refeitos com passos de espera, passaram. Relatório em `testsprite_tests/testsprite-mcp-test-report-us11.md`. Eventos e inscrições fictícios removidos; `FEATURE_EVENTS` voltou a `false`.

**Checkpoint**: **R2 no ar**. (Código e testes da fase prontos em 2026-10-24; "no ar" depende da T194, humana: k6 em homologação, ligar a flag em produção e conferir o SC-014 do PDF no computador de referência.)

---

## Phase 15: Polish & Cross-Cutting Concerns

**Purpose**: fechamento de qualidade e documentação que atravessa as histórias.

- [ ] T196 Revisar a acessibilidade à mão (teclado, NVDA e VoiceOver, zoom de 200%, `prefers-reduced-motion`) nas páginas públicas e nas telas principais do painel, e registrar os achados e as correções em `docs/runbooks/acessibilidade.md`
- [ ] T197 [P] Gerar o `CHANGELOG.md` a partir das tags CalVer e dos Conventional Commits, e manter `docs/adr/` em sincronia com o `architecture.md`
- [ ] T198 Rodar de ponta a ponta a validação de `specs/001-novo-portal-pibls/quickstart.md` num clone limpo (meta: um dev novo roda o projeto e os testes em menos de 1 h)
- [ ] T199 Fazer a revisão final de segurança antes de cada release: `composer audit`, `npm audit`, Semgrep e ZAP sem achado alto; política de CVE em dia; Actions fixadas por SHA
- [ ] T218 Rodar o TestSprite de ponta a ponta antes de cada release importante, junto com T196 a T199: reexecutar os planos das T206 a T217 com `FEATURE_EVENTS` ligada e desligada, contra o app local com dados fictícios, e anexar o resultado ao PR do release
- [ ] T200 Fazer a revisão de 6 meses (`architecture.md` → Final Recommendations, item 6): envelope de carga com dados reais, prazos de retenção aplicados, cotas dos planos gratuitos e servidor mais novo na HostGator. Registrar em `docs/adr/` se houver decisão nova

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup.
  - **T014 (PoC) é um gate**: T024 em diante só começa com a ADR-005 aceita.
  - T016 a T023 (deploy) podem correr em paralelo ao schema depois do gate.
- **US1 e US2**: dependem só da Foundational.
- **US3**: depende da Foundational. É pré-requisito das histórias com painel: **US4 a US7, US9 a US11**.
- **US4**: depende da US2 (contatos existentes) e da US3.
- **US5, US6, US7**: dependem da US3. São independentes entre si.
- **US12**: depende da Foundational (fila, deploy). Precisa estar pronta antes da US8.
- **US8 (go-live R1)**: depende de US1 a US7 e US12, e das TBD-03, 06, 08, 09 e 11.
- **US9 → US10 → US11 (R2)**: dependem da US8 (R1 no ar), da TBD-12 e, nessa ordem, uma da outra.
- **Polish**: contínuo; T196 a T199 e T218 antes de cada release importante.

### User Story Dependencies (grafo)

```text
Setup → Foundational ─┬─ US1 ──────────────────────────────┐
     (gate T014)      ├─ US2 ─────────────┐                │
                      ├─ US3 ─┬─ US4 ◄────┘                │
                      │       ├─ US5                       ├─► US8 (R1 no ar) ─► US9 ─► US10 ─► US11 (R2)
                      │       ├─ US6                       │        ▲              ▲
                      │       └─ US7                       │        │           TBD-12
                      └─ US12 ─────────────────────────────┘   TBD-03/06/08/09/11
```

### Within Each User Story

- Testes primeiro: precisam falhar antes da implementação.
- Value Objects e Policies → Actions → Controllers e rotas → telas.
- A matriz de autorização (T083) é estendida em toda história com rota de painel. Como é o mesmo arquivo, essas tarefas não são `[P]` entre si.
- História concluída = testes verdes + CI verde + validação em homologação (Definition of Done).
- Cada fase fecha com a sua task de TestSprite (T204 a T217), depois de toda a implementação (convenção em Notes).

### Parallel Opportunities

- **Setup**: T003 a T006, T009 e T010.
- **Foundational, depois do gate**:
  - deploy (T016 a T023) em paralelo ao schema (T024 a T028);
  - na base do backend, T030 a T036 e T040;
  - na base do frontend, T046 a T049 e T051 a T053.
- **Histórias**: depois da US3, as histórias **US5, US6 e US7** são independentes. Com um desenvolvedor e um agente, o paralelismo útil é **dentro** de cada história: os testes `[P]` e os arquivos `[P]`.

---

## Parallel Example: User Story 2

```bash
# Testes da US2 juntos (arquivos diferentes):
Task: "T069 Testes de feature de POST /api/public/leads em backend/tests/Feature/Leads/SubmitLeadTest.php"
Task: "T070 Testes do roteamento de notificações em backend/tests/Feature/Leads/LeadNotificationTest.php"
Task: "T071 Testes de componente dos 5 formulários em frontend/app/features/leads/__tests__/forms.test.tsx"
Task: "T072 E2E de envio dos 5 tipos em e2e/specs/leads-submit.spec.ts"

# Depois, backend e frontend em paralelo:
Task: "T073 Enums LeadType e LeadStatus em backend/app/Modules/Leads/Enums/"
Task: "T078 Schemas Zod e api.ts em frontend/app/features/leads/"
```

## Parallel Example: User Story 5

```bash
Task: "T107 BulletinAdminTest" ; Task: "T108 PublicBulletinsTest" ; Task: "T109 PalavraVivaTest"
Task: "T110 MetaInjectionTest" ; Task: "T112 drafts.test.ts" ; Task: "T113 editor.test.tsx"
Task: "T116 PublicBulletinsController" ; Task: "T120 RichTextEditor"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) e Phase 2 (Foundational), **incluindo o gate da PoC (T014)**.
2. Phase 3 (US1): site público com o conteúdo do seed.
3. **PARE e valide** em homologação: 360 px, LCP, axe, OG no WhatsApp.
4. É uma demonstração para a liderança, **não um go-live**: o site atual só sai na US8.

### Incremental Delivery (rumo ao R1)

1. US1 → US2: o público já consegue falar com a igreja (em homologação).
2. US3 → US4: a equipe atende (a métrica primária passa a ser medida).
3. US5, US6, US7: autonomia editorial e PIX.
4. US12: operação, backups e alertas.
5. US8: qualidade final, legado e **cutover** (R1 no ar).
6. US9 → US10 → US11: eventos atrás da flag, ativados por último (R2).

Cada história é validada em homologação antes da próxima, e nada quebra as anteriores (a suíte inteira roda a cada PR).

### Quem implementa

Uma pessoa com um agente de código (Etapa 2). O `/speckit.implement` pode executar fase a fase. O responsável revisa cada PR escrito pelo agente (Definition of Done).

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- `[USn]` liga a tarefa à história da spec para rastreio.
- Commit por tarefa ou grupo lógico (Conventional Commits). Deploy em produção só de segunda a quarta, das 9h às 18h.
- Toda divergência com o `architecture.md` vira ADR (ADR-019 em diante), no mesmo PR.
- **IDs estáveis**: uma tarefa acrescentada depois da geração recebe o próximo número livre, mesmo fora da ordem da fase (ex.: T201, incluída pelo `/speckit.analyze` de 2026-10-20). Nenhuma tarefa é renumerada.
- **TestSprite por fase** (T204 a T218, incluídas em 2026-10-20): cada fase termina com uma task de TestSprite, com o MCP `TestSprite` do `.mcp.json` (ver `CLAUDE.md` → TestSprite).
  - Ela roda depois de todo o resto da fase: `testsprite_bootstrap`, o plano de frontend e/ou de backend, `testsprite_generate_code_and_execute` e a conferência em `testsprite_open_test_result_dashboard`.
  - Roda contra o app local com dados fictícios, nunca contra produção nem com dado pessoal real. Os usuários vêm do `LocalDevelopmentSeeder` (senha em `TEST_USERS_PASSWORD`, que não se registra no repositório).
  - Complementa Pest, Vitest e Playwright + axe; não os substitui, nem a regra de BR com id no nome do teste.
  - O *Checkpoint* da fase só fecha com o plano passando. Se falhar, corrija e rode de novo, ou relate a falha no PR para o responsável decidir.
  - Fora do fim da fase por razão de ordem: na Fase 11 ela vem antes da T164 (a conferência de prontidão usa o resultado) e na Fase 15, depois da T199 (T200 é a revisão de 6 meses).
- **Total**: 218 tarefas. Setup 12 · Foundational 44 · US1 15 · US2 13 · US3 17 · US4 11 · US5 17 · US6 11 · US7 11 · US12 15 · US8 14 · US9 13 · US10 10 · US11 9 · Polish 6.
