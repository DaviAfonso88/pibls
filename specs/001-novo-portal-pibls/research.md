# Research: Novo Portal PIBLS

**Fase 0 do `/speckit.plan`** · 2026-10-20

> Este arquivo **não faz pesquisa nova de tecnologia**. As escolhas já foram feitas e justificadas no `architecture.md` (Etapas 8 a 23, ADR-001 a ADR-018). Aqui elas são consolidadas no formato Decisão / Rationale / Alternativas, com a origem de cada uma, para quem implementa não precisar procurar. Os itens R-20 em diante são detalhes de implementação decididos neste plano, sem conflito com nenhuma ADR.

## Incógnitas do Technical Context

Nenhum campo do Technical Context ficou como NEEDS CLARIFICATION. As incógnitas de **ambiente** não mudam o desenho, mas mudam parâmetros:

| Incógnita | Onde está | Como o desenho a absorve | Resolvida por |
|---|---|---|---|
| Versão do MySQL (5.7 ou 8.0) | TBD-01 | Schema e consultas compatíveis com as duas; CI testa ambas (ADR-007) | F0-02 |
| Limites da conta: memória, processos, inodes, e-mails/hora, cron mínimo | TBD-02 | Snapshots estáticos tiram o pico do PHP; teto de 20 e-mails por execução; frequências do cron sobem se o mínimo for maior que 5 min | F0-02 |
| Desempenho do Laravel sem OPcache | TBD-05 (**bloqueante**) | PoC com p95 ≤ 500 ms antes do schema; plano B Slim 4 por ADR nova | F0-03 |
| Localização do datacenter e SLA | TBD-04 | Só afeta a Política de Privacidade (transferência internacional) | F0-02 |
| Condições dos planos gratuitos (B2, Sentry, Healthchecks, UptimeRobot) | TBD-07 | Cada serviço tem alternativa listada no Risk Register | PL-03, PL-05 |

---

## R-01 — Estilo arquitetural

- **Decisão**: monolito modular (Laravel + uma SPA), com os módulos Access, Ministries, Content, Leads, Events e Platform.
- **Rationale**: uma pessoa opera tudo; a hospedagem não tem processo residente; o horizonte é de mais de 5 anos.
- **Alternativas**: microsserviços, serverless e monolito sem módulos, todos descartados.
- **Origem**: ADR-001.

## R-02 — Organização interna do backend

- **Decisão**: Controller fino → Form Request → Action (um caso de uso por classe) → Model/Policy. As BRs ficam em Actions, Value Objects e Policies.
- **Rationale**: é o idioma do Laravel, que o responsável domina. Cada BR vira uma Action com teste próprio.
- **Alternativas**: Clean/Hexagonal, Vertical Slice puro e lógica nos Controllers, descartados.
- **Origem**: ADR-002.

## R-03 — Renderização e SEO

- **Decisão**: React Router 7 em *framework mode*, com `ssr:false` + `prerender` nas rotas públicas.
  - Os dados mutáveis são lidos em tempo de execução.
  - `/eventos/:slug` e `/palavra-viva/:slug` recebem as meta tags injetadas pelo Laravel.
  - O `sitemap.xml` é gerado pelo Laravel.
- **Rationale**: atende C-02 (SPA com pré-renderização) e BG-3 (conteúdo sem novo deploy) sem Node.js no servidor. As pré-visualizações do WhatsApp funcionam.
- **Alternativas**: SPA pura, pré-render de dados no build, SSR e plugins *headless*, descartados.
- **Origem**: ADR-004.

## R-04 — Framework PHP (gate)

- **Decisão**: Laravel 13 em PHP 8.4, **condicionado** à PoC (p95 ≤ 500 ms com 10 requisições concorrentes, sem OPcache, com `optimize` e classmap autoritativo).
- **Rationale**: é a maior produtividade para o responsável e o agente, com segurança até o 1º trimestre de 2028 (Laravel) e até 31/12/2028 (PHP).
- **Alternativas**:
  - Laravel 12: suporte termina em 02/2027;
  - Slim 4: **plano B**;
  - PHP 8.5: adiado para a janela anual de 2027.
- **Origem**: ADR-005 (Proposta), TBD-05.

## R-05 — Topologia na hospedagem

- **Decisão**:
  - front controller em `public_html/index.php`;
  - código e segredos em `/home/USUARIO/private/`;
  - `.htaccess` entrega primeiro os estáticos, depois as rotas do Laravel e, por fim, o fallback da SPA.
- **Origem**: ADR-006; Infrastructure → `.htaccess`.

## R-06 — Banco de dados

- **Decisão**:
  - MySQL 5.7.8+ e 8.0 com o mesmo schema; datas em UTC;
  - sem CTE, *window functions* ou índice funcional;
  - unicidade com exclusão lógica por coluna gerada *stored*.
- **Alternativas**: só MySQL 8.0 (versão real desconhecida) e SQLite (viola C-01), descartados.
- **Origem**: ADR-007; Database Strategy.

## R-07 — Autenticação e sessão

- **Decisão**: Sanctum SPA com cookie `HttpOnly`/`Secure`/`SameSite=Strict`, sessão no MySQL e CSRF por `XSRF-TOKEN`.
  - Inatividade: 60 min.
  - Absoluto: 12 h (middleware).
  - Senha: bcrypt custo 12, de 12 caracteres a 72 bytes, checada no HIBP (*fail-open*).
- **Alternativas**: JWT no `localStorage` e tokens pessoais, descartados.
- **Origem**: ADR-008; Security → Autenticação.

## R-08 — Autorização

- **Decisão**: um Gate por `permission_key` (14 chaves) e Policies com escopo `.own` por `ministry_id`.
  - Fora do escopo, a resposta é 404.
  - As permissões são lidas de `user_permissions`, que a aplicação nunca grava (BR-077).
  - O provisionamento é feito só no phpMyAdmin, pelo runbook.
- **Origem**: Security → Autorização; RF-D01.

## R-09 — E-mail

- **Decisão**: job gravado na tabela `jobs` na **mesma transação** da operação (*outbox*) e worker no agendador a cada 5 min.
  - Teto de 20 e-mails e 240 s por execução.
  - 5 tentativas com *backoff*, e depois `failed_jobs`.
  - Latência aceita de até cerca de 5 min.
- **Alternativas**: envio síncrono, `dispatchAfterResponse` e serviço transacional externo (exige DNS, viola BG-2), descartados.
- **Origem**: ADR-003.

## R-10 — Leituras públicas

- **Decisão**: snapshots `public_html/data/{settings,ministries,home}.json`, regenerados por evento de domínio (`PublicContentChanged`) e por agendamento a cada 5 min.
  - A gravação usa arquivo temporário + `rename`, que é atômico.
  - A SPA cai para a API se o arquivo faltar.
- **Alternativas**: cache de aplicação (ainda exige o boot do Laravel) e CDN (exige mudar os nameservers), descartados.
- **Origem**: ADR-014; Performance.

## R-11 — Exclusão

- **Decisão**:
  - exclusão lógica só em `bulletins` e `palavra_viva_posts`;
  - exclusão definitiva para contatos, inscrições e histórico;
  - ministérios e eventos só são excluídos sem dependentes.
- **Origem**: ADR-009.

## R-12 — Deploy e rollback

- **Decisão**: o CI monta um pacote com manifest SHA-256 e o envia por FTPS para `deploy/inbox`. O `finalize.php` roda no cron e:
  - valida o pacote, roda `doctor`, `migrate` e `optimize`;
  - copia o build da SPA;
  - troca `current.php` de forma atômica.
  - O rollback troca o ponteiro de volta (≤ 10 min).
- **Alternativas**: FTP direto, Git do cPanel e endpoint HTTP de migration, descartados.
- **Origem**: ADR-010; DevOps.

## R-13 — Backups

- **Decisão**: dump horário cifrado na conta (48 h) e cópia diária cifrada com chave pública (libsodium) no Backblaze B2 (UE).
  - Chave de aplicação sem permissão de exclusão.
  - Retenção de 35 dias (diários) e 12 meses (mensais).
  - Restauração testada a cada trimestre.
- **Alternativas**: Google Drive, download manual e repositório Git, descartados.
- **Origem**: ADR-011.

## R-14 — Observabilidade

- **Decisão**:
  - logs JSON em arquivo, Sentry (UE) sem PII, UptimeRobot a cada 5 min e Healthchecks.io para os *heartbeats*;
  - resumo diário por e-mail às 07:00 (com bloco mensal no dia 1);
  - `X-Request-Id` (ULID) de ponta a ponta.
- **Alternativas**: APM pago e só logs, descartados.
- **Origem**: ADR-012; Observability.

## R-15 — Interface

- **Decisão**: Tailwind CSS 4 (`@tailwindcss/vite`, configuração em `app/app.css`) e shadcn/ui inicializado com `init -b base` (Base UI, estilo `base-nova`).
  - Componentes copiados para `app/shared/ui`.
  - Só tokens semânticos e só tema claro.
  - Fonte do sistema até a TBD-10.
- **Rationale**: é obrigatório pelo C-01, acessível e atua só no build, o que é compatível com a HostGator.
- **Alternativas**: Radix (D-16), Tailwind 3.4 (plano B, RK-22), MUI/Chakra/Mantine/Ant e Bootstrap, descartados.
- **Origem**: ADR-018; Frontend → Padrão de UI.

## R-16 — Exportação de inscritos

- **Decisão**: o CSV é gerado no servidor por *streaming* (UTF-8 com BOM e `;`). O PDF é gerado no navegador com `pdfmake`, carregado sob demanda.
- **Alternativas**: dompdf no servidor (risco de memória e tempo) e impressão do navegador, descartados.
- **Origem**: ADR-015.

## R-17 — Criptografia de campos

- **Decisão**: cast `encrypted` do Laravel nos campos 🔒:
  - `leads_messages.message`;
  - `lead_activities.note`;
  - `event_registrations.answers`;
  - `ministries_groups.private_address`.
  A rotação da chave usa `APP_PREVIOUS_KEYS`.
- **Consequência aceita**: esses campos não são pesquisáveis. A busca de contatos fica em nome e telefone.
- **Origem**: ADR-016.

## R-18 — Homologação

- **Decisão**: `homolog.pibls.com` na mesma conta, com Basic Auth, `noindex`, banco e `.env` próprios. A allowlist de e-mail impede envio a pessoas reais.
- **Origem**: ADR-017.

## R-19 — Concorrência de vagas

- **Decisão**: dentro de uma transação, `SELECT … FOR UPDATE` na linha do evento, depois a contagem de inscrições e a inserção. A constraint única `(event_id, phone, participant_name_normalized)` garante a não duplicidade.
- **Teste**: envio simultâneo maior que o número de vagas, bloqueante antes de ligar o R2.
- **Origem**: Domain Model → `EventRegistration`; BR-021, BR-022; Testing Strategy.

---

## Detalhes decididos neste plano (sem conflito com ADR)

## R-20 — Rascunho local dos formulários de conteúdo (FR-077)

- **Decisão**:
  - `localStorage`, chave `pibls:draft:<userId>:<formulário>:<id|novo>`;
  - gravação com *debounce* de 1 s; validade de 7 dias;
  - apagado ao salvar, ao descartar e no logout explícito;
  - só boletim (sem o PDF), mensagem e evento (sem o banner);
  - regra de ESLint restringe quem importa `shared/drafts`.
- **Rationale**: uma mensagem de até 50.000 caracteres escrita sem salvar por mais de 60 min se perderia na expiração da sessão. São só dados de conteúdo destinado a ser público, então nenhum dado pessoal fica no navegador.
- **Alternativas**:
  - `sessionStorage`: descartado, porque se perde ao fechar a aba, que é o caso comum depois de uma sessão expirada;
  - rascunho no servidor: descartado, porque exige endpoint e tabela novos para pouco ganho;
  - aviso de sessão a expirar: complementar, não substitui o rascunho (fica como melhoria futura).
- **Registro**: `architecture.md` → Frontend → Formulários.

## R-21 — Leitura do boletim (Clarificação 1)

- **Decisão**: resumo em texto na página, "Ler boletim" abrindo o PDF numa nova aba (leitor nativo do aparelho) e "Baixar PDF" com o atributo `download`.
- **Alternativas**: leitor embutido (pdf.js), descartado por somar centenas de KB ao bundle público, contra o orçamento de 150 KB.

## R-22 — Aviso da Ceia (Clarificação 2)

- **Decisão**: manual, com `lords_supper_notice = {active, text}`, como no schema.
- **Alternativas**: data calculada (1º domingo), descartada: exceções (feriados, eventos especiais) exigiriam mais configuração do que ligar e desligar.

## R-23 — Medição de uso (FR-076)

- **Decisão**: nenhum script de terceiros até a TBD-09. A ferramenta escolhida precisa ser sem cookies e sem identificação pessoal.
- **Alternativas**: GA4, descartado (exige banner e consentimento).

## R-24 — Prazos de retenção (FR-065)

- **Decisão**: valores no `.env`, com os padrões da Data Privacy Strategy.

  | Variável | Padrão |
  |---|---|
  | `RETENTION_ORACAO_DAYS` | 60 |
  | `RETENTION_ORACAO_UNFINISHED_DAYS` | 90 |
  | `RETENTION_LEADS_MONTHS` | 12 |
  | `RETENTION_REGISTRATIONS_MONTHS` | 3 |
  | `RETENTION_AUDIT_MONTHS` | 24 |
  | `FAILED_JOBS_RETENTION_DAYS` | 30 |

- **Base de cálculo de cada prazo**:
  - contatos: `status_changed_at`;
  - inscrições: `coalesce(ends_at, starts_at)` do evento;
  - pedidos de oração nunca concluídos: `created_at`.
- **Pendência**: a aprovação da liderança é obrigatória antes do go-live (TBD-03).

## R-25 — Feature flag do R2

- **Decisão**: `FEATURE_EVENTS` no `.env`, publicado em `data/settings.json` → `features.events` e em `GET /api/public/settings`.
  - **Com a flag desligada**: as rotas de API e web de eventos respondem 404, e eventos saem do menu e do `sitemap.xml`. A página `/eventos` continua no `prerender` (o build não conhece o `.env`), mas mostra o conteúdo de "não encontrado" enquanto `features.events` for falso.
  - **Desde a F0-06**: schema e permissões de eventos já existem.
- **Remoção da flag**: duas releases depois da ativação definitiva.
- **Origem**: DevOps → Feature flags.
