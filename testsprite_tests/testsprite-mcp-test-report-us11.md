# Relatório TestSprite: US11 (inscritos, CSV, PDF e cancelamento)

## 1️⃣ Document Metadata

- **Projeto:** pibls
- **Data:** 2026-10-24
- **Tipo:** frontend, contra o app local (Apache em http://localhost:8080, build de produção) com `FEATURE_EVENTS=true` e dados fictícios (eventos "TS …", inscrições "… Teste")
- **Usuário:** líder de ministério do seed local (`lider@pibls.test`), ministério Comunicação
- **Task:** T217 (Fase 14)
- **Plano:** `testsprite_tests/testsprite_frontend_test_plan.json` (5 casos, escritos à mão)
- **Execuções:** duas. Na primeira rodaram os 5 casos (3 passaram). A segunda refez só TC002 e TC003, com passos de espera explícitos (a primeira checou o resultado antes de a busca e o PDF terminarem). Os dados foram recriados antes da segunda, porque o TC004 tinha cancelado uma inscrição.
- **Crédito:** 36,7 antes; cerca de 0,3 por caso executado

## 2️⃣ Requirement Validation Summary

### Requisito: lista de inscritos e contador (FR-060)

| Caso | Resultado |
| --- | --- |
| TC001 abrir os inscritos pelo link "Inscritos" da lista de eventos; contador "4 de 20 vagas preenchidas"; colunas e nomes | ✅ passou |
| TC002 buscar por nome ("carla") e ver só a pessoa buscada | ❌ na 1ª rodada, ✅ na 2ª |

- **TC002, 1ª rodada:** o teste olhou a tabela logo depois de digitar e ainda viu as quatro pessoas. A busca roda 350 ms depois da digitação e faz uma requisição; no Docker local cada requisição leva vários segundos. Não é defeito do produto: o E2E do Playwright (`registrations-admin.spec.ts`, "busca por nome e guarda a busca na URL") passa porque espera. Com o passo "esperar até a tabela sair de Ana Souza Teste", o TestSprite também passou.

### Requisito: exportação em CSV e PDF (FR-061)

| Caso | Resultado |
| --- | --- |
| TC003 "Exportar CSV" mostra "CSV baixado." e "Exportar PDF" mostra "PDF baixado."; aviso de dados pessoais visível | ❌ na 1ª rodada, ✅ na 2ª |

- **TC003, 1ª rodada:** o teste viu "Gerando o PDF…" e checou a confirmação antes de o arquivo ficar pronto. O PDF busca todas as inscrições e gera o arquivo no navegador, o que leva alguns segundos no ambiente local. Com a espera explícita (até 45 s) passou.

### Requisito: cancelamento com devolução da vaga (BR-034)

| Caso | Resultado |
| --- | --- |
| TC004 cancelar com "Manter inscrição" (nada muda) e depois confirmar; mensagem "Inscrição cancelada. A vaga voltou a ficar disponível."; contador de 4 para 3; a pessoa sai da tabela | ✅ passou |

### Requisito: autorização por escopo (BR-030)

| Caso | Resultado |
| --- | --- |
| TC005 evento de outro ministério: "Não encontramos este evento.", sem nomes de inscritos e sem contador | ✅ passou |

## 3️⃣ Coverage & Matching Metrics

- 5 de 5 casos aprovados no conjunto das duas rodadas (3 de 5 na primeira; os 2 que falharam foram refeitos e passaram).
- Cobertos: lista e contador, busca, CSV, PDF, cancelamento com confirmação, escopo `.own` (404).
- Não cobertos pelo TestSprite, e onde estão: conteúdo dos arquivos baixados (E2E do Playwright e Pest/Vitest), a exclusão a pedido do titular/LGPD (E2E), o PDF de 500 inscrições em até 10 s (E2E, `registrations-admin.spec.ts`), a matriz de papéis por rota (Pest, `AuthorizationMatrixTest`).

## 4️⃣ Key Gaps / Risks

- **SC-014 não confirmado ainda:** no Docker local de Windows, o PDF de 500 inscrições levou de 12,6 a 14,8 s do clique ao arquivo (3 s de busca no servidor e de 6 a 8 s de geração, com a CPU do Chromium 4× mais lenta). A confirmação do ≤ 10 s fica para o computador de referência e a homologação (T194).
- **Teste de TestSprite e lentidão local:** casos que dependem de busca ou de PDF precisam de passos de espera explícitos; nada indica problema de produto.
- **Dados:** os eventos e inscrições fictícios foram removidos ao fim da rodada; `FEATURE_EVENTS` voltou a `false`.
