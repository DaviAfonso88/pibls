# ADR-028 — Ajuste da matriz dos papéis de referência (Secretaria, Pastoral, Administrador técnico)

- **Status:** Aceita
- **Data:** 2026-11-09 (pedido do responsável)

## Contexto

A matriz inicial dos 7 papéis de referência (`role_templates`) deu à Secretaria os contatos, mas não os boletins; à Pastoral só a leitura de contatos e de pedidos de oração, mais o diretório de usuários; e ao administrador técnico só `users.read`. O responsável pediu três ajustes.

## Decisão

| Papel | Adiciona | Remove |
|---|---|---|
| `SECRETARIA` | `boletins.write` | — |
| `PASTORAL` | `leads.manage`, `leads.oracao.manage` | `users.read` |
| `ADMIN_TECNICO` | `settings.write` | — |

- O catálogo de 14 chaves (`permissions`) e o enum `PermissionKey` não mudam. Muda só o **modelo** de cada papel.
- **Seed e migration:** `database/data/initial_content.php` traz a matriz nova (bancos novos). A migration `2026_11_09_100000_adjust_role_templates_for_secretaria_pastoral_admin` aplica a diferença em bancos que já têm o seed original; é idempotente e tem `down()`. Continua valendo a BR-077: nenhum código da aplicação escreve em `role_templates`.
- **Quem já existe não muda sozinho.** O que vale para o usuário é a cópia em `user_permissions`. O administrador técnico aplica o ajuste por SQL, no phpMyAdmin (`docs/runbooks/provisionar-usuario.md`, seção 3).
- **Painel:** nada a mudar no código. O menu e as telas já são decididos por `permissions` vindas do servidor (BR-076).

## Alternativas consideradas

- **Editar a migration de seed original:** não re-executa em bancos que já a rodaram, então produção ficaria com a matriz antiga.
- **Propagar para `user_permissions` na própria migration:** apagaria ajustes feitos à mão por usuário; a decisão de quem recebe o quê fica com o administrador técnico.

## Consequências

- *Positivas:* a Secretaria publica boletins; a Pastoral atende contatos e pedidos de oração; o administrador técnico corrige configurações sem recorrer ao banco.
- *Negativas:* a Pastoral deixa de ver o diretório de usuários (`/admin/usuarios`); os testes que usavam a Pastoral como leitora do diretório passam a usar o administrador técnico.
- *A observar:* o administrador técnico passa a poder alterar configurações gerais (endereço, programação, destinatários de notificação). A auditoria de `settings` continua registrando quem alterou.
