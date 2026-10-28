# TestSprite — Fase 10 (operação), escopo reduzido

Data: 2026-10-23. App local (Docker, Apache em http://localhost:8080), build de produção, dados fictícios, usuário `secretaria@pibls.test`. A fase só acrescentou comandos Artisan e tarefas agendadas (backup cifrado, cópia ao B2, expurgo LGPD, resumo diário, alerta de falhas de e-mail, limpeza de releases) e não tem tela nova: este é o escopo da T213, que prova que o agendador e o expurgo não quebraram o app. Backup, expurgo, resumo e alertas seguem cobertos só pelo Pest (T143 a T145).

## Resultado: 11 de 11

### Frontend (5 de 9 casos do plano)

| Caso | Resultado |
|------|-----------|
| TC001 Abrir a página inicial e ver as boas-vindas | Passou |
| TC002 Entrar no painel com credenciais válidas | Passou |
| TC003 Painel com o menu filtrado para a Secretaria | Passou |
| TC005 Bloquear o acesso ao painel sem sessão | Passou |
| TC006 Marca no cabeçalho e destaque do YouTube no rodapé | Passou |

Fora desta execução: TC004 (abriria o YouTube em outra aba) e TC007 a TC009 (variações de login inválido, já cobertas por Vitest e Playwright).

### Backend (6 de 9 casos do plano)

| Caso | Resultado |
|------|-----------|
| TC001 `GET /api/health` devolve `ok` e a release | Passou |
| TC003 `GET /sanctum/csrf-cookie` grava os cookies (204) | Passou |
| TC004 Login válido com o token XSRF | Passou |
| TC005 Login com senha errada é recusado (422, envelope de erro) | Passou |
| TC008 `GET /api/auth/me` sem sessão devolve 401 | Passou |
| TC009 `GET /api/public/settings` não traz `notification_recipients` | **Passou na segunda execução** (ver abaixo) |

Fora desta execução: TC002 (exigiria derrubar o banco), TC006 e TC007 (CSRF ausente e `me` autenticado, cobertos pelo Pest).

## O TC009 falhou na primeira execução, e a causa foi o roteiro

O roteiro gerado esperava as chaves `schedule`, `address`, `whatsapp` e `youtube` na raiz da resposta. A API devolve o envelope documentado `{"data": {...}}`, com a chave `youtube_links`, e o app estava certo: a resposta real traz `schedule`, `campaign_notice`, `lords_supper_notice`, `address`, `map_links`, `whatsapp`, `youtube_links`, `social_links`, `pix` e `features`, e **nenhum** `notification_recipients`. Reexecutei só o TC009 explicando o envelope no roteiro, e ele passou. Nenhum código do app foi alterado por isso.

## Cobertura que o TestSprite não faz (e onde está)

- **Pest, suíte completa do backend: 1.544 testes passam, 1 pulado**, incluindo o teste de arquitetura (`Platform` continua sem depender dos módulos de negócio). Os 80 testes de dump, expurgo, resumo e migrations também passam no **MySQL 5.7**.
- **Deploy (`deploy/tests`): 129 passam, 1 pulado** (o do workflow, que precisa do `.github`, montado só no CI).
- **PHPStan nível 6 sem erros; Pint sem pendências.**
- **Ensaio de restauração local** (T154, parcial): backup cifrado do banco de desenvolvimento, aberto com a chave privada e restaurado num banco novo, com a contagem idêntica nas 6 tabelas conferidas. Detalhes e tempos em `docs/runbooks/restaurar-backup.md`.

## O que ficou fora, de propósito

O envio real ao B2, o ping real no Healthchecks e o UptimeRobot dependem das contas da T152; o resumo diário por e-mail depende de `DAILY_REPORT_RECIPIENTS` e do worker. Todos têm teste com dublê (`Storage::fake`, `Http::fake`, `Mail::fake`). A primeira execução em produção deve ser conferida à mão, como manda o `setup-hospedagem.md` §3.4.
