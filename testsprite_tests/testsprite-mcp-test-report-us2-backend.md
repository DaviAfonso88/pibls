# TestSprite — US2 (formulários públicos), backend (T207)

## 1️⃣ Document Metadata
- **Projeto:** pibls · **Data:** 2026-10-21/22 · **Alvo:** `POST /api/public/leads` e rotas ligadas, no app local (Apache + PHP 8.4 + MySQL, Docker), com dados fictícios
- **Plano:** `testsprite_backend_test_plan.json` (7 casos). Duas execuções: a primeira com os 7, a segunda só com TC003 e TC004.

## 2️⃣ Requirement Validation Summary

| Caso | Requisito | Resultado |
|---|---|---|
| TC001 | `GET /sanctum/csrf-cookie` responde 204 e grava `XSRF-TOKEN` e a sessão | ✅ |
| TC002 | Envio válido responde 201 `{"data":{"received":true}}`, sem id | ✅ |
| TC003 | Campos inválidos respondem 422 com o envelope de erro e `details` por campo (consentimento, telefone, tipo) | ✅ (2ª execução) |
| TC004 | Honeypot `website` preenchido responde 201 genérico e não grava | ✅ (2ª execução) |
| TC005 | Sem o token CSRF, 419 | ✅ |
| TC006 | O 4º envio do mesmo telefone em 10 min é recusado com 429 | ✅ |
| TC007 | `GET /api/public/ministries` lista os ministérios e grupos ativos | ✅ |

## 3️⃣ Coverage & Matching Metrics
- **7 de 7 aprovados** (5 na 1ª execução; os 2 restantes na 2ª).

## 4️⃣ Key Gaps / Risks
- **Os 2 reprovados da 1ª execução não eram defeito do sistema.** O TC003 recebeu 429 porque os casos rodam em paralelo do mesmo IP e passaram do limite de 10 envios por 10 min (a instrução pedia no máximo 8 envios; os testes gerados fizeram mais). No TC004, o teste gerado presumia que o envio de honeypot não conta no limite por telefone; hoje conta, de propósito: o `throttle` roda antes do honeypot, e um robô não ganha tentativas extras. A 2ª execução limitou cada caso a 3 e 2 envios e limpou o cache de limites antes.
- O limite por IP (10/10 min) torna o conjunto sensível à ordem: rodar de novo sem `php artisan cache:clear` produz 429.
- O e-mail não é coberto pelo TestSprite; está no E2E (`e2e/specs/leads-submit.spec.ts`, BR-007) e nos testes Pest.
