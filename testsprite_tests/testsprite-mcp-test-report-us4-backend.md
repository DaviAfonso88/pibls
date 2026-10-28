# TestSprite — US4 (atendimento dos contatos), backend

## 1️⃣ Document Metadata

- **Projeto:** pibls · **Fase:** 6 / US4 · **Tarefa:** T209 (parte backend)
- **Alvo:** app local (Docker, Apache em `http://localhost:8080`), dados fictícios, usuários `%@pibls.test` com senha descartável durante a rodada
- **Data:** 2026-10-21
- **Casos:** 6 (TC001 a TC006), rodados em lotes e um a um por causa do tempo de ~5 a 10 s por requisição (sem OPcache) e do túnel do TestSprite

## 2️⃣ Requirement Validation Summary

| Requisito | Caso | Resultado |
|---|---|---|
| Caixas de contatos (geral e oração, BR-007) | TC001 | PASSED |
| Caixas de contatos: filtros, paginação, sem mensagem na lista | TC002 | PASSED |
| Detalhe do contato e 404 idêntico para fora de escopo (BR-007) | TC003 | PASSED |
| Atendimento: status, responsável, anotação, transições (BR-008, BR-009) | TC004 | PASSED |
| Exclusão a pedido do titular (BR-081) | TC005 | PASSED |
| Responsáveis elegíveis por tipo | TC006 | PASSED |

## 3️⃣ Coverage & Matching Metrics

- 6/6 passaram (100%).
- Rodadas anteriores falharam por causas do ambiente de teste, não do produto: 429 do limite de login (os casos gerados rodam em paralelo e logam várias vezes), `ProxyError` no túnel do TestSprite e premissas erradas do teste gerado (campos no topo da resposta em vez de dentro de `data`; comparação do corpo inteiro do 404 incluindo `traceId`, que é único por requisição; criação de contato por rota inexistente). Os casos foram refeitos com instruções explícitas (corpo em `{"data": …}`, `traceId` ignorado, uso dos contatos já existentes, repetição em `ProxyError`) e passaram sem alterar o código do produto.

## 4️⃣ Key Gaps / Risks

- O TestSprite complementa o Pest (1021 testes, com a BR no nome) e o Playwright; não os substitui.
- Os casos de PATCH e DELETE consomem contatos fictícios; para repetir é preciso recriar os dados pela API pública.
- O app local é lento (~5 s por requisição), o que torna o túnel instável; em CI com OPcache isso não ocorre.
