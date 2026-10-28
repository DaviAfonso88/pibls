# E-mails não chegam

> Origem: `architecture.md` → Observability → Alertas e ADR-003 (fila no banco). Todo e-mail do portal (aviso de contato novo, resumo diário, alertas de PIX, redefinição de senha) sai **pela fila** `jobs`, entregue pelo worker que o agendador roda a cada 5 minutos. A operação que gerou o e-mail nunca falha por causa dele.

## 1. Como chegou aqui

- Alerta do Healthchecks: **"worker de e-mail sem heartbeat há mais de 15 min"** (o cron parou) ou **"mais de 10 e-mails com falha definitiva em 1 h"** (`pibls:mail:failure-check`).
- Alguém da equipe avisou que não recebeu o aviso de um contato.
- O resumo diário não chegou às 07:00.

## 2. Diagnóstico, na ordem

### 2.1 O cron está rodando?

1. Healthchecks: o check do worker está verde? Se está vermelho, o `schedule:run` não está rodando.
2. cPanel → **Tarefas Cron**: as quatro tarefas de `cron.txt` existem e usam o PHP 8.4? Confira o caminho do PHP depois de uma mudança de versão na conta.
3. Se o cron não roda, o site continua no ar, mas nada sai da fila: corrija o cron e a fila se esvazia sozinha (até 20 e-mails por execução).

### 2.2 Quantos estão parados?

phpMyAdmin:

```sql
SELECT COUNT(*) FROM jobs;                                   -- esperando envio
SELECT COUNT(*) FROM failed_jobs;                            -- falha definitiva
SELECT failed_at, LEFT(exception, 200) FROM failed_jobs ORDER BY id DESC LIMIT 10;
```

O resumo diário traz os mesmos números (fila e falhas das últimas 24 h).

### 2.3 Qual é o erro?

| Mensagem em `failed_jobs.exception` | Causa | O que fazer |
|---|---|---|
| `Connection could not be established` / `timed out` | SMTP fora ou bloqueado | Teste a conta de e-mail no webmail. Confira host, porta (465) e se a HostGator bloqueou a conta |
| `Authentication failed` | Senha do SMTP trocada | Atualize `MAIL_USERNAME` e `MAIL_PASSWORD` no `.env` do servidor |
| `Daily/Hourly sending limit exceeded` | Limite de envios por hora da conta (TBD-02) | Espere o limite zerar; reduza o volume (o resumo diário é um e-mail só) |
| `Address ... not allowed` (só homologação) | `MAIL_ALLOWLIST` bloqueia o endereço | Esperado: a homologação nunca envia para pessoas reais |
| Erro de view ou de classe | Defeito de código | Veja o log (`site-fora-do-ar.md`, 2.3) e faça rollback se foi a última release |

### 2.4 SPF, DKIM e caixa de spam

Se os e-mails saem (`mail.sent` no log) mas não chegam: veja a pasta de spam do destinatário e o painel de **Entregabilidade** do cPanel (SPF e DKIM da conta). **Não altere MX, SPF, DKIM nem os servidores de nomes**: o e-mail da igreja usa esses registros (BG-2).

## 3. Reenviar o que falhou

Depois de corrigir a causa, recoloque as falhas na fila com uma **tarefa cron de uso único** (o servidor não tem SSH):

```
php /home/USUARIO/private/bin/artisan.php pibls queue:retry all
```

Configure para daqui a 5 minutos, confira que o e-mail saiu e **apague a tarefa**. Os e-mails de redefinição de senha expiram em 60 minutos: se já passou, peça um novo link, em vez de reenviar.

Para limpar de vez os que não fazem mais sentido: `queue:flush`. A limpeza automática (`failed_jobs` com mais de 30 dias) é diária.

## 4. Enquanto não se resolve

Os contatos **continuam chegando ao painel** (`/admin/contatos`): a falta de e-mail não perde dado. Avise a Secretaria para olhar a caixa do painel, sem esperar o aviso.

## 5. Depois

Anote a causa e o tempo. Se foi limite de envio, discuta com a liderança se o volume justifica outro SMTP (e uma ADR, porque muda a stack).
