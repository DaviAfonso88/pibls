# Relatório TestSprite — Fase 2 (fundação), backend

## 1️⃣ Document Metadata

- **Projeto:** pibls
- **Tarefa:** T205 (Fase 2, backend)
- **Data:** 2026-10-21
- **Alvo:** app local no Docker (Apache + PHP 8.4 sem OPcache, MySQL 8.0) em `http://localhost:8080`, dados fictícios
- **Casos executados:** TC001, TC004, TC006 (os três pedidos em `tasks.md` → T205). Cerca de 0,3 crédito por caso.

## 2️⃣ Requirement Validation Summary

### Saúde da aplicação

#### TC001 — `GET /api/health` devolve `status: ok` e o id da release com o banco acessível

- **Status:** ✅ Passou (200, `{"status":"ok","release":"dev"}`)
- **Análise:** atende ao critério de T205 (200 com `release`). O caso de banco inacessível (TC002 do plano, 503) não foi executado: não há como derrubar o MySQL de forma segura a partir do TestSprite; ele é coberto pelo teste de feature `HealthTest` do Pest.

### CSRF do Sanctum (SPA)

#### TC004 — `GET /sanctum/csrf-cookie` responde 204 e define `XSRF-TOKEN`

- **Status:** ✅ Passou
- **Análise:** o cookie CSRF é emitido sem corpo, como o cliente HTTP do frontend espera antes da primeira escrita.

### Envelope de erro padrão

#### TC006 — rota de API inexistente responde 404 no envelope `{error:{code,message,details,traceId}}`

- **Status:** ✅ Passou na 2ª execução
- **1ª execução (falha):** o caso gerado enviava `X-Request-Id` com um **UUID** e esperava o mesmo valor de volta. O contrato (architecture.md → API Standards) diz que o `X-Request-Id` da SPA é um **ULID**, opcional, e que a resposta traz "o mesmo ou um gerado". A API só aceita ULID válido; com outro formato ela gera o próprio id (`01M5FT7HMN698VBQ4Y25S128GF` na execução), e `error.traceId` é igual ao cabeçalho de resposta. Não há defeito no produto: a expectativa do caso gerado estava errada.
- **2ª execução:** o caso foi regerado com a instrução de enviar um ULID (`01ARYZ6S41TSV4RRFFQ69G5FAV`) e conferir que o cabeçalho de resposta e `error.traceId` são exatamente esse valor. Passou.

## 3️⃣ Coverage & Matching Metrics

| Requisito | Casos | ✅ Passou | ❌ Falhou |
| --- | --- | --- | --- |
| Saúde da aplicação | 1 | 1 | 0 |
| CSRF do Sanctum (SPA) | 1 | 1 | 0 |
| Envelope de erro padrão | 1 | 1 (após corrigir a expectativa do caso) | 0 |
| **Total** | **3** | **3** | **0** |

## 4️⃣ Key Gaps / Risks

- O 503 de `/api/health` com o banco fora do ar e o 405 em `/api/health` e `/sanctum/csrf-cookie` (TC002, TC003, TC005 do plano) ficaram de fora desta rodada; os dois estão cobertos por testes de feature do Pest (`HealthTest`, `ErrorEnvelopeTest`).
- O plano gerado pelo TestSprite parte do `code_summary.yaml`; a rota `GET /api/poc/read` (PoC de desempenho, ainda no código até a T015) foi declarada como fora de escopo para não virar caso de teste.
- Os casos gerados pela IA podem assumir comportamentos que o contrato não promete (como o eco de qualquer `X-Request-Id`). Revise o código gerado antes de tratar uma falha como defeito.
