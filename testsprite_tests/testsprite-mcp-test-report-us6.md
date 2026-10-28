# TestSprite — US6 (PIX), frontend

Data: 2026-10-22. App local (Docker, Apache em http://localhost:8080), build de produção, dados fictícios, 5 casos de 15 do plano (`testsprite_frontend_test_plan.json`).

## Resultado

| Caso | Resultado | Observação |
|------|-----------|------------|
| TC006 Senha errada não altera o PIX (BR-060) | Passou | |
| TC009 Papel sem acesso é bloqueado em `/admin/pix` (BR-076) | Passou | |
| TC015 Validação do formulário antes de salvar (BR-061) | Passou | |
| TC002 Visitante vê e copia os dados PIX | **Falhou** | O botão copiou ("Chave copiada!"), mas o QR Code apareceu quebrado e o favorecido era "Igreja Batista de Teste". **Causa: ambiente, não o app** (ver abaixo). |
| TC001 Alterar o PIX e ver o novo valor na página pública | Bloqueado | O agente não conseguiu escolher um arquivo no campo do QR Code. |

## Causa do TC002

`backend/public/data/settings.json` (o snapshot que o Apache serve direto e que a página Contribua lê) estava com dados de fixture do Pest: a suíte completa, rodada minutos antes no container, gravava no `public/data` e no `public/uploads` reais porque o `phpunit.xml` não isolava esses caminhos. O snapshot apontava para um QR inexistente (`b95ba1dc…png`), por isso a imagem quebrada.

Correção: `backend/phpunit.xml` agora define `SNAPSHOTS_PATH=/tmp/pibls-tests/public/data` e `UPLOADS_PATH=/tmp/pibls-tests/uploads`. O snapshot real foi regenerado (`pibls:snapshots:refresh`) e o QR atual responde `image/png`. Os testes de Content e Platform seguem verdes (367).

## Cobertura equivalente já verde (Playwright, `e2e/specs/pix.spec.ts`)

Cópia da chave e fallback sem Clipboard API, BR-076, dados vigentes, BR-060 (senha errada), alteração com a senha certa com reflexo em `/contribua` e histórico, BR-063 (sem destinatários) e o e-mail de alerta na fila (Mailpit).

## Reexecução do TC002

1. Com o snapshot corrigido, o TC002 falhou de novo: o QR atual era o PNG de 1 pixel que o E2E deixa após a alteração de teste, ampliado como um quadrado preto. Fixture local, não o app.
2. Troquei o QR local por um QR de verdade gerado com dados fictícios (`https://pibls.test/contribua?fixture=local`) e reexecutei: **TC002 passou**.

## Conclusão

4 de 5 casos passaram. O TC001 continua bloqueado pelo limite do agente com upload de arquivo; o fluxo está coberto no Playwright. `PIX_ALERT_RECIPIENTS` do `.env` local voltou a ficar vazio e as senhas dos usuários de teste foram restauradas e conferidas.
