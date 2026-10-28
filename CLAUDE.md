# pibls Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-10-20

## Active Technologies

- PHP 8.4 (backend); TypeScript 5.9 strict (frontend); Node.js 24 LTS só no CI e local + Laravel 13, Sanctum 4, HTMLPurifier 4, intervention/image 3; React 19, React Router 7 (framework mode), Vite, TanStack Query 5, React Hook Form 7 + Zod 4, Tailwind CSS 4 + shadcn/ui (Base UI), TipTap 3, pdfmake 0.2 (001-novo-portal-pibls)

## Project Structure

```text
frontend/   # React Router 7 (ssr:false + prerender), app/{routes,features,shared,content}
backend/    # Laravel 13, app/Modules/{Access,Ministries,Content,Leads,Events,Platform}
deploy/     # finalize.php, htaccess/, templates/
e2e/        # Playwright
load/       # k6
docs/       # adr/, runbooks/, manual-do-painel/
specs/      # Spec Kit (spec, plan, research, data-model, contracts, tasks)
```

## Commands

```bash
docker compose up -d                                   # Apache + PHP 8.4 sem OPcache, MySQL 8.0, Mailpit
docker compose exec app ./vendor/bin/pest              # backend (unit, feature com MySQL real, arch)
docker compose exec app ./vendor/bin/pint --test && docker compose exec app ./vendor/bin/phpstan analyse
cd frontend && npm run typecheck && npm run lint && npm run test && npm run build && npm run bundle:check
cd e2e && npx playwright test                          # E2E + axe
```

## Code Style

PHP: Pint (preset laravel) + Larastan nível 6. TS: ESLint (typescript-eslint strict, jsx-a11y, import/no-restricted-paths) + Prettier. Conventional Commits.

## Recent Changes

- 001-novo-portal-pibls: Added PHP 8.4 (backend); TypeScript 5.9 strict (frontend); Node.js 24 LTS só no CI e local + Laravel 13, Sanctum 4, HTMLPurifier 4, intervention/image 3; React 19, React Router 7 (framework mode), Vite, TanStack Query 5, React Hook Form 7 + Zod 4, Tailwind CSS 4 + shadcn/ui (Base UI), TipTap 3, pdfmake 0.2

<!-- MANUAL ADDITIONS START -->
## Documentos-fonte (leia antes de codar)

- `architecture.md` define o **como** e prevalece sobre qualquer outro documento. Mudança de decisão só com ADR nova (ADR-019 em diante), no mesmo PR.
- `.specify/memory/constitution.md` traz os princípios não negociáveis.
- `specs/001-novo-portal-pibls/` reúne `spec.md` (o quê), `plan.md`, `data-model.md`, `contracts/` e `tasks.md`.
- `to-be-determined.md` lista as pendências. Não trate uma TBD como resolvida.

## Ferramentas do projeto (MCP e skills)

- `.mcp.json` declara os MCPs `context7` e `TestSprite` e não contém segredo. As keys ficam em `.claude/settings.local.json` (`CONTEXT7_API_KEY`, `TESTSPRITE_API_KEY`), que **nunca** vai para o git.

### Context7: sempre, antes de implementar

- Antes de instalar, configurar, atualizar ou escrever código com qualquer biblioteca da stack (Laravel 13, Sanctum, React 19, React Router 7, TanStack Query 5, React Hook Form, Zod 4, Tailwind 4, shadcn/ui + Base UI, TipTap 3, pdfmake, intervention/image, HTMLPurifier, Pest, Vite, Playwright), consulte o Context7: `resolve-library-id` e depois `query-docs`. Não escreva API de memória; várias versões da stack são recentes e mudaram.
- Use o ID da biblioteca com a versão que o projeto usa, quando houver. Se a doc marcar uma API como *deprecated*, use a substituta e avise.
- Manter o sistema atualizado não é subir versão por conta própria: versão da stack só muda com ADR. Se o Context7 mostrar versão mais nova ou correção de segurança, registre como sugestão no resumo da task.
- `architecture.md` e as regras abaixo prevalecem sobre qualquer exemplo do Context7.
- Nunca ponha PII, segredo ou código proprietário numa consulta.

### Skills obrigatórias no frontend

- **Web design:** em toda tela ou componente novo ou alterado, use a skill `web-design-guidelines` antes de codar a UI e ao revisá-la (acessibilidade, UX, conformidade com as Web Interface Guidelines).
- **TypeScript:** o código segue `strict` e o `typescript-eslint` strict. Sem `any`, `@ts-ignore` ou `as` para calar erro sem justificativa. Consulte a doc do TypeScript 5.9 no Context7. Ainda não há skill de TypeScript instalada; quando houver, passa a ser obrigatória aqui.

## Design (fonte visual)

O visual das telas vem do canvas **Portal PIBLS — Páginas**: https://claude.ai/artifact/S25DPVoxB7SvWEUiBS88cQ#page-cfce4dfb9d8c

- Leia com a ferramenta `Artifact` (`action: "read"`, `paths: ["project/<Tela>.dc.html"]`; o índice é `project/canvas.json`), não com WebFetch. É um mock em HTML: valem layout, hierarquia, estados, textos e acessibilidade, não o código dele.
- Antes de implementar uma tela, abra o board dela e siga-o. Se o design conflitar com `architecture.md` ou com as regras deste arquivo, a arquitetura prevalece; registre a divergência no resumo da task.
- Textos entre colchetes (`[TÍTULO DO BOLETIM]`, `[FOTO DO TEMPLO…]`) são espaços reservados: o conteúdo vem da API ou do conteúdo versionado, nunca fixo no componente.
- Boards marcados `(R2)` são da segunda release. Confirme em `spec.md` e `tasks.md` antes de implementar.
- **Site público** (mobile-first, 390px): `Main` (Início), `ComoChegar`, `QuemSomos`, `Ministerios`, `Grupos`, `Boletins`, `PalavraViva`, `Mensagem`, `Contribua`, `Eventos` (R2), `Evento` (R2), `SouVisitante`, `QueroSerMembro`, `PedidoOracao`, `Contato`, `Privacidade`, `NaoEncontrado`.
- **Painel** (desktop, 1280px): `AdminEntrar`, `AdminInicio`, `AdminContatos`, `AdminContato`, `AdminBoletins`, `AdminBoletim`, `AdminPalavraViva`, `AdminPix`, `AdminConfiguracoes`, `AdminMinisterios`, `AdminEvento` (R2), `AdminInscritos` (R2), `AdminUsuarios`.
- **Componentes compartilhados:** `SiteHeader`, `SiteFooter`, `AdminNav`.

Valores extraídos do board `Main`; confira nos demais. **A cor da marca vem do Manual da Marca PIBLS (TBD-10), que prevalece sobre o azul-marinho do canvas** (o mock ainda usa `#1E3A8A`; ignore-o nesse ponto):

- **Cor:** texto `#1C1917`, texto secundário `#57534E`, fundo de seção `#EAF3F5` (gelo da marca), borda `#E7E5E4`, borda de botão secundário `#A8A29E`, primária `#2A6C82` (hover `#043546`), foco `#00879D`, info `#EAF3F5`/`#59ACBF` com texto `#043546`, rodapé `#043546`, aviso `#FEF3C7`/`#78350F`, destaque da campanha `#FBBF24` sobre `#1C1917`, WhatsApp `#166534`. Paleta secundária do manual (`#823D34`, `#4B7B2F`, `#7E335A`, `#816438`) só em evento especial, não entra no tema. `#00879D`, `#59ACBF` e `#6AC5D6` não servem para texto nem para botão com letra branca (contraste abaixo de 4,5:1).
- **Tipografia:** pilha de sistema (`system-ui`…), sem fonte de CDN. Corpo 17px/1.55; títulos em peso 800 (h1 34px, h2 24px, h3 20–22px); *eyebrow* 13–14px em caixa-alta.
- **Forma e acessibilidade:** raio de 12px nos botões e 14–16px nos cards; container de até 1120px com 16px de margem lateral; botões com 48px ou mais de altura e alvos de toque de pelo menos 44px; foco visível com *outline* de 3px; ícones SVG de traço (2px, pontas arredondadas).
- **Logos, ícones e fotos:** os originais ficam em `frontend/assets-src/` (nunca em `public/`: são 34 MB). `python -I frontend/scripts/optimize-images.py` gera o que o site serve: `public/logos/` (recortados), favicon e ícones, e `public/images/*.webp` em 4 larguras. O site usa `BrandSymbol` (`~/shared/ui/brand-logo`, o símbolo no cabeçalho e no rodapé; o painel usa o logo horizontal em `<img>` próprio) e `Photo` (`~/shared/ui/photo`), com o texto alternativo de cada foto em `~/content/photos.ts`. Foto nova passa pelo script; a imagem Open Graph sai de `scripts/og-default.html`.
- **Como aplicar:** transforme esses valores em tokens semânticos do tema do Tailwind (`primary`, `foreground`, `muted-foreground`, `border`, `ring`, `warning`…). Nenhum hex solto nos componentes.

## Regras que não podem ser quebradas

- **Servidor sem Node.js, SSH ou OPcache.** Nada roda no servidor fora de requisição HTTP ou cron. Build só no CI ou, enquanto o deploy pelo GitHub Actions não estiver disponível, na máquina do responsável por `deploy/empacotar-local.sh` (ADR-024). Nunca no servidor.
- **Nunca** escrever em `users` (fora de senha e datas de login), `user_permissions`, `permissions` ou `role_templates` (BR-077).
- **Nunca** logar dado pessoal (corpo de requisição, telefone, e-mail do público, campos 🔒) nem mandar PII ao Sentry.
- **Nunca** expor `private_address`, `contact_email` ou `notification_recipients` na API pública ou nos snapshots (BR-048, BR-050).
- `dangerouslySetInnerHTML` só em campos `SanitizedHtml` (`body`, `description`).
- E-mail **só pela fila**, gravada na mesma transação, nunca síncrono na requisição.
- Autorização sempre no servidor, por `permission_key`. Fora do escopo, a resposta é 404.
- UI só com Tailwind 4 + componentes de `~/shared/ui` (shadcn/ui, Base UI). Só tokens semânticos, classes literais, nenhuma fonte de CDN.
- Schema compatível com MySQL 5.7.8+ e 8.0 (sem CTE, *window functions* ou índice funcional). Migrations *expand/contract*.
- `shared/drafts` (rascunho local) só em `features/content` e `features/events`. Nunca em dados pessoais.

## Backend (Laravel)

- Fluxo: Controller fino → Form Request → **Action** (um caso de uso por classe) → Model/Policy. As BRs ficam em Actions, Value Objects e Policies.
- Um módulo só depende de outro se o Domain Model permitir. `Platform` não depende de módulos de negócio (Pest `arch()`).
- Erros no envelope `{error:{code,message,details,traceId}}`. Os 409 usam os códigos de API Standards.

## Testes

- Teste nunca é opcional: entra no mesmo PR do código.
- Toda BR tem teste com o id no nome, ex.: `it('BR-021 recusa inscrição quando as vagas acabaram')`.
- Toda rota tem teste de feature por papel de referência × rota.
- Feature tests com MySQL real; o banco não é *mockado*.
- Cobertura: backend ≥ 80% (Actions, Policies, ValueObjects, Enums); frontend ≥ 70% (`features/`, `shared/`).

### TestSprite: no fim de cada fase

- Cada fase de `specs/001-novo-portal-pibls/tasks.md` termina com uma task própria de TestSprite (T204 a T218). Rode-a depois de toda a implementação da fase e de Pest/Pint/PHPStan ou typecheck/lint/test/build passarem. Com o MCP `TestSprite`: `testsprite_bootstrap`, o plano de teste de frontend e/ou de backend conforme o caso e `testsprite_generate_code_and_execute`. Confira o resultado em `testsprite_open_test_result_dashboard`. A convenção completa está em `tasks.md` → Notes.
- O último passo do fluxo (`testsprite_generate_code_and_execute`) **não executa nada**: devolve um comando de terminal, `node …\@testsprite\testsprite-mcp\dist\index.js generateCodeAndExecute`, a rodar na raiz do projeto com `API_KEY` no ambiente (o valor de `TESTSPRITE_API_KEY`). Ele grava `testsprite_tests/tmp/test_results.json` e `raw_report.md` e depois **fica ativo por 1 hora**: ao ver "Test execution completed", encerre o processo. Antes, deixe o app no ar (Vite em 5173 ou o Apache em 8080) e limite os casos com `testIds`. O `bootstrap` e o `code_summary.yaml` valem para um tipo por vez (frontend ou backend): troque entre os dois.
- Custo medido na T204: cerca de 0,3 crédito por caso executado.
- Tasks isoladas **não** rodam o TestSprite; só a task de fim de fase. Quem encerra uma task segue com Pest, Vitest e Playwright.
- O *Checkpoint* da fase só fecha com o TestSprite passando. Se falhar, corrija e rode de novo, ou relate a falha no resumo. Nunca marque a fase como concluída com teste vermelho.
- Complementa Pest, Vitest e Playwright + axe; não os substitui, nem a regra de BR com id no nome do teste.
- Rode contra o app local (Docker ou dev) com dados fictícios. Nunca contra produção nem com dado pessoal real.
- Gasta créditos do plano Free: veja o saldo com `testsprite_check_account_info`. Sem crédito, pare e avise; não pule a etapa em silêncio.
<!-- MANUAL ADDITIONS END -->
