# Implementation Plan: Novo Portal PIBLS

**Branch**: `001-novo-portal-pibls` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-novo-portal-pibls/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

> **Regra deste plano**: ele **segue** o `architecture.md` (documento-fonte do "como"). Detalha a ordem, os artefatos e os pontos de integração, mas **não redecide**. Cada decisão aqui aponta para a ADR ou a seção de origem. Em caso de divergência, vale o `architecture.md` (Constituição, Princípio I).

## Summary

O portal substitui o site WordPress atual por três coisas:

- um site público pré-renderizado, rápido no celular e indexável;
- um painel administrativo para os voluntários, com autorização por permissão;
- uma camada de operação sem custo: fila de e-mail, backups externos cifrados, alertas e deploy sem SSH.

Tudo roda na hospedagem compartilhada HostGator já contratada.

**Abordagem técnica** (de `architecture.md`):

- **Backend**: monolito modular Laravel 13 / PHP 8.4, com os módulos Access, Ministries, Content, Leads, Events e Platform (ADR-001, ADR-002).
- **Frontend**: uma única SPA React 19 + React Router 7 em *framework mode*, com `ssr:false` + `prerender` (ADR-004, ADR-013).
- **Comunicação**: REST/JSON na mesma origem, com sessão Sanctum por cookie (ADR-008).
- **Leituras públicas quentes**: snapshots JSON estáticos servidos pelo Apache, sem PHP (ADR-014).
- **E-mail**: fila no MySQL, processada pelo cron a cada 5 min (ADR-003).
- **Deploy**: releases imutáveis enviadas por FTPS e ativadas pelo `finalize.php` no cron (ADR-010).

O R1 (Histórias 1 a 8 e 12) vai ao ar com o módulo de eventos desligado (`FEATURE_EVENTS=false`). O R2 (Histórias 9 a 11) ativa os eventos sem migração de dados.

**Gate de entrada**: a PoC de desempenho (F0-03, TBD-05) precisa mostrar p95 ≤ 500 ms sem OPcache antes de começar o schema e os módulos. Se falhar, abre-se uma ADR nova (plano B: Slim 4) antes de qualquer módulo.

## Technical Context

**Language/Version**: PHP 8.4 (backend); TypeScript 5.9 strict (frontend); Node.js 24 LTS só no CI e local
**Primary Dependencies**: Laravel 13, Sanctum 4, HTMLPurifier 4, intervention/image 3; React 19, React Router 7 (framework mode), Vite, TanStack Query 5, React Hook Form 7 + Zod 4, Tailwind CSS 4 + shadcn/ui (Base UI), TipTap 3, pdfmake 0.2
**Storage**: MySQL 5.7.8+ e 8.0 (InnoDB, utf8mb4, UTC); disco da conta para uploads e snapshots JSON; Backblaze B2 só para backups cifrados
**Testing**: Pest 3/4 (unit, feature com MySQL real, arch), Vitest 3 + Testing Library + MSW 2, Playwright + axe, Lighthouse CI, k6, Semgrep CE, OWASP ZAP
**Target Platform**: HostGator compartilhada (Apache 2 + mod_rewrite + mod_security, PHP 8.4 sem OPcache, cron do cPanel); navegadores Safari/iOS 16.4+, Chrome/Edge 111+, Firefox 128+, Samsung Internet
**Project Type**: web application (monorepo frontend + backend + deploy)
**Performance Goals**: LCP ≤ 2,5 s (p75, 4G); API p95 ≤ 800 ms leitura e ≤ 1,5 s escrita; 100 usuários simultâneos; 300 inscrições/hora; PDF de 500 inscritos ≤ 10 s
**Constraints**: sem Node.js, SSH, OPcache, Redis ou processo residente no servidor; custo adicional zero; DNS de e-mail intocado; JS inicial público ≤ 150 KB gzip e CSS ≤ 40 KB gzip; RTO ≤ 4 h e RPO ≤ 1 h; deploy de segunda a quarta, 9h–18h
**Scale/Scope**: igreja de 200+ membros; 6 módulos; 17 rotas públicas e 14 do painel; 14 permissões; 7 papéis de referência; 13 tabelas de domínio; horizonte de 5+ anos

Nenhum item ficou como NEEDS CLARIFICATION: as incógnitas de ambiente (versão do MySQL, limites da conta, intervalo do cron) estão em `to-be-determined.md` (TBD-01, 02, 04) e são resolvidas pela tarefa F0-02, sem bloquear o desenho. Ver `research.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano cumpre | Status |
|---|---|---|
| I. Documentos-fonte e hierarquia | Spec usa o PRD como contexto; o plano cita a ADR ou a seção de origem de cada decisão. Os dois detalhamentos novos do `/speckit.clarify` (rascunho local em FR-077 e medição sem cookies em FR-076) não contradizem nenhuma ADR e foram registrados no `architecture.md` (Frontend → Formulários e TBD-09) | ✅ |
| II. Hospedagem e custo zero | Só a conta HostGator; build, pré-renderização e Tailwind no CI; e-mail pelo SMTP da conta; B2, Sentry, UptimeRobot e Healthchecks em plano gratuito (TBD-07); DNS de e-mail intocado (G-01) | ✅ |
| III. Monolito modular | 6 módulos no backend, uma SPA; Controllers → Form Request → Action; Pest `arch()` e ESLint `import/no-restricted-paths` desde a F0-07/F0-08; BR-077 com teste de arquitetura | ✅ |
| IV. Privacidade e segurança | Consentimento versionado; campos 🔒 cifrados (ADR-016); oração isolada (BR-007); BR-048 com teste; CSRF em toda escrita; uploads por MIME real; PIX com reconfirmação + alerta; rascunho local **só** em formulários de conteúdo público (FR-077) | ✅ |
| V. Testes e portões | Toda tarefa de implementação tem a tarefa de teste correspondente; toda BR com id no nome do teste; matriz papel × rota; MySQL 5.7 e 8.0 no CI; concorrência de vagas antes do R2 | ✅ |
| VI. Acessível, mobile-first, pt-BR, UI | WCAG 2.1 AA com axe bloqueante; 360 px; só Tailwind 4 + shadcn/ui; tokens semânticos; pt-BR e `America/Sao_Paulo`; orçamento de bundle no CI | ✅ |
| VII. Simplicidade e operação | Nenhuma dependência fora da Technology Stack; runbooks antes do go-live; rollback ≤ 10 min ensaiado; restauração de backup testada | ✅ |

**Resultado**: passa sem violações. *Complexity Tracking* fica vazio.

**Re-check após a Fase 1** (data-model, contracts, quickstart): ✅ sem mudança. O modelo de dados é o schema do `architecture.md`; os contratos seguem as convenções de API Standards; o quickstart usa o Docker Compose previsto (F0-04).

## Project Structure

### Documentation (this feature)

```text
specs/001-novo-portal-pibls/
├── plan.md              # Este arquivo (/speckit.plan)
├── research.md          # Fase 0: decisões e premissas, com origem
├── data-model.md        # Fase 1: entidades, campos, validações, estados
├── quickstart.md        # Fase 1: ambiente local e validação ponta a ponta
├── contracts/
│   ├── openapi.yaml     # Fase 1: contrato REST (público, auth, painel)
│   ├── snapshots.md     # Fase 1: formato de /data/*.json (ADR-014)
│   └── web-routes.md    # Fase 1: rotas web do Laravel (meta injetada, sitemap) e .htaccess
├── checklists/
│   ├── requirements.md  # Qualidade da spec (/speckit.specify)
│   ├── security.md      # /speckit.checklist
│   ├── ux-a11y.md       # /speckit.checklist
│   └── api.md           # /speckit.checklist
└── tasks.md             # Fase 2 (/speckit.tasks)
```

### Source Code (repository root)

Monorepo definido em `architecture.md` → Architecture → Estrutura de pastas.

```text
pibls/
├── frontend/                          # React Router 7 (framework mode, ssr:false) + Vite + TS
│   ├── app/
│   │   ├── app.css                    # Tailwind 4: tokens (:root + @theme inline), base, aviso de navegador
│   │   ├── root.tsx                   # layout raiz, providers, BrowserOutdatedNotice
│   │   ├── routes.ts                  # tabela de rotas (Frontend Architecture)
│   │   ├── routes/public/             # páginas públicas (pré-renderizadas)
│   │   ├── routes/admin/              # painel (lazy, não pré-renderizado)
│   │   ├── features/{access,ministries,content,leads,events}/
│   │   │   └── api.ts  queries.ts  schemas.ts  components/  hooks/  __tests__/
│   │   ├── shared/
│   │   │   ├── ui/                    # shadcn/ui (gerado pelo CLI) + compostos do projeto
│   │   │   ├── lib/utils.ts           # cn()
│   │   │   ├── http/                  # cliente fetch, CSRF, 419, X-Request-Id, erros
│   │   │   ├── format/                # datas, telefone, CNPJ (pt-BR, America/Sao_Paulo)
│   │   │   ├── drafts/                # rascunho local dos formulários de conteúdo (FR-077)
│   │   │   ├── messages.ts            # textos da interface (fonte: BRs)
│   │   │   └── api-types.ts           # gerado do OpenAPI
│   │   └── content/                   # conteúdo fixo: história, crenças, política
│   ├── public/  components.json  vite.config.ts  react-router.config.ts
├── backend/                           # Laravel 13
│   ├── app/Modules/{Access,Ministries,Content,Leads,Events,Platform}/
│   │   ├── Http/{Controllers,Requests,Resources}/  Actions/  Models/  Policies/
│   │   ├── DomainEvents/  Listeners/  Mail/  Enums/  ValueObjects/  routes.php
│   ├── app/Shared/                    # envelope de erro, X-Request-Id, Sanitizer, VOs comuns
│   ├── config/  lang/pt_BR/  resources/views/  routes/
│   ├── database/{migrations,data,factories,seeders}/
│   └── tests/{Unit,Feature,Arch}/<Modulo>/
├── deploy/  finalize.php  htaccess/  templates/
├── e2e/specs/                         # Playwright
├── load/                              # k6
├── docs/{adr,runbooks,manual-do-painel}/
├── .github/workflows/{ci,deploy,rollback,zap}.yml
├── docker-compose.yml
├── CLAUDE.md
└── architecture.md  to-be-determined.md  prd.md
```

**Structure Decision**: web application em monorepo, exatamente como no `architecture.md`. A única pasta acrescentada é `frontend/app/shared/drafts/`, para o rascunho local exigido pelo FR-077 (Clarificação de 2026-10-20). Ela não muda nenhuma regra de dependência: `features/*` importa de `shared/`, nunca o contrário.

## Mapa história → módulos → tarefas do backlog

| História (spec) | Módulos | Tarefas do backlog (`architecture.md`) |
|---|---|---|
| Fundação (pré-requisito de todas) | Todos | F0-01 a F0-08 |
| H3 — Acesso ao painel (P1) | Access, Platform | A-01, A-02, A-03 |
| H1 — Visitante conhece a igreja (P1) | Content, Ministries, Platform | PL-02, M-01, C-01, C-05 |
| H2 — Envio de contato (P1) | Leads, Platform | PL-01, L-01 |
| H4 — Atendimento de contatos (P1) | Leads | L-02 |
| H5 — Boletins e Palavra Viva (P2) | Content | C-02, C-03 |
| H6 — PIX (P2) | Content, Platform | C-04 |
| H7 — Dados institucionais (P2) | Content, Ministries | C-01, M-01 (painel) |
| H12 — Operação segura (P3) | Platform | PL-03, PL-04, PL-05, QA-04 |
| H8 — Troca do site (P3) | — (operação) | QA-01 a QA-03, G-01 |
| H9 a H11 — Eventos (P4, R2) | Events | E-01 a E-04 |

## Pontos de integração e decisões de detalhe

Detalhes que o `architecture.md` deixa para a implementação, decididos aqui **sem alterar** nenhuma ADR:

1. **Rascunho local (FR-077)**: `localStorage`, chave `pibls:draft:<userId>:<formulário>:<id|novo>`, gravado com *debounce* de 1 s. Validade de 7 dias. Apagado ao salvar com sucesso, ao descartar e no logout explícito. Vale só para boletim (sem o PDF), mensagem e evento (sem o banner). Atendimento, anotações, inscrições e PIX nunca usam o módulo, e uma regra de ESLint impede importar `shared/drafts` fora de `features/content` e `features/events`. Não conflita com o ADR-008, que rejeita tokens no `localStorage`, não rascunhos de conteúdo público.
2. **Boletim na tela (Clarificação 1)**: `pdf_url` aberto com `target="_blank" rel="noopener"`, mais um link de download com o atributo `download`. Nenhuma biblioteca de PDF no bundle público.
3. **Aviso da Ceia (Clarificação 2)**: `site_settings.lords_supper_notice` com `{active, text}`, como no schema. Nenhum cálculo de data.
4. **Medição de uso (FR-076)**: nenhum script de terceiros até a decisão da TBD-09. A ferramenta escolhida precisa ser sem cookies, servida pelo próprio domínio ou já permitida pela CSP. Se exigir um novo `connect-src`, a CSP é ajustada no mesmo PR.
5. **Retenção (FR-065)**: os prazos vêm do `.env` (`RETENTION_ORACAO_DAYS=60`, `RETENTION_ORACAO_UNFINISHED_DAYS=90`, `RETENTION_LEADS_MONTHS=12`, `RETENTION_REGISTRATIONS_MONTHS=3`, `RETENTION_AUDIT_MONTHS=24`), com esses padrões, conforme Data Privacy Strategy. Mudar um prazo não exige nova versão do código.
6. **Feature flag do R2**: `FEATURE_EVENTS` no `.env`, exposto em `data/settings.json` → `features.events`. Com a flag desligada:
   - as rotas `/api/admin/events*`, `/api/public/events*` e `/eventos/{slug}` respondem 404;
   - eventos saem do menu e do `sitemap.xml`. `/eventos` continua pré-renderizada (o build não conhece o `.env`), mas mostra "não encontrado" enquanto `features.events` for falso;
   - as migrations e as permissões de eventos existem desde a F0-06.

## Riscos que afetam a ordem

| Risco (`architecture.md`) | Efeito no plano |
|---|---|
| PoC sem OPcache não atingir p95 ≤ 500 ms (TBD-05) | Bloqueia F0-06 em diante. Plano B: ADR nova (Slim 4) |
| Deploy sem SSH (F0-05) | Feito antes de qualquer módulo; ensaio de 3 deploys e rollbacks em homologação |
| Limites da conta desconhecidos (TBD-02) | F0-02 primeiro; se o cron mínimo for maior que 5 min, as latências de e-mail e de ativação crescem na mesma proporção |
| LGPD (TBD-03, TBD-06) | Não bloqueiam a construção; bloqueiam o go-live (G-01) |
| Concorrência de vagas | Teste de concorrência bloqueante antes de ligar o `FEATURE_EVENTS` (E-04) |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Nenhuma violação. Tabela não aplicável.
