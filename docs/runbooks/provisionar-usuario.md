# Provisionar, alterar e desativar usuários do painel (T093; BR-077)

> **Quem faz:** o administrador técnico, no **phpMyAdmin** (cPanel). A aplicação **nunca** cria, altera nem apaga usuários e permissões: ela só lê `users`, `user_permissions`, `permissions` e `role_templates`, e só grava a senha e as datas de login do próprio usuário (redefinição de senha e login). Não existe tela nem rota para isso, de propósito. Este runbook é o único caminho.

## O que você precisa

- Acesso ao phpMyAdmin do banco da aplicação (usuário `pibls_migrator` ou o do cPanel).
- Uma máquina com **PHP 8.4 e a pasta `backend/`** do projeto (a sua, não o servidor: o servidor não tem SSH). Serve também o Docker do projeto (`docker compose up -d`).
- O **e-mail** da pessoa (minúsculas, sem espaços), o **nome** e o **papel** (ver a tabela abaixo).
- Para o papel de líder de ministério: o **id do ministério** (`SELECT id, name FROM ministries_groups WHERE category = 'MINISTERIO' ORDER BY name;`).

## Papéis de referência

Cada papel é um modelo em `role_templates`; o que vale para o usuário é a cópia em `user_permissions` (permissões **aditivas**: quem tem dois papéis tem a união).

| Papel (`role_code`) | Pode | Precisa de ministério? |
|---|---|:-:|
| `COMUNICACAO` | Boletins, Palavra Viva, eventos e inscrições, ministérios/grupos, configurações | Não |
| `SECRETARIA` | Contatos gerais (ver e atender), inscrições, ministérios/grupos, configurações | Não |
| `TESOURARIA` | Dados PIX | Não |
| `ORACAO` | Pedidos de oração (ver e atender) | Não |
| `PASTORAL` | Ver contatos e pedidos de oração, Palavra Viva, diretório de usuários | Não |
| `LIDER_MINISTERIO` | Eventos e inscrições **só do próprio ministério** | **Sim** (BR-075) |
| `ADMIN_TECNICO` | Só o diretório de usuários na aplicação (menor privilégio) | Não |

A lista exata de permissões de cada papel está em `SELECT role_code, permission_key FROM role_templates ORDER BY 1, 2;`. Uma permissão terminada em `.own` sem `users.ministry_id` preenchido **não concede nada** (BR-075).

## 1. Criar um usuário

### 1.1 Gerar o hash da senha inicial

Na sua máquina, dentro de `backend/`:

```bash
php artisan pibls:hash-password
# ou, com o Docker do projeto:
docker compose exec app php artisan pibls:hash-password
```

O comando pede a senha **sem mostrá-la** (duas vezes), confere a política (12 caracteres ou mais, até 72 bytes, fora das senhas vazadas) e imprime **só o hash** bcrypt (`$2y$12$…`). A senha em si nunca aparece em tela, arquivo ou log.

- Gere uma senha **forte e única** e entregue-a à pessoa por um canal seguro, **separado** do e-mail com o endereço do painel. Peça que ela use "Esqueci minha senha" na primeira entrada e escolha a dela.
- Copie o hash inteiro (começa com `$2y$12$` e tem 60 caracteres).

### 1.2 Inserir o usuário e as permissões

No phpMyAdmin → banco da aplicação → aba **SQL**. Troque os valores entre `<…>` e rode as **duas** instruções juntas (na ordem):

```sql
INSERT INTO users (name, email, password, ministry_id, is_active, created_at, updated_at)
VALUES ('<Nome Sobrenome>', '<email@exemplo.com>', '<hash $2y$12$…>', NULL, 1, NOW(), NOW());

INSERT INTO user_permissions (user_id, role_code, permission_key)
SELECT LAST_INSERT_ID(), role_code, permission_key
FROM role_templates
WHERE role_code = '<PAPEL>';
```

- `<PAPEL>` é um dos `role_code` da tabela acima, em maiúsculas.
- Para `LIDER_MINISTERIO`, troque o `NULL` de `ministry_id` pelo **id do ministério** do líder.
- O e-mail é único (`uq_users_email`) e fica em **minúsculas**.

### 1.3 Conferir

```sql
SELECT u.id, u.name, u.email, u.is_active, u.ministry_id, up.role_code, up.permission_key
FROM users u JOIN user_permissions up ON up.user_id = u.id
WHERE u.email = '<email@exemplo.com>'
ORDER BY up.permission_key;
```

Depois entre no painel com a pessoa (ou peça que entre) e confira que **o menu mostra só os módulos do papel**. Se a pessoa não vê nada, falta a linha em `user_permissions`.

## 2. Dar mais de um papel

Repita **só a segunda instrução** com o outro papel, usando o `id` do usuário no lugar de `LAST_INSERT_ID()`:

```sql
INSERT IGNORE INTO user_permissions (user_id, role_code, permission_key)
SELECT <id do usuário>, role_code, permission_key
FROM role_templates
WHERE role_code = '<OUTRO PAPEL>';
```

`INSERT IGNORE` evita erro se alguma permissão já existir (a chave única é `user_id + role_code + permission_key`). A mudança vale na **requisição seguinte** do usuário, sem sair e entrar.

## 3. Trocar o papel ou o ministério

```sql
-- Tirar um papel
DELETE FROM user_permissions WHERE user_id = <id> AND role_code = '<PAPEL A TIRAR>';

-- Mudar o ministério do líder
UPDATE users SET ministry_id = <novo id>, updated_at = NOW() WHERE id = <id>;
```

Para trocar `COMUNICACAO` por `SECRETARIA`, tire um e dê o outro (seção 2).

## 4. Desativar (desligamento)

```sql
UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = <id>;
```

O efeito é **imediato, na requisição seguinte** (BR-074): a aplicação confere `is_active` em toda requisição, então mesmo uma sessão aberta recebe "Sua sessão expirou. Entre novamente." e a pessoa não consegue entrar de novo. Não apague a linha: o histórico (responsável por contatos, auditoria) aponta para ela. Para reativar, `is_active = 1`.

Se o desligamento tiver risco (conta comprometida), **encerre também as sessões e invalide a senha**:

```sql
DELETE FROM sessions WHERE user_id = <id>;
UPDATE users SET password = '<outro hash gerado e descartado>' WHERE id = <id>;
```

## 5. Redefinição de senha (para a pessoa, sem você)

A própria pessoa usa **"Esqueci minha senha"** na tela de entrada. O link chega por e-mail, vale **60 minutos**, funciona **uma vez**, e ao trocar a senha todas as sessões dela são encerradas. Só usuários ativos recebem o link. Se o e-mail não chegar, confira `failed_jobs` e a pasta de spam antes de gerar um hash manual (seção 1.1 + `UPDATE users SET password = …`).

## 6. Auditoria e limites

- Entradas, falhas de login, saídas, pedidos de redefinição e trocas de senha ficam em `audit_logs` (`auth.*`), sem e-mail nem senha.
- Bloqueio de login: **5 falhas em 15 minutos** para o mesmo e-mail e IP bloqueiam esse par por 15 minutos ("Muitas tentativas. Aguarde alguns minutos e tente novamente."). Para liberar antes, aguarde ou peça que a pessoa entre de outra rede; não há tela de desbloqueio.
- Sessão: 60 minutos sem atividade ou 12 horas depois da entrada, o que vier primeiro.

## 7. O que nunca fazer

- Nunca grave senha em texto puro: sempre o hash de `pibls:hash-password`.
- Nunca edite `permissions` e `role_templates` pelo phpMyAdmin sem uma migration: o catálogo é do código (as 14 chaves estão no enum `PermissionKey`).
- Nunca compartilhe uma conta entre pessoas: a auditoria perde o sentido.
