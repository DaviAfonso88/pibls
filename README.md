# Portal PIBLS

Portal da Primeira Igreja Batista em Lagoa Santa: site público pré-renderizado, painel administrativo e operação sem custo extra, tudo na hospedagem compartilhada HostGator.

O **como** está em [`docs/architecture.md`](docs/architecture.md) e prevalece sobre qualquer outro documento. Os princípios não negociáveis estão em [`.specify/memory/constitution.md`](.specify/memory/constitution.md). Para trabalhar com o agente de código, leia [`CLAUDE.md`](CLAUDE.md).

## Estrutura

```text
frontend/   React Router 7 (ssr:false + prerender), TypeScript strict
backend/    Laravel 13 (monolito modular), PHP 8.4
deploy/     finalize.php, htaccess/, templates/ (ativador de releases)
e2e/        Playwright + axe
load/       k6
docs/       architecture.md, adr/, runbooks/, manual-do-painel/
specs/      Spec Kit (spec, plan, data-model, contracts, tasks)
docker/     Dockerfile do PHP/Apache e init do MySQL (ambiente local)
```

## Pré-requisitos (só na máquina de desenvolvimento)

| Ferramenta | Versão |
|---|---|
| Docker + Docker Compose | atual |
| Node.js | 24 LTS (só local e CI; **não existe no servidor**) |
| Git | atual |

PHP e Composer **não** precisam estar instalados: rodam dentro do container `app`.

## Como rodar

```bash
# Apache + PHP 8.4 sem OPcache, MySQL 8.0 e Mailpit
docker compose up -d
# MySQL 5.7, para reproduzir a outra versão possível do servidor (TBD-01)
docker compose --profile mysql57 up -d mysql57

# Backend
cp backend/.env.example backend/.env
docker compose exec app composer install
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate

# Frontend
cd frontend && npm ci && npm run dev
```

| Endereço | O quê |
|---|---|
| http://localhost:5173 | SPA em desenvolvimento (Vite) |
| http://localhost:8080 | Laravel pelo Apache do container |
| http://localhost:8025 | Mailpit (todos os e-mails locais) |
| `127.0.0.1:3316` | MySQL 8.0 (usuário `pibls_app`, senha `secret`, banco `pibls`) |
| `127.0.0.1:3317` | MySQL 5.7 (perfil `mysql57`) |

A porta 3306 do host fica livre para um MySQL instalado na máquina. Dentro do Docker o banco é sempre `mysql:3306`.

## Testes

```bash
# Backend: Pint, Larastan (nível 6) e Pest contra MySQL real
docker compose exec app ./vendor/bin/pint --test
docker compose exec app ./vendor/bin/phpstan analyse
docker compose exec app ./vendor/bin/pest
docker compose exec -e DB_HOST=mysql57 app ./vendor/bin/pest   # mesma suíte no MySQL 5.7

# Frontend
cd frontend && npm run typecheck && npm run lint && npm run format:check
npm run test -- --coverage && npm run build

# E2E + acessibilidade (a partir da US1)
cd e2e && npx playwright test
```

Todo teste de regra de negócio leva o id no nome: `it('BR-021 recusa inscrição quando as vagas acabaram')`.

## Versões fixadas

A fonte de verdade é o `composer.lock` e os `package-lock.json`, versionados. Esta tabela registra o que a Fase 1 fixou, dentro das linhas de versão da Technology Stack do `architecture.md`. O restante da stack (Sanctum, HTMLPurifier, TanStack Query, Tailwind, shadcn/ui, TipTap…) entra, e é registrado aqui, junto com a task que o instala.

| Componente | Linha da stack | Fixado em 2026-10-20 |
|---|---|---|
| PHP (`config.platform.php`) | 8.4.x | 8.4 (container: 8.4.26) |
| Laravel | 13.x | 13.38.0 |
| Pest + plugin Laravel | 3.x ou 4.x | 4.7.8 / 4.1.0 |
| Larastan | 3.x | 3.13.0 |
| Laravel Pint | 1.x | 1.32.1 |
| Composer | 2.x | 2.10.3 |
| Node.js | 24 LTS | 24.14.1 |
| TypeScript | 5.9.x | 5.9.3 |
| React / React DOM | 19.x | 19.3.1 |
| React Router (`@react-router/dev`, `/node`) | 7.x | 7.18.4 |
| Vite | exigido pelo `@react-router/dev` 7.x | 7.3.7 |
| ESLint / `@eslint/js` | 9 | 9.39.5 |
| typescript-eslint | — | 8.72.0 |
| Prettier | 3.x | 3.9.10 |
| Vitest / `@vitest/coverage-v8` | 3.x | 3.2.7 |
| Testing Library (react / dom / user-event) | — | 16.3.3 / 10.4.2 / 14.6.8 |
| MSW | 2.x | 2.15.0 |
| Playwright / `@axe-core/playwright` | 1.x | 1.64.1 / 4.14.0 |
| MySQL (local) | 5.7.8+ e 8.0 | 5.7.44 e 8.0.46 |

Acrescentos fora da lista literal da stack, necessários para as ferramentas listadas funcionarem: `eslint-import-resolver-typescript` (resolve o alias `~` no `import/no-restricted-paths`), `jsdom` e `@testing-library/jest-dom` (ambiente e matchers do Vitest + Testing Library) e `isbot` (exigido pela entrada de servidor padrão do React Router usada no prerender).

## Pendências conhecidas

- **Desempenho local:** sem OPcache (igual à HostGator, ADR-005) e com o código num bind mount do Windows, cada requisição ao Laravel leva cerca de 3 s no Docker. Não reflete a produção.
- **Vitest 3.x:** `npm audit` aponta 4 avisos em dependências de desenvolvimento (`tinypool` e `@vitest/mocker`). O CI audita só dependências de produção (`--omit=dev`) e nada disso vai para o servidor. A correção exige o Vitest 5, fora da linha 3.x da stack, e portanto uma ADR.
- **Proxy do Vite** para `/api`, `/sanctum`, `/data` e `/uploads` (previsto no quickstart) ainda não existe e nenhuma task do `tasks.md` o cobre.
- **Branch protection e 2FA do GitHub (T011):** são configurações do GitHub e ficam com o responsável. Ver `docs/runbooks/setup-hospedagem.md`.
