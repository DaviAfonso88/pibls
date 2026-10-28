# Conta comprometida

> Origem: `architecture.md` → Security (ADR-011, ADR-016) e Observability. Use quando houver suspeita de que alguém **de fora** obteve acesso: senha vazada ou phishing, notebook perdido, e-mail suspeito de redefinição de senha, alteração de PIX que ninguém fez, login estranho na auditoria, aviso do GitHub ou da HostGator.
> **Regra de ouro:** primeiro **contenha** (cortar o acesso), depois **investigue**, por último **recupere**. Não apague logs nem a tabela `audit_logs`: são a prova do que aconteceu.

## 1. Qual conta?

| Conta | Vá para |
|---|---|
| Um usuário do painel (Secretaria, Tesouraria, Comunicação…) | 2 |
| A conta do cPanel / HostGator, ou o `.env` do servidor | 3 |
| O GitHub (repositório, Actions, segredos de deploy) | 4 |
| O Backblaze B2 (backups) ou a chave privada dos backups | 5 |
| Suspeita de alteração do PIX | `pix-alterado-indevidamente.md` primeiro, depois este |

## 2. Usuário do painel

1. **Desative o usuário e encerre as sessões** no phpMyAdmin (a aplicação nunca altera `users`: BR-077; procedimento completo em `provisionar-usuario.md`, seção 4):
   ```sql
   UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = <id>;
   DELETE FROM sessions WHERE user_id = <id>;
   UPDATE users SET password = '<hash gerado com pibls:hash-password e descartado>' WHERE id = <id>;
   ```
   O efeito é imediato, na requisição seguinte. Invalidar a senha impede que o link de redefinição que o invasor tenha pedido ainda sirva.
2. Quando a pessoa estiver segura, ela usa **"Esqueci minha senha"** para escolher uma nova (o link vale 60 minutos, uma vez, e encerra as outras sessões).
3. Investigue na auditoria (phpMyAdmin → `audit_logs`, ordenado por `occurred_at` desc):
   ```sql
   SELECT occurred_at, action, resource_type, resource_id, ip_address
   FROM audit_logs WHERE actor_user_id = <id> AND occurred_at >= '<data do suspeito>' ORDER BY occurred_at;
   ```
   Procure `auth.login_succeeded` de IP estranho, `pix.updated`, `lead.erased`, `setting.updated` e `bulletin.*`.
4. Desfaça o estrago: o PIX volta pelo painel (Tesouraria, com a senha dela); conteúdo alterado volta pelo painel; contato excluído **não volta** (só pelo backup: `restaurar-backup.md`).
5. Reative (`UPDATE users SET is_active = 1`) só depois de confirmar que o e-mail dele está seguro e que a senha nova foi escolhida por ele.
6. Se houve acesso a **contatos** (dados pessoais): veja o item 6 (LGPD).

## 3. Conta da hospedagem ou `.env` exposto

1. cPanel → troque a **senha do cPanel**, do **FTP de deploy**, do **usuário do banco** e do **e-mail** da conta. Ative o 2FA no cPanel.
2. Troque a senha do banco **nos dois lugares**: cPanel (usuário MySQL) e `DB_PASSWORD` (e `DB_MIGRATOR_PASSWORD`) no `.env`.
3. **Rotacione a `APP_KEY`** (ADR-016: os campos 🔒 são cifrados com ela):
   1. Gere uma chave nova com `php artisan key:generate --show` numa máquina local.
   2. No `.env` do servidor: `APP_PREVIOUS_KEYS=<a chave antiga>` e `APP_KEY=<a nova>`. O Laravel lê com a nova e **decifra com as duas**, então nada é perdido.
   3. Guarde as duas no KeePassXC. **Perder a `APP_KEY` é perder os dados 🔒** (mensagens de contato, anotações, respostas de inscrição).
   4. Os dados antigos continuam cifrados com a chave antiga até serem regravados; mantenha a antiga em `APP_PREVIOUS_KEYS` até a janela anual.
4. Troque `MAIL_PASSWORD`, os URLs do Healthchecks (`HEALTHCHECKS_*`), o DSN do Sentry e a `UPTIMEROBOT_API_KEY`.
5. Encerre todas as sessões do painel: no phpMyAdmin, `DELETE FROM sessions;` (todos terão de entrar de novo).
6. Procure arquivos que não são nossos: `public_html/` e `uploads/` (arquivos `.php` em `uploads/` nunca devem existir; o `.htaccess` de lá nega execução). Se achar, apague e **reinstale a release** pelo pipeline.
7. Confira o PIX (`/contribua` e `/admin/pix`) e o histórico (`pix-alterado-indevidamente.md`).

## 4. GitHub

1. Troque a senha e **revogue sessões e tokens** (Settings → Sessions, Developer settings → Personal access tokens). Confirme o 2FA.
2. Settings → Environments (`homolog`, `production`): **rotacione os segredos** (usuário e senha do FTP de deploy, `BASIC_AUTH` da homologação). Troque também a senha do FTP de deploy no cPanel, para casar.
3. Veja Actions → o histórico de execuções e Settings → Audit log, atrás de pushes ou workflows que não foram seus.
4. Se um commit malicioso entrou: não faça deploy; reverta por PR e só publique depois do CI verde. Se já foi ao ar: `rollback.md`.

## 5. Backups (B2 e chave privada)

- **Chave de aplicação do B2 vazou:** o invasor só consegue **gravar e listar** (a chave não tem permissão de exclusão): o pior é encher a cota ou ver nomes de arquivo. Crie uma chave nova (sem exclusão), troque `B2_KEY_ID` e `B2_APPLICATION_KEY` e apague a antiga no painel do B2.
- **Chave privada dos backups vazou:** quem a tem **abre todos os backups que baixar**. Gere um par novo (`php artisan pibls:backup:keygen`, na sua máquina), ponha a pública nova em `BACKUP_PUBLIC_KEY` e guarde a privada nova no KeePassXC. Os backups antigos continuam abríveis só com a chave antiga: guarde-a até eles vencerem (35 dias nos diários, 12 meses nos mensais) e trate os mensais como expostos.
- **A conta B2 inteira foi tomada:** o invasor pode apagar. Assuma que os backups externos se perderam, gere um backup completo agora (`pibls:backup:db`) e baixe-o pelo cPanel para a sua máquina, até recompor a conta.

## 6. Dados pessoais foram expostos? (LGPD)

Se houve acesso a contatos, inscrições ou à caixa de pedidos de oração:

1. Descubra **quais registros** e **quando** (item 2.3 e o log).
2. A liderança decide, com orientação jurídica, a **comunicação aos titulares e à ANPD** (LGPD, art. 48): em geral em prazo razoável, com a descrição do incidente e das medidas.
3. Registre o incidente: data, o que foi acessado, o que foi feito. Não registre os dados pessoais em si.

## 7. Depois

- Revise os acessos (usuários ativos × pessoas na equipe) e o kit de contingência (`kit-de-contingencia.md`).
- Faça um teste de restauração do backup (`restaurar-backup.md`) para confirmar que os backups seguem íntegros.
- Escreva o que aprendeu e, se for decisão de arquitetura, uma ADR.
