# Site fora do ar

> Origem: `architecture.md` → Observability → Alertas e Backup e Recovery. **Meta: RTO ≤ 4 h, inclusive aos domingos.** Quem executa: o responsável técnico. A liderança recebe o alerta só para ciência e para avisar a igreja pelos canais oficiais.

## 1. O alerta

O UptimeRobot avisa (push no celular e e-mail) quando `https://pibls.com/` ou `https://pibls.com/api/health` falham. Confirme antes de agir: abra os dois endereços no celular, fora do Wi-Fi da igreja.

| O que você vê | Provável causa | Vá para |
|---|---|---|
| Nada abre (nem o cPanel) | Falha da HostGator | 3 |
| O site abre, `/api/health` dá 503 ou 500 | Banco ou aplicação | 2.2 e 2.3 |
| `/api/health` ok, mas a página inicial dá erro | Release quebrada ou arquivo do site apagado | 2.1 |
| Aviso de certificado | AutoSSL vencido | 2.5 |
| Lento, mas abre | Limite de recursos da conta | 2.4 |

## 2. Diagnóstico na conta

### 2.1 Foi a última release?

1. cPanel → **Gerenciador de Arquivos** → `private/<app>/current.php`: qual é a release ativa.
2. Houve deploy nas últimas horas? Veja o histórico em **GitHub → Actions → Deploy**.
3. Se a queda começou junto com um deploy: faça o **rollback** (`rollback.md`, caminho 2 se o GitHub estiver fora). Isso resolve mais da metade dos casos em menos de 15 minutos.

### 2.2 O banco responde?

1. cPanel → **phpMyAdmin**: o banco abre? `SELECT 1` funciona?
2. Se não abre: **Bancos de dados MySQL** → o usuário do banco ainda tem privilégios? A senha foi trocada sem atualizar o `.env`?
3. Tabela corrompida ou apagada: restaure (`restaurar-backup.md`).

### 2.3 O que diz o log?

`private/<app>/shared/storage/logs/app-AAAA-MM-DD.log` (um JSON por linha). Procure as linhas `"level":"error"` mais recentes. O `traceId` que o usuário informou ("Código do erro") é o `correlationId`. O Sentry mostra o mesmo erro com o contexto, sem dados pessoais.

### 2.4 Limites da conta

cPanel → **Métricas → Uso de recursos**: processos simultâneos, CPU, memória e **inodes** (`uploads/`, `backups/` e as releases contam). Se bateu no limite, apague releases antigas e `backups/` além de 48 h, e abra um chamado na HostGator.

### 2.5 Certificado

cPanel → **SSL/TLS Status** → **Run AutoSSL**. O alerta de 14 dias do UptimeRobot existe para isso não chegar a derrubar o site.

### 2.6 Cron e fila

Se o site está no ar mas os e-mails não saem: `emails-nao-chegam.md`.

## 3. A HostGator caiu

Não há o que consertar do nosso lado. O RTO passa a depender dela (Risk Register, RK-02).

1. Confira a página de status da HostGator e abra um chamado com o número da conta.
2. **Avise a igreja** pelos canais oficiais (Instagram `@pib_ls`, WhatsApp da secretaria): a liderança faz isso. O site não é o único canal de informação.
3. Se a queda passar de 4 h, considere a restauração em outra hospedagem, só com a liderança de acordo: `restaurar-backup.md` e `conta-comprometida.md` (troca de chaves).

## 4. Depois do incidente

- Confirme `GET /api/health` (200, com o `release` esperado) e abra o início, `/contato`, `/contribua` e `/admin/entrar`.
- Confira os dados: o contato mais recente aparece na caixa? O resumo diário das 07:00 chegou?
- Registre no resumo ou na issue do incidente: horário, causa, o que foi feito, quanto durou.
- Se a causa foi uma release: abra a correção por PR, com o teste que a teria pegado.
