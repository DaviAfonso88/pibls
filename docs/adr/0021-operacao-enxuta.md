# ADR-021 — Operação enxuta: só o que protege os dados e avisa quando o site cai

- **Status:** Aceita
- **Data:** 2026-10-23 (decisão do responsável)

## Contexto

A Fase 10 entregou o código completo da operação (backup cifrado, cópia no B2, expurgo, resumo diário, alertas, limpeza de releases) e um roteiro de implantação pensado para o pior dia: cinco checks no Healthchecks, três monitores no UptimeRobot, Sentry, teste de restauração e de rollback a cada trimestre, lembretes mensais, trimestrais, semestrais e anuais, e um kit de contingência com cofre em duas cópias, senha mestra em envelope lacrado, abertura por duas pessoas e runbooks impressos.

Quem opera é uma pessoa só (fator ônibus 1), o público é uma igreja local e a maior parte dos dados é de curta duração (contatos e pedidos de oração são apagados em 60 dias a 12 meses). O roteiro completo cobra mais atenção do que essa pessoa consegue dar, e o que não é feito vira alerta ignorado.

## Decisão

O **código fica como está** (todos os comandos, o agendador e os alertas continuam implementados e testados, e cada um só age quando a sua variável do `.env` está preenchida). Muda **o que se configura e o que se rotina**:

| Tema | Antes (architecture.md) | Agora |
|---|---|---|
| Backup externo (B2) e chave privada | Obrigatório | **Obrigatório, sem mudança.** É a única proteção contra perder a conta da hospedagem |
| UptimeRobot | 3 monitores (site, `/api/health`, certificado) | **1 monitor** (a página inicial) |
| Healthchecks | 5 checks | **2 checks**: cópia externa (`HEALTHCHECKS_BACKUP_OFFSITE_URL`) e worker de e-mail (`HEALTHCHECKS_PING_URL`). Os outros três (`BACKUP_DB`, `PURGE`, `MAIL`) ficam vazios |
| Sentry | Backend e frontend | **Opcional**; o código roda sem DSN, e o log em arquivo registra os erros |
| Resumo diário por e-mail | Ligado | **Opcional** (`DAILY_REPORT_RECIPIENTS` vazio = não envia) |
| Teste de restauração | Trimestral | **Uma vez** depois da primeira cópia no B2 e **uma vez por ano** (na janela de fevereiro), mais depois de qualquer mudança no backup ou na chave |
| Teste de rollback | Trimestral | **Uma vez por ano** e antes do go-live (os 3 ensaios da T023 continuam valendo) |
| Kit de contingência | Cofre em 2 cópias, senha mestra em envelope, abertura por 2 pessoas, runbooks impressos | **Um cofre KeePassXC com 6 itens e uma cópia com uma pessoa de confiança da liderança** (a senha mestra, que ela guarda), além da cópia do responsável |
| Lembretes por issue | Mensal, trimestral, semestral e anual | **Mensal (curto) e anual** (fevereiro); o anual inclui a restauração, os acessos e o kit |

## Alternativas consideradas

- **Manter o roteiro completo:** é o que a arquitetura previa, mas depende de uma disciplina que uma pessoa só não sustenta, e a parte não cumprida vira ruído.
- **Cortar também o B2 (confiar só nos backups da HostGator):** descartado. Os backups da HostGator ficam na mesma conta e não estão sob nosso controle; perder a conta seria perder contatos, boletins e configurações.
- **Remover o código das rotinas dispensadas:** descartado. Está pronto, testado e custa zero ficar desligado; ligar depois é só preencher uma variável.

## Consequências

- *Positivas:* a implantação cabe em cerca de uma hora; sobram poucos alertas, e cada um tem dono; nada que foi construído precisa ser refeito para voltar ao roteiro completo.
- *Negativas:* sem os três checks extras, uma falha só do dump horário local aparece pela cópia externa do dia seguinte (RPO efetivo de até 24 h em vez de 1 h para esse tipo de falha); sem Sentry, os erros só aparecem no log do servidor; sem o monitor de certificado, o vencimento do SSL só é notado quando o site der aviso (o AutoSSL renova sozinho).
- *A observar:* o RTO de 4 h e o RPO de 1 h (Backup e Recovery) valem para quem seguir o roteiro completo; na versão enxuta a meta realista é **voltar em um dia útil, perdendo até 24 h**. Se a igreja passar a depender mais do portal (eventos com inscrição pagante, muitos acessos), religar os checks e o Sentry, e voltar aos testes trimestrais, sem nenhuma mudança de código.
- A Constituição VII segue atendida: a restauração continua testada periodicamente (anual), o kit é entregue à liderança e a observabilidade usa só serviços gratuitos.

## Como religar o roteiro completo

Preencher no `.env` as variáveis que estão vazias (`HEALTHCHECKS_BACKUP_DB_URL`, `HEALTHCHECKS_PURGE_URL`, `HEALTHCHECKS_MAIL_URL`, `SENTRY_LARAVEL_DSN`, `DAILY_REPORT_RECIPIENTS`), criar os monitores que faltam e restaurar os lembretes trimestral e semestral em `deploy/lembretes/` e em `deploy/ci/abrir-lembretes.sh`. O passo a passo completo continua em `docs/runbooks/setup-hospedagem.md` §3.
