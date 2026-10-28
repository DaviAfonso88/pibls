# PIX alterado indevidamente (T132; RK-08, BR-060 a BR-063)

> **Quem faz:** a Tesouraria e o responsável técnico, juntos. **Meta:** a chave correta de volta no site em **até 30 minutos** depois do alerta.
> **Por que existe:** a chave PIX é o único dado do site que desvia dinheiro se for trocada. Por isso a troca exige a senha de novo (BR-060), gera auditoria com o valor anterior e o novo, e manda um e-mail para destinatários que **não estão no painel** (`PIX_ALERT_RECIPIENTS`, no `.env` do servidor): quem invade uma conta do painel não consegue silenciar o aviso.

## 1. Como a suspeita aparece

- Chegou o e-mail **"Atenção: os dados PIX do site foram alterados"** e a Tesouraria não reconhece a alteração (nem o nome de quem alterou, nem o horário).
- Alguém avisou que o QR Code ou a chave da página **Contribua** não é a da igreja.
- A conferência semanal da página **Contribua** (ver §6) achou uma chave ou favorecido diferente do cadastro no banco da igreja.

Quando o e-mail chega e a alteração **foi** feita pela Tesouraria, não há nada a fazer. Registre só se o nome do alerta e o do operador batem.

## 2. Primeiros 10 minutos: conferir e conter

1. **Abra a página Contribua** (`/contribua`) e compare, com o banco da igreja, a chave (CNPJ), o favorecido e o QR Code. Se estiverem certos, o alerta foi falso alarme: vá ao §5.
2. Se estiverem **errados**, a Tesouraria **corrige agora** em **Painel → PIX** (`/admin/pix`): informa a chave e o favorecido corretos, envia o QR Code e o Copia e Cola originais do aplicativo do banco e confirma com a **própria senha**. A página Contribua mostra o valor corrigido em até 1 minuto, e novo e-mail de alerta sai (ele é esperado: confirma a correção).
   - Se a Tesouraria **não consegue entrar** (senha trocada pelo invasor ou conta bloqueada), siga para o §3 antes de corrigir.
   - Se a tela do PIX responde **"Alteração bloqueada: os destinatários do alerta…"**, o `PIX_ALERT_RECIPIENTS` do servidor está vazio. Não há como alterar pelo painel até o administrador técnico preenchê-lo (§4). Isso é de propósito (BR-063).
3. **Avise** a liderança e a Secretaria por um canal que não seja o site (WhatsApp) para que ninguém use a chave errada até a correção. Se alguém já pagou na chave errada, **guarde o horário e o comprovante** e leve o caso ao banco (contestação do PIX) imediatamente; o prazo conta.

## 3. Descobrir como foi feito (30 minutos)

Faça **antes** de trocar senhas, para não apagar pistas. No **phpMyAdmin** (banco da aplicação):

```sql
-- Quem alterou o PIX e quando, do mais recente ao mais antigo
SELECT a.id, a.occurred_at, a.actor_user_id, u.name, u.email, a.ip_address, a.user_agent,
       a.correlation_id, a.changes
FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
WHERE a.action = 'pix.updated'
ORDER BY a.id DESC LIMIT 20;

-- Logins desse usuário na mesma janela (de onde, e se houve falhas antes)
SELECT occurred_at, action, ip_address, user_agent
FROM audit_logs
WHERE actor_user_id = :usuario_do_alerta AND action LIKE 'auth.%'
ORDER BY id DESC LIMIT 50;
```

- `changes.before` e `changes.after` mostram a chave e o favorecido anterior e o novo; `changes.fields` diz o que mudou (`pix_key`, `beneficiary_name`, `qr_image`, `copy_paste_code`).
- Um IP, país ou `user_agent` que a pessoa não usa, ou uma série de `auth.login_failed` antes do `auth.login_succeeded`, indica **conta comprometida**.
- Se o operador reconhece a alteração, foi erro humano: oriente e vá ao §5.

## 4. Conta comprometida: contenção completa

Siga também `conta-comprometida.md` (troca de senhas, rotação da `APP_KEY` e conferência do PIX). Resumo do que importa aqui:

1. **Desative o usuário** no phpMyAdmin (`UPDATE users SET is_active = 0 WHERE id = :id;`): a sessão dele cai na próxima requisição (BR-074). A aplicação não faz isso por você (BR-077).
2. **Troque a senha** da conta pelo `provisionar-usuario.md` (hash por `pibls:hash-password`). Trocar a senha encerra todas as sessões do usuário.
3. Revise **os outros usuários com `pix.write`** (`SELECT user_id FROM user_permissions WHERE permission_key = 'pix.write';`): só a Tesouraria deve ter. Se aparecer alguém a mais, remova com o `provisionar-usuario.md` e **investigue como entrou**: a aplicação nunca grava permissões.
4. **Confirme os destinatários do alerta**: o `.env` do servidor (`PIX_ALERT_RECIPIENTS`) deve ter só os e-mails da Tesouraria e da liderança. O `pibls:doctor` mostra se está preenchido. Se o `.env` foi alterado, trate como **comprometimento do servidor** (acesso ao cPanel) e troque a senha do cPanel e as chaves FTPS.
5. Reative a conta da Tesouraria só depois de trocada a senha, com o 2FA do cPanel conferido.

## 5. Depois do incidente

- Confirme que a página **Contribua** e o **QR Code** (escaneie com o aplicativo do banco) levam à conta da igreja, com o favorecido certo.
- Registre no resumo diário: horário do alerta, horário da correção, causa (erro humano, conta comprometida), quem foi avisado e se alguém pagou na chave errada.
- Se foi conta comprometida, avalie a revisão de senhas fracas e a obrigatoriedade do 2FA no cPanel (`architecture.md` → Security). Se foi erro humano, reforce que a troca da chave só é feita com o banco aberto ao lado.

## 6. Prevenção

- **Toda semana**, a Tesouraria abre `/contribua` e compara chave, favorecido e QR Code com o aplicativo do banco (2 minutos).
- O alerta de PIX **nunca** deve ir só para uma pessoa: mantenha no mínimo dois destinatários, e atualize `PIX_ALERT_RECIPIENTS` quando a Tesouraria ou a liderança mudar (`setup-hospedagem.md`).
- O e-mail de alerta depende da fila de e-mails (`emails-nao-chegam.md`): se o resumo diário mostrar falhas de envio, trate antes que o próximo PIX seja alterado.
- Nunca use a tela do PIX em computador compartilhado, e nunca salve a senha do painel no navegador.
