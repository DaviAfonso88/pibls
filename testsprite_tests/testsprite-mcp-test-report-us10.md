# TestSprite — US10 (inscrição pública em eventos), frontend

Data: 2026-10-24. App local (Docker, Apache em http://localhost:8080), build de produção, dados fictícios, com `FEATURE_EVENTS=true` só durante a execução. Sem login (páginas públicas). Plano escrito à mão (`testsprite_frontend_test_plan.json`), 8 casos. Os eventos "TS …" foram criados por um script temporário e removidos no fim, junto com as inscrições do teste.

## Resultado

8 de 8 passaram (100%).

| Caso | Resultado |
|------|-----------|
| TC001 `/eventos` lista os eventos publicados com a situação das inscrições; o rascunho não aparece | Passou |
| TC002 Inscrição com as perguntas do evento (texto e escolha) e tela de confirmação | Passou |
| TC003 Formulário vazio mostra os erros dos campos obrigatórios | Passou |
| TC004 A mesma pessoa com o mesmo telefone não se inscreve duas vezes (BR-022) | Passou |
| TC005 Evento com menores pede o responsável legal (BR-023) | Passou |
| TC006 Vagas esgotadas: aviso e nenhum formulário (BR-021) | Passou |
| TC007 Prazo vencido: aviso e nenhum formulário (BR-020) | Passou |
| TC008 Evento em rascunho ou inexistente: "Evento não encontrado" | Passou |

## O que este relatório não cobre, e onde está coberto

- **Garantia de vaga sob concorrência** (N vagas e mais de N envios → exatamente N; mesma pessoa em paralelo → 1): o TestSprite não faz rajada. Está em `RegistrationConcurrencyTest` (Pest, grupo `concurrency`, processos paralelos) e, para a homologação, em `load/registration-burst.js` (T194).
- **Flag desligada → `/eventos` mostra "não encontrado"**: o ambiente da execução tinha a flag ligada. Está no Vitest (`public-events.test.tsx`) e no Pest. Depois da execução a flag voltou a `false`, os snapshots foram regenerados e a API pública responde 404.
- **Consentimento de saúde (BR-083), confirmação por e-mail e demais regras do servidor:** Pest (`RegisterForEventTest`, 50 casos).

## Achado fora do TestSprite

O E2E do Playwright (`e2e/specs/registration.spec.ts`, 6 casos) pegou um bug que o Vitest não pegava: a lista `/eventos` mandava `include_past=true` e a regra `boolean` do Laravel só aceita `1` e `0`, então a API respondia 422 e a página mostrava "Não foi possível carregar". Corrigido no frontend (`include_past: 1`) e o mock da lista passou a recusar `true`.
