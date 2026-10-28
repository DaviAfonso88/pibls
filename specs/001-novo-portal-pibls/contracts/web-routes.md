# Contrato: rotas web e entrega de HTML

> **Origem**: ADR-004, ADR-006; Infrastructure → `.htaccess`; API Standards → Rotas web do Laravel; Frontend → Tabela de rotas.

## Ordem de resolução no `.htaccess` de `public_html`

| # | Regra |
|---|---|
| 1 | `DirectoryIndex index.html`; `Options -Indexes`; HTTP → HTTPS (301); `www` → sem `www` (301) |
| 2 | Negar `.env`, `.git*`, `composer.*`, `*.sql` e `*.log` |
| 3 | Redirecionamentos 301 do WordPress (mapa do cutover, G-01) |
| 4 | Arquivo existente → servir direto (`assets/`, `data/`, `uploads/` etc.) |
| 5 | `<caminho>.html` existente → servir (páginas pré-renderizadas) |
| 6 | `^api/`, `^sanctum/`, `^eventos/[a-z0-9-]+/?$`, `^palavra-viva/[a-z0-9-]+/?$`, `^sitemap\.xml$` → `index.php` (Laravel) |
| 7 | Qualquer outro caminho → `__spa-fallback.html` (painel e 404 da SPA) |
| 8 | Cabeçalhos de segurança e de cache (Security; Performance) |

## Rotas servidas pelo Laravel fora de `/api`

| Rota | Resposta | Cache |
|---|---|---|
| `GET /eventos/{slug}` | `__spa-fallback.html` com `<title>`, `description`, Open Graph (`og:title`, `og:description`, `og:image` = banner, `og:url`, `og:type=website`) e JSON-LD `Event` injetados. Evento inexistente, não publicado ou `FEATURE_EVENTS` desligado → **404** com a página 404 da SPA | `public, max-age=300` |
| `GET /palavra-viva/{slug}` | Igual, com JSON-LD `Article` e `og:image` = miniatura do YouTube ou imagem padrão. Mensagem inexistente, agendada ou excluída → 404 | `public, max-age=300` |
| `GET /sitemap.xml` | Rotas fixas + mensagens publicadas + (com `FEATURE_EVENTS`) eventos publicados, com `lastmod` | `public, max-age=3600` |

**Teste obrigatório**: a meta injetada escapa HTML (o título de um evento não pode quebrar a página nem injetar script).

## Páginas públicas pré-renderizadas (build)

`/`, `/quem-somos`, `/ministerios`, `/grupos`, `/boletins`, `/palavra-viva`, `/eventos`, `/contribua`, `/como-chegar`, `/sou-visitante`, `/quero-ser-membro`, `/pedido-de-oracao`, `/contato`, `/privacidade`.

- Cada uma tem `<title>`, `description` e Open Graph próprios, definidos no build (FR-008).
- Dados mutáveis carregados depois da hidratação (snapshots), com *skeleton*.
- `/eventos` mostra "não encontrado" enquanto `features.events` for falso (R-25).

### Parâmetros de pré-seleção

| Página | Parâmetro | Efeito |
|---|---|---|
| `/sou-visitante` | `?grupo=<id>` | Pré-seleciona o grupo ou a célula ("Quero participar", FR-006) |
| `/contato` | `?ministerio=<id>` | Muda o tipo para `MINISTERIO` com o ministério selecionado ("Falar com este ministério", FR-005) |

## Rotas do painel (não pré-renderizadas, `lazy`, `noindex`)

| Path | Permissão |
|---|---|
| `/admin/entrar`, `/admin/esqueci-senha`, `/admin/redefinir-senha` | — |
| `/admin` | Autenticado |
| `/admin/contatos[/:id]` | `leads.read` |
| `/admin/oracao[/:id]` | `leads.oracao.read` |
| `/admin/boletins[/novo|/:id]` | `boletins.write` |
| `/admin/palavra-viva[/novo|/:id]` | `mensagens.write` |
| `/admin/eventos[/novo|/:id]` | `eventos.write` ou `eventos.write.own` (R2) |
| `/admin/eventos/:id/inscritos` | `eventos.inscricoes.read` ou `.own` (R2) |
| `/admin/ministerios[/novo|/:id]` | `ministerios.write` |
| `/admin/configuracoes` | `settings.write` |
| `/admin/pix` | `pix.write` |
| `/admin/usuarios` | `users.read` |

**Guards**:

- `RequireAuth`: sem sessão → `/admin/entrar?voltar=<rota>`.
- `RequirePermission`: sem a permissão → "Você não tem acesso a esta área".
- O guard é só de experiência; a autorização real é do servidor (BR-076).

## Cabeçalhos de segurança (todas as respostas)

| Cabeçalho | Valor |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `X-Frame-Options` | `DENY` |
| `Content-Security-Policy` | Política em Security → CSRF, XSS. Mudanças (ex.: ferramenta de métricas, TBD-09) entram no mesmo PR |
| `X-Robots-Tag` | `noindex` em `/admin*` e `/api*` |
