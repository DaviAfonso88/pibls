# Kit de contingência

> Origem: `architecture.md` → DevOps e ADR-011, ADR-016 (QA-04). **Para quê:** se o responsável técnico ficar indisponível (doença, viagem, saída), a liderança consegue, **sozinha e em minutos**, dar acesso a outra pessoa de confiança ou restaurar o portal. O kit é um **cofre de senhas**, não um documento: nada disto fica em planilha, e-mail, WhatsApp ou neste repositório.

> **Versão enxuta (ADR-021), a que vale na implantação:** um cofre KeePassXC com as **6 entradas essenciais** (cPanel, domínio, `.env` de produção, chave privada dos backups, GitHub e B2); **uma cópia com uma pessoa de confiança da liderança**, que guarda a senha mestra separada (em papel, por exemplo), e outra com o responsável; a pessoa **abre o cofre uma vez** para provar que funciona. Dispensados por enquanto: envelope lacrado, abertura por duas pessoas e cópia impressa dos runbooks. O restante deste documento é a versão completa, para quando a igreja quiser mais cuidado. Passo a passo: `operacao-enxuta.md`, Parte 4.

## 1. O formato

- Um arquivo **KeePassXC** (`.kdbx`), com senha mestra forte, **mais** um arquivo-chave guardado separado.
- **Duas cópias** em lugares diferentes: uma com a liderança (pendrive guardado na igreja) e outra com o responsável (fora da igreja). Atualize as duas juntas, sempre.
- A **senha mestra** fica num envelope lacrado, com a liderança. A abertura do envelope é registrada (data, quem, por quê).
- **Cópia impressa** dos runbooks desta pasta (`docs/runbooks/`), num envelope junto. O site pode estar fora do ar quando for preciso lê-los.

## 2. O que o cofre contém

| Entrada | Conteúdo | Para quê |
|---|---|---|
| cPanel / HostGator | Usuário, senha, e a recuperação do 2FA | Tudo o que roda na hospedagem; phpMyAdmin; cron |
| Domínio `pibls.com` | Registrador, usuário, senha, e a recuperação do 2FA | Renovação, DNS, e-mail |
| `.env` de produção e de homologação | Os arquivos completos (inclui `APP_KEY` e `APP_PREVIOUS_KEYS`) | **Perder a `APP_KEY` é perder os dados cifrados** (ADR-016) |
| **Chave privada dos backups** | O arquivo gerado por `pibls:backup:keygen` | **Sem ela os backups do B2 não abrem** (ADR-011) |
| Backblaze B2 | Login, o bucket, uma chave **de leitura** para restaurar | Baixar os backups |
| GitHub | Login do dono do repositório, os códigos de recuperação do 2FA | Código, deploy, rollback |
| FTP de deploy | Usuário e senha da conta dedicada | Rollback manual |
| Healthchecks, UptimeRobot, Sentry | Logins | Alertas e diagnóstico |
| E-mail institucional `pibls@pibls.com` | Login | Canal do titular (LGPD), recebe avisos |
| Primeira Igreja Batista em Lagoa Santa | CNPJ e dados do contador, se precisarem de algum serviço | |

## 3. Como a liderança usa

1. A liderança decide quem assume (uma pessoa de confiança, com algum conhecimento técnico).
2. Abre o cofre com a senha mestra do envelope, **na presença de duas pessoas da liderança**.
3. Entrega à pessoa o que ela precisa, **não o cofre inteiro**: na emergência, cPanel + GitHub + os runbooks impressos.
4. A pessoa segue `site-fora-do-ar.md` e `rollback.md` (restaurar: `restaurar-backup.md`, que usa a chave privada).
5. Depois do incidente: **troque todas as senhas e chaves que foram entregues** (`conta-comprometida.md`, itens 3 e 4) e gere um cofre novo.

## 4. Manutenção do kit

- **Semestral**: confira que o cofre abre, que cada entrada está atual, que a chave privada ainda abre um backup recente (teste de restauração trimestral) e que a cópia impressa dos runbooks é a última versão.
- A cada troca de senha ou chave (rotação anual, mudança de equipe): atualize as **duas** cópias do cofre no mesmo dia.
- Se alguém da liderança que guarda uma cópia sair, **troque a senha mestra** e entregue o cofre novo.

## 5. Registro da entrega (QA-04)

| Data | Quem recebeu a cópia da liderança | Local de guarda | Envelope com a senha mestra | Cópia impressa dos runbooks | Teste de abertura (data) |
|---|---|---|---|---|---|
| | | | | | |
