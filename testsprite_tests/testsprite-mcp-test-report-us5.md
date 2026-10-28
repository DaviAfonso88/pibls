# TestSprite — US5 (boletins e Palavra Viva), T210

## 1️⃣ Document Metadata

- **Projeto:** pibls · **Fase:** 7 / US5 · **Tarefa:** T210
- **Alvo:** app local (Docker, Apache em `http://localhost:8080`), conteúdo fictício, usuários `%@pibls.test` com senha descartável durante a rodada (hashes originais restaurados e conferidos ao fim), conteúdo fictício removido
- **Data:** 2026-10-22

## 2️⃣ Requirement Validation Summary

### Backend (5 casos)

| Caso | O que cobre | Resultado |
|---|---|---|
| TC001 | Sessão, CSRF e login | PASSED (2ª rodada) |
| TC002 | Painel de boletins: criar com PDF, edição repetida (409), PDF falso (422), agendar, substituir PDF, excluir, 403 sem permissão | PASSED |
| TC003 | `GET /api/public/bulletins`: filtros de ano e mês, 422, agendado invisível | PASSED |
| TC004 | Painel da Palavra Viva: criar, sanitização com `sanitization_warning`, slug duplicado (409), link fora do YouTube (422), agendar, excluir | PASSED |
| TC005 | Público: lista, mensagem por slug, 404 de agendada, meta injetada (`og:title`, JSON-LD `Article`) e `sitemap.xml` | PASSED |

### Frontend (8 casos escolhidos entre 28)

| Caso | O que cobre | Resultado |
|---|---|---|
| TC001 | `/boletins`: cartões, "Ler boletim" em nova aba, "Baixar PDF" | PASSED (2ª rodada, com PDF válido) |
| TC004 | Filtro por ano e mês | PASSED (2ª rodada, com PDF válido) |
| TC002 | Mensagem mais recente da Palavra Viva | PASSED |
| TC013 | Publicar mensagem pelo painel | PASSED |
| TC021 | Rascunho local restaurado depois de recarregar | PASSED |
| TC023 | Secretaria sem acesso ao painel de boletins | PASSED |
| TC011 | Publicar boletim com upload de PDF | **BLOCKED**: o agente do TestSprite não tem como escolher um arquivo no seletor |
| TC019 | Colar HTML com `<script>` e imagem no editor | **FAILED por limitação do teste**: o agente só consegue digitar; digitar `<script>` vira texto comum (correto), não HTML colado |

## 3️⃣ Coverage & Matching Metrics

- Backend: 5/5. Frontend: 6/8 passaram, 1 bloqueado e 1 falho por limitação do agente (nenhum por defeito do produto).
- As falhas da 1ª rodada eram do teste ou do dado, não do código: limite de login (429) por rodar com a configuração do backend; os dois primeiros TC001/TC004 de frontend abriram um PDF fictício **inválido** (sem tabela `xref`), que o visualizador do navegador recusa ("Failed to load PDF document"); trocado por um PDF válido, passaram.
- O que o TestSprite não consegue exercitar (upload de arquivo e colagem de HTML) está coberto por testes que o fazem de verdade: Playwright `e2e/specs/content.spec.ts` (10/10: PDF de 10 MB, PDF falso, edição repetida, agendamento, `<script>` colado, sessão expirada com rascunho) e Vitest (`editor.test.tsx`, `admin-bulletins.test.tsx`, `admin-posts.test.tsx`).

## 4️⃣ Key Gaps / Risks

- O Checkpoint da fase conta com o TestSprite como complemento, não como substituto do Pest, do Vitest e do Playwright.
- O `bootstrap` de frontend não troca o `config.json` quando ele já existe: foi preciso ajustar `type`, `localEndpoint` e `status` à mão (a primeira rodada rodou os casos de backend por engano).
- O runner do TestSprite fica ativo por 1 hora depois de terminar; foi encerrado só ele, sem derrubar o MCP.
