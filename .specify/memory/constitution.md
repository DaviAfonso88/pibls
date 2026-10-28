<!--
Sync Impact Report
- 1.0.1 (PATCH, 2026-10-20): Princípio I passa a citar "TBD-01 em diante" (entrou a TBD-12). Sem
  mudança de regra; templates sem impacto.
- Version change: (template sem versão) → 1.0.0 (primeira ratificação)
- Modified principles: n/a (todos novos)
- Added principles:
  - I. Documentos-fonte e hierarquia de decisões
  - II. Hospedagem compartilhada e custo zero (NÃO NEGOCIÁVEL)
  - III. Monolito modular com fronteiras verificadas
  - IV. Privacidade e segurança por padrão (NÃO NEGOCIÁVEL)
  - V. Regras de negócio testadas e portões de qualidade
  - VI. Acessível, mobile-first, pt-BR e com UI padronizada
  - VII. Simplicidade, longevidade e operação por uma pessoa
- Added sections: Restrições Técnicas e Padrões; Fluxo de Desenvolvimento e Portões de Qualidade; Governance
- Removed sections: nenhuma
- Templates:
  - ✅ .specify/templates/plan-template.md — "Constitution Check" é genérico e lê este arquivo; sem alteração
  - ✅ .specify/templates/spec-template.md — seções obrigatórias compatíveis; sem alteração
  - ⚠ .specify/templates/tasks-template.md — marca testes como OPCIONAIS; neste projeto o Princípio V
    torna os testes obrigatórios. Template mantido (é sobrescrito em upgrades do Spec Kit); o
    /speckit.tasks deste projeto inclui sempre as tarefas de teste
  - ✅ .claude/commands/speckit.*.md — sem referências a princípios antigos
- Follow-up TODOs: nenhum
-->

# Constituição do Novo Portal PIBLS

## Core Principles

### I. Documentos-fonte e hierarquia de decisões

- `prd.md` define **o quê e por quê**. `architecture.md` define **como**: arquitetura, dados, APIs,
  segurança, infraestrutura, requisitos não funcionais e ADRs.
- `/speckit.specify` usa o PRD como **contexto**, não como cópia. `/speckit.plan` **segue** o
  `architecture.md`: detalha, não redecide.
- Se um `spec.md`, `plan.md` ou `tasks.md` divergir do `architecture.md`, vale o `architecture.md`.
  A mudança só passa a valer com uma ADR nova (ADR-019 em diante), registrada no mesmo PR que
  atualiza o `architecture.md`.
- As decisões caras de reverter só mudam por ADR nova: framework (ADR-005), React Router em
  *framework mode* (ADR-004), modelo de releases (ADR-010) e cifragem de campos (ADR-016).
- Pendências (TBD-01 em diante) ficam em `to-be-determined.md`. Nenhum artefato as trata como
  resolvidas sem registro ali.

**Rationale**: um só lugar para cada tipo de decisão evita que o código siga um documento
desatualizado. Com uma pessoa só no time, não há revisor para pegar a divergência depois.

### II. Hospedagem compartilhada e custo zero (NÃO NEGOCIÁVEL)

- **Ambiente de produção**: só a conta HostGator compartilhada já contratada.
  - Apache, PHP 8.4 e MySQL 5.7.8+ ou 8.0.
  - Sem Node.js, SSH, OPcache, processo residente, Redis, broker ou fila externa.
- No servidor, o código roda só de duas formas: por **requisição HTTP** ou por **cron**. Build,
  pré-renderização, Tailwind CSS e geração de tipos acontecem **só no CI**.
- **Nenhum serviço pago.** Serviço externo só em plano gratuito, com as condições confirmadas na
  adesão (TBD-07).
- **Nunca** alterar nameservers nem os registros MX, SPF, DKIM e DMARC. O e-mail institucional
  não pode ser interrompido.
- Em qualquer dúvida de versão ou compatibilidade, a referência é a página oficial de
  compatibilidades da HostGator.

**Rationale**: custo adicional zero e preservação do e-mail são objetivos de negócio (BG-1,
BG-2). Uma solução que dependa de recurso inexistente na conta não pode ser implantada.

### III. Monolito modular com fronteiras verificadas

- **Backend**: um único Laravel, com os módulos `Access`, `Ministries`, `Content`, `Leads`,
  `Events` e `Platform`.
- **Frontend**: um único app React Router 7 para o site público e o painel. As rotas públicas são
  pré-renderizadas; o `/admin` é carregado sob demanda.
- Controllers não têm regra de negócio. Eles validam com Form Request e chamam uma Action
  (um caso de uso por classe).
- **Regras de dependência**, verificadas por Pest `arch()` e por ESLint:
  - um módulo só depende de outro se o Domain Model permitir;
  - `Platform` não depende de módulos de negócio;
  - `features/X` não importa de `features/Y`.
- A aplicação **nunca** cria usuários nem grava em `user_permissions`, `permissions` ou
  `role_templates` (BR-077). O provisionamento é feito só no phpMyAdmin.
- **Conteúdo mutável** (horários, ministérios, PIX, links) vem do banco e é editável no painel.
  **Conteúdo fixo** (história, crenças, política) fica no código (RF-D02).

**Rationale**: o time é uma pessoa com um agente de código. Uma única unidade de deploy, com
fronteiras checadas por máquina, mantém o sistema compreensível por mais de 5 anos.

### IV. Privacidade e segurança por padrão (NÃO NEGOCIÁVEL)

- **Formulários públicos**: todos exigem consentimento, gravado com data e versão da política
  (BR-001, BR-082).
- **Dados sensíveis**:
  - campos sensíveis ficam em colunas cifradas (ADR-016);
  - pedidos de oração só aparecem para `leads.oracao.*` e nunca na caixa geral (BR-007);
  - **nenhum dado pessoal** em log, Sentry, URL ou e-mail; o e-mail de oração vai sem o texto;
  - o endereço residencial das Células de CL nunca sai pela API pública (BR-048);
  - dados vencidos são excluídos pelo expurgo, conforme os prazos de retenção (TBD-03).
- **Autorização**:
  - sempre no servidor, pela `permission_key`, em toda rota administrativa (BR-076);
  - recurso fora do escopo do usuário responde 404;
  - vale o menor privilégio em todas as camadas.
- **Entrada e escrita**:
  - CSRF em toda escrita, inclusive nas rotas públicas;
  - SQL só com *bindings*;
  - HTML só sanitizado no servidor;
  - upload validado por MIME real e assinatura, gravado com nome aleatório e sem execução.
- **PIX**: alteração exige reconfirmação de senha, gera auditoria e dispara alerta para
  destinatários fora do alcance do painel (BR-060 a BR-063).
- **Segredos** ficam fora de `public_html`. Backups saem cifrados com chave pública (ADR-011).

**Rationale**: pedidos de oração e fichas de visitante revelam convicção religiosa (LGPD, art. 11),
e inscrições podem envolver menores (art. 14). Um vazamento fere pessoas, não só dados.

### V. Regras de negócio testadas e portões de qualidade

- **Uma tarefa só termina com os testes exigidos**, no mesmo PR do código. Teste nunca é
  opcional neste projeto.
- **Toda BR-\*** tem pelo menos um teste com o id no nome (ex.:
  `it('BR-021 recusa inscrição quando as vagas acabaram')`.
- **Toda rota** tem teste de feature com cada papel de referência × rota (matriz de autorização).
- **Testes de feature** usam MySQL real, nas versões 5.7 e 8.0. Banco não é *mockado*.
- **Bloqueiam o CI**: unit, feature, arch, lint e tipos, auditoria de dependências, Semgrep, axe,
  orçamento de bundle e divergência de contrato OpenAPI.
- **Cobertura mínima**:
  - backend: 80% de linhas em `Actions`, `Policies`, `ValueObjects` e `Enums`;
  - frontend: 70% de linhas em `app/features` e `app/shared`.
- **Concorrência**: a garantia de vagas e de não duplicidade (BR-021, BR-022) é testada com envios
  simultâneos antes de ativar o R2.

**Rationale**: sem QA e sem segundo revisor, o teste automatizado é a única rede de proteção. O id
da BR no nome do teste torna a rastreabilidade verificável.

### VI. Acessível, mobile-first, pt-BR e com UI padronizada

- **Acessibilidade**: WCAG 2.1 AA no site e no painel. O axe não pode acusar violação *serious* ou
  *critical*.
- **Layout e navegadores**: funcional a partir de 360 px. O piso de navegadores é o do
  Tailwind CSS 4, com aviso para quem estiver abaixo.
- **Idioma e fuso**:
  - interface, e-mails e mensagens de erro **só em pt-BR**;
  - identificadores de código em inglês; valores de enum e chaves de permissão em português,
    conforme o glossário;
  - datas gravadas em UTC e exibidas em `America/Sao_Paulo`.
- **UI** (ADR-018):
  - só **Tailwind CSS 4** e **shadcn/ui** (base Base UI);
  - só tokens semânticos;
  - nenhuma outra biblioteca de componentes ou de CSS-in-JS;
  - nenhuma fonte carregada de CDN.
- **Desempenho**:
  - LCP ≤ 2,5 s (p75, celular 4G);
  - JS inicial público ≤ 150 KB gzip; CSS ≤ 40 KB gzip;
  - leituras públicas frequentes servidas por snapshots JSON estáticos (ADR-014).

**Rationale**: o público inclui idosos e chega pelo celular. O painel é operado por voluntários
sem formação técnica.

### VII. Simplicidade, longevidade e operação por uma pessoa

- **Horizonte de mais de 5 anos**:
  - poucas dependências; cada dependência nova é justificada no PR;
  - versões com suporte longo;
  - lockfiles versionados.
- **YAGNI**: nada de microsserviços, broker, CQRS, Saga, multi-região ou infraestrutura como
  código.
- **Operação**:
  - tudo que é operacional é automatizado ou fica num runbook em pt-BR simples;
  - deploy e rollback reproduzíveis, com rollback em até 10 min;
  - backup restaurado em teste periódico;
  - kit de contingência entregue à liderança.
- **Observabilidade** só com serviços gratuitos: Sentry, UptimeRobot, Healthchecks.io e resumo
  diário por e-mail. Toda falha externa tem comportamento definido.

**Rationale**: o fator ônibus é 1 e o RTO é ≤ 4 h, inclusive aos domingos. Isso só se sustenta
com sistema simples, alertas automáticos e procedimentos escritos.

## Restrições Técnicas e Padrões

| Camada | Padrão obrigatório |
|---|---|
| Frontend | React 19; React Router 7 (*framework mode*, `ssr:false` + `prerender`); Vite; TypeScript 5.9 `strict`; TanStack Query 5; React Hook Form 7 + Zod 4; Tailwind CSS 4 + shadcn/ui (Base UI); TipTap 3 (restrito); pdfmake (sob demanda) |
| Backend | PHP 8.4; Laravel 13 (ADR-005 em "Proposta" até a PoC TBD-05 com p95 ≤ 500 ms; plano B: Slim 4); Sanctum SPA (sessão por cookie); HTMLPurifier; intervention/image (GD) |
| Dados | MySQL 5.7.8+ e 8.0 com o mesmo schema (ADR-007); `utf8mb4`; datas em UTC; migrations *expand/contract*; dados obrigatórios por migration |
| API | REST + JSON na mesma origem; envelope `{data, meta}`; erro `{error:{code,message,details,traceId}}`; sem versão na URI, com toda mudança compatível com a release anterior; OpenAPI 3.1 gerado do código |
| E-mail | Fila no MySQL (`jobs`) gravada na mesma transação; envio só pelo worker no cron (5 min); 5 tentativas; teto por execução (ADR-003) |
| Deploy | Releases imutáveis por FTPS, ativadas pelo `finalize.php` no cron, com troca atômica de `current.php` (ADR-010); front controller em `public_html/index.php` (ADR-006) |
| Metas | API p95 ≤ 800 ms (leitura) e ≤ 1,5 s (escrita); envelope de 100 usuários simultâneos e 300 inscrições/hora; RTO ≤ 4 h; RPO ≤ 1 h (≤ 24 h se a conta for perdida) |

## Fluxo de Desenvolvimento e Portões de Qualidade

- **Spec Kit**: PRD → `/speckit.specify` → `/speckit.clarify` → `/speckit.plan` (segue o
  `architecture.md`) → `/speckit.checklist` → `/speckit.tasks` → `/speckit.analyze` →
  `/speckit.implement`.
- **Git**: trunk-based; `main` sempre implantável e protegida (CI verde obrigatório, sem push
  direto); branches curtas com PR; Conventional Commits; versões CalVer `AAAA.MM.N`.
- **Promoção**: merge em `main` → deploy automático em homologação → E2E de fumaça → produção com
  aprovação manual.
- **Janela de produção**: só de segunda a quarta, das 9h às 18h. Congelamento de quinta 19h a
  domingo 22h, exceto hotfix justificado.
- **Gate técnico**: a PoC de desempenho (F0-03) precisa passar antes do schema e dos módulos
  (F0-06). Se falhar, abre-se uma ADR nova antes de escrever módulos.
- **Releases**: o R2 (eventos) entra atrás de `FEATURE_EVENTS`. O modelo de dados cobre R1 e R2
  desde o início (C-04).
- **Definition of Done**:
  - PR revisado;
  - testes exigidos verdes;
  - OpenAPI e tipos do frontend sem diferença;
  - axe sem violação crítica e navegação por teclado conferida;
  - auditoria das ações relevantes, sem dado pessoal em log;
  - `architecture.md`, ADR, runbook e manual do painel atualizados;
  - validado em homologação.

## Governance

- Esta constituição prevalece sobre qualquer outra prática do projeto. O `architecture.md` é a
  especificação técnica subordinada a estes princípios. Um conflito entre os dois é corrigido no
  mesmo PR, nos dois arquivos.
- **Emendas**:
  - PR que altera `.specify/memory/constitution.md`, com o Sync Impact Report atualizado;
  - aprovação do responsável pelo projeto;
  - propagação para os templates e artefatos afetados.
- **Versionamento semântico**:
  - MAJOR: remoção ou redefinição incompatível de princípio;
  - MINOR: princípio ou seção nova, ou orientação ampliada;
  - PATCH: redação e esclarecimentos.
- **Conformidade**:
  - todo PR confirma que respeita os princípios;
  - o `/speckit.analyze` trata violação de princípio como CRITICAL;
  - toda exceção é justificada em "Complexity Tracking" no `plan.md`, e as aceitas viram débito
    técnico no `architecture.md`.
- Orientação do dia a dia: `CLAUDE.md` (gerado e mantido pelo Spec Kit e pelo time) e
  `architecture.md`.

**Version**: 1.0.1 | **Ratified**: 2026-10-20 | **Last Amended**: 2026-10-20
