# Pedido de um titular de dados (LGPD)

> Origem: `architecture.md` → Data Privacy Strategy, BR-080/BR-081 e a Política de Privacidade (versão 1.0). **Prazo de resposta: 15 dias** corridos a partir do pedido. Canal do titular: **pibls@pibls.com**. Quem atende: a Secretaria (contatos) e a Pastoral (pedidos de oração), com o responsável técnico no que exigir banco ou backup.

## 1. Que direitos o titular tem

A pessoa pode pedir **acesso** (ver o que guardamos), **correção**, **portabilidade** (receber os dados em formato legível), **eliminação** e a **revogação do consentimento** (LGPD, art. 18). Os dados que o portal guarda são só os que ela mesma enviou: nome, telefone ou e-mail, bairro, mensagem ou pedido de oração e, nos eventos, as respostas da inscrição.

## 2. Passo a passo

### 2.1 Registrar e confirmar quem pede

1. Anote **data e hora** do pedido (o prazo de 15 dias conta daí) e o que a pessoa quer: ver, corrigir, receber ou excluir.
2. **Confirme a identidade** antes de mostrar ou apagar qualquer coisa: responda para o mesmo telefone ou e-mail que consta no contato, nunca para outro. Pedido de oração anônimo não tem como ser ligado a ninguém: explique isso.
3. Não peça documento além do necessário para confirmar que o pedido vem de quem enviou os dados.

### 2.2 Localizar os dados

1. Painel → **Contatos** e **Pedidos de oração**: use o campo **Buscar por nome ou telefone** (a mensagem é cifrada e não é pesquisável; o nome e o telefone são).
2. Abra cada registro encontrado: ficam visíveis os dados, o histórico de atendimento e as anotações da equipe.
3. Se a pessoa se inscreveu em eventos (R2), procure também em **Eventos → Inscritos**.
4. Registros duplicados (a pessoa enviou mais de uma vez) contam todos.

### 2.3 Responder ao pedido

| Pedido | O que fazer |
|---|---|
| **Acesso** | Envie, para o contato confirmado, uma cópia do que consta (campos do registro e do histórico). Não inclua anotações internas que citem terceiros. |
| **Portabilidade** | O mesmo, em arquivo legível (PDF ou planilha) com os campos, a data e o tipo de cada registro. |
| **Correção** | Altere o campo no painel (se a sua permissão permitir) e confirme à pessoa. |
| **Eliminação** | Veja 2.4. |
| **Revogar o consentimento** | Equivale a pedir a eliminação: o consentimento é a base do tratamento. |

### 2.4 Eliminar (BR-081)

1. Em cada registro, no fim da tela: **Excluir dados desta pessoa**. Marque *"Confirmo que a própria pessoa pediu a exclusão"* e confirme em **Excluir definitivamente**. O painel avisa: a exclusão é definitiva. O histórico de atendimento sai junto.
2. Só quem tem a permissão de gestão do tipo de contato vê o botão. Se for pedido de oração e a sua conta não tem a permissão, peça à Pastoral.
3. A auditoria registra **a ação** (quem, quando, tipo e motivo) e **nenhum dado pessoal** do titular.
4. Confira que a busca por telefone e nome não acha mais nada.

### 2.5 O que ainda fica por um tempo: os backups

A exclusão no banco **não apaga** o dado dos backups já feitos. Eles expiram sozinhos: **35 dias** nos diários (local: 48 h) e **12 meses** nos mensais, e ficam cifrados (só a chave privada do responsável os abre). Diga isto à pessoa na resposta e **não restaure um backup antigo sobre o banco em produção** sem reaplicar as exclusões feitas depois dele (`restaurar-backup.md`).

### 2.6 Responder dentro de 15 dias

Responda por escrito, no canal do titular, dizendo o que foi feito (ou por que não foi possível, p. ex. identidade não confirmada). Guarde a resposta.

## 3. Registro do pedido

Mantenha uma planilha restrita à Secretaria e ao responsável técnico, **sem copiar os dados pessoais**:

| Data do pedido | Tipo de pedido | Resolvido em | Quem atendeu | Observação |
|---|---|---|---|---|
| | | | | |

## 4. Retenção automática (para explicar à pessoa)

O expurgo diário apaga sozinho, sem pedido: pedidos de oração **60 dias depois de concluídos** (90 se nunca concluídos), demais contatos **12 meses depois de concluídos**, inscrições **3 meses depois do evento**. A auditoria guarda só as quantidades.

## 5. Quando chamar o responsável técnico

- A pessoa diz ter enviado dados que você não acha (confira o telefone com e sem máscara e variações do nome; o resumo diário e o log não guardam dado pessoal).
- Pedido que envolve um vazamento: `conta-comprometida.md`, item 6.
- Dúvida jurídica (menor de idade, pedido de terceiros, ordem judicial): leve à liderança.
