# TestSprite — US7 (configurações e catálogo), frontend

Data: 2026-10-23. App local (Docker, Apache em http://localhost:8080), build de produção, dados fictícios, como Secretaria (`secretaria@pibls.test`). 12 dos 20 casos do plano (`testsprite_frontend_test_plan.json`); os 8 de fora repetem fluxos já cobertos (TC002, TC003 e TC006 são login e menu, como o TC004; TC009, TC011, TC014, TC015 e TC016 são variações de listar, criar e editar).

## Resultado

| Caso | Resultado | Observação |
|------|-----------|------------|
| TC004 Entrar como Secretaria e ver só os itens do papel | Passou | |
| TC005 Alterar horários, avisos, endereço e destinatários e ver em `/` | Passou | |
| TC007 Salvar as configurações | Passou | |
| TC008 Ministérios ativos no catálogo público | Passou | |
| TC010 Item desativado some do público | Passou | "Cantina" |
| TC012 Criar um ministério e publicá-lo | Passou | |
| TC013 Reordenar itens | Passou | "Sonoplastia" |
| TC017 Excluir item em uso é recusado (BR-047) | Passou | "Comunicação" |
| TC018 Horário inválido é recusado | Passou | |
| TC019 E-mail de aviso repetido é recusado | Passou | |
| TC001 Horários e avisos na home | **Falhou** | Não é defeito do app (ver abaixo). |
| TC020 Limite de 10 e-mails por tipo (BR-051) | Bloqueado | O agente perdeu a referência do campo de e-mail; nenhum 11º e-mail foi tentado. |

10 de 12 passaram (83,33%).

## TC001: expectativa do plano, não defeito

- O plano esperava o aviso da Ceia. Ele é manual e vem desligado no conteúdo inicial (`supper`): a home só o mostra quando a Secretaria o liga.
- O rodapé mostra `TODO(TBD-11)` na rua, no número, no bairro e no CEP, porque o endereço do templo é a TBD-11, ainda não resolvida. Falta o dado, não o código. Os horários e o aviso de campanha ("Estamos Construindo") apareceram como esperado.
- O TC005 provou a outra metade: com um endereço válido salvo, a home mostrou o novo endereço.

## TC020: cobertura equivalente já verde

- Vitest: `BR-051 trava em 10 e-mails por tipo` e `BR-051 recusa e-mail inválido e repetido` em `frontend/app/features/content/__tests__/settings-form.test.tsx`.
- Pest: `BR-051 aceita até 10 e-mails por tipo e recusa 11` em `backend/tests/Feature/Content/AdminSettingsTest.php`.

## Ambiente

- O Docker Desktop estava parado; foi iniciado e o `docker compose up -d` subiu app, MySQL e Mailpit. O build do frontend já era o atual (nenhum fonte mais novo que `backend/public/index.html`).
- Antes da execução, `site_settings` e `ministries_groups` foram salvas; depois, restauradas (26 itens, todos ativos) e os snapshots regenerados com `pibls:snapshots:refresh`. O endereço voltou ao seed (`TODO(TBD-11)`).
- O runner foi encerrado sem derrubar o servidor MCP.

## Conclusão

Os fluxos da US7 passaram: configurações salvas e refletidas em `/`, validações de horário e de e-mail repetido, catálogo (criar, desativar, reordenar) e a recusa da BR-047. Sobram o TC001 (expectativa do plano contra o conteúdo de seed e a TBD-11) e o TC020 (limite do agente, coberto por Vitest e Pest).
