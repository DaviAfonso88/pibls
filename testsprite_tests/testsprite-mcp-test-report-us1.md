# Relatório TestSprite: US1 (site público), T206

## 1️⃣ Document Metadata

- **Projeto:** pibls
- **Tarefa:** T206 (Fase 3, US1: visitante conhece a igreja e planeja a primeira visita)
- **Data:** 2026-10-21
- **Alvo:** o build servido pelo Apache do Docker com o `.htaccess` real (`npm run build && npm run deploy:local`), em `http://localhost:8080`, com o conteúdo do seed das migrations (sem células, sem link de mapa; o endereço ainda tem `TODO(TBD-11)`). `serverMode: production`.
- **Casos executados:** backend, TC001, TC004, TC005 e TC006; frontend, TC001, TC005, TC008, TC009, TC013 e TC015. Ficaram de fora os casos que dependem de dado que o seed não tem (mapa, Google Maps, Waze, células), cobertos pelo Playwright com dados fictícios (`e2e/specs/public-pages.spec.ts`).

## 2️⃣ Requirement Validation Summary

### API pública de configurações (backend)

#### TC001: `GET /api/public/settings`

- **Status:** ✅ Passou
- **Análise:** 200 com `{data}` e as chaves públicas; o corpo não contém `notification_recipients` (BR-050).

### API pública de ministérios (backend)

#### TC004: lista de ministérios ativos

- **Status:** ✅ Passou
- **Análise:** nenhum item traz `private_address` nem `contact_email` (BR-048); cada item tem exatamente os oito campos do contrato `MinistryPublic`.

#### TC005: lista filtrada por categoria

- **Status:** ✅ Passou

#### TC006: categoria inválida

- **Status:** ✅ Passou
- **Análise:** 422 no envelope `VALIDATION_ERROR`, com `details[0].field = category`.

### Página inicial (frontend)

#### TC001: horários e transmissão ao vivo

- **Status:** ✅ Passou
- **Análise:** o quadro de horários aparece com os dados do seed, sem erro de console nem a tela "Algo deu errado".

### Ministérios e grupos (frontend)

#### TC008: expandir um ministério e abrir "Falar com este ministério"

- **Status:** ✅ Passou
- **Análise:** o endereço fica em `/contato?ministerio=<id>`.

#### TC013: filtrar grupos por perfil, TC015: voltar a "Todos"

- **Status:** ✅ Passou
- **Análise:** o filtro por perfil mostra só o grupo do perfil e "Todos" devolve a lista inteira.

#### TC009: "Quero participar" em um grupo

- **Status:** ✅ Passou
- **Análise:** o endereço fica em `/sou-visitante?grupo=<id>` (a Ficha de Visitante é da Fase 4; até lá a página mostra o 404 amigável).

### Página 404 (frontend)

#### TC005: recuperar-se de uma URL desconhecida pelos atalhos

- **Status:** ✅ Passou

## 3️⃣ Coverage & Matching Metrics

| Requisito | Casos | ✅ Passou | ❌ Falhou |
| --- | --- | --- | --- |
| API pública de configurações | 1 | 1 | 0 |
| API pública de ministérios | 3 | 3 | 0 |
| Página inicial | 1 | 1 | 0 |
| Ministérios e grupos | 3 | 3 | 0 |
| Página 404 | 1 | 1 | 0 |
| **Total** | **9** | **9** | **0** |

## 4️⃣ Key Gaps / Risks

- O seed não tem células de CL nem link de mapa: o filtro por bairro, o mapa só depois do toque, o "fallback desatualizado" e o Open Graph são conferidos pelo Playwright (`public-pages.spec.ts`, 22 casos, passando no Apache local e no servidor do job `a11y-perf`).
- O endereço ainda é `TODO(TBD-11)`: o deploy de produção falha de propósito enquanto o marcador existir.
- As páginas `/contato`, `/sou-visitante`, `/contribua`, `/boletins` e `/palavra-viva` ainda não existem (Fases 4 em diante); os links para elas caem no 404.
- O orçamento de JS está em 148,0 KB de 150 KB gzip na pior rota (`/grupos`).
