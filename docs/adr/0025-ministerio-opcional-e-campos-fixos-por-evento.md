# ADR-025 — Ministério responsável opcional e campos fixos da inscrição ligados por evento

- **Status:** Aceita
- **Data:** 2026-10-29 (pedido do responsável)

## Contexto

A arquitetura define que todo evento pertence a um ministério (RF-D01, CAP-14: `ministry_id` obrigatório) e que o formulário de inscrição sempre pede nome completo e WhatsApp (obrigatórios) e e-mail (opcional) (CAP-06, "Campos fixos"). A duplicidade (BR-022) é medida por telefone + nome normalizado.

Na prática, a igreja tem eventos que não são de um ministério (um culto especial, uma confraternização geral) e eventos em que um ou mais desses dados não fazem sentido: um café da manhã que só conta cabeças não precisa de telefone, e um evento interno pode dispensar o e-mail. O responsável pediu:

1. ministério responsável **opcional**;
2. uma chave por evento para mostrar ou não **nome completo, telefone e e-mail** no formulário;
3. o rótulo "WhatsApp" do formulário de inscrição trocado por **"Telefone"**.

## Decisão

**Ministério opcional; o evento sem ministério é um evento geral.**

- `events.ministry_id` passa a aceitar `NULL` (migration *expand*; a FK `fk_events_ministry` continua, com `ON DELETE RESTRICT`).
- Quem tem `eventos.write` pode criar e deixar o evento sem ministério, e também tirar o ministério de um evento.
- O evento geral **entra no escopo de quem tem `.own`** (pedido do responsável, na mesma entrega): o líder de ministério o vê na lista, edita, publica, exclui e troca o banner. Com `eventos.inscricoes.read.own`, também vê, exporta e cancela as inscrições dele, e elas aparecem nas "Inscrições de hoje".
- Com `eventos.write.own`, o líder pode criar evento geral, deixar geral um evento do próprio ministério e trazer um evento geral para o próprio ministério. Levar um evento para **outro** ministério continua recusado (403), e o evento de outro ministério continua 404.
- Nas policies, o `ministry_id` nulo do evento chega ao `PermissionGate`, que o trata como "sem escopo" e libera quem tem `.own`. A BR-075 vem antes: `.own` sem ministério vinculado não acessa nada, nem os eventos gerais. As listas com `.own` filtram `ministry_id = <do usuário> OR ministry_id IS NULL`.

**Campos fixos ligados por evento.**

- Três colunas booleanas em `events`: `asks_participant_name`, `asks_phone` e `asks_email`, todas com padrão `1`. Os eventos que já existem continuam pedindo os três.
- Campo ligado: nome e telefone são obrigatórios e o e-mail é opcional, como antes (BR-004).
- Campo desligado: não aparece no formulário, não é validado, e o servidor **descarta** o valor mesmo que ele venha no pedido.
- `event_registrations.participant_name`, `participant_name_normalized` e `phone` passam a aceitar `NULL` (migration *expand*).
- **BR-022 só vale quando o evento pede o nome e o telefone.** A constraint única `(event_id, phone, participant_name_normalized)` não compara linhas com `NULL`, então, sem um dos dois, a repetição não é barrada. O painel avisa disso ao desligar a chave.
- E-mail desligado: não há e-mail de confirmação (`confirmation_email_queued: false`).
- Onde o nome aparece no painel (inscritos, "Inscrições de hoje", cancelamento, CSV e PDF), a ausência vira "—" ou um texto sem nome ("Cancelar esta inscrição?").

**Rótulo.** No formulário de inscrição de evento, "WhatsApp" vira "Telefone". Os formulários de contato (CAP-05) não mudam.

## Alternativas consideradas

- **Ministério "Geral" cadastrado como um ministério comum:** não muda o schema, mas aparece nos filtros e no site como se fosse um ministério de verdade, e os líderes com `.own` desse ministério passariam a gerenciar os eventos gerais.
- **Evento geral só para quem tem `eventos.write`** (primeira versão desta decisão): ficava fora do escopo de `.own` (404), mas o responsável quis que os líderes vissem e gerenciassem os eventos gerais.
- **Líder vê o evento geral, mas só lê:** exigiria uma permissão nova de leitura, e o BR-077 proíbe criar permissões ou mexer nos papéis pelo sistema.
- **Campos fixos dentro do `form_schema`:** unifica tudo em perguntas, mas nome e telefone têm regra própria (formato, normalização, BR-022) e colunas próprias; mover para o JSON cifrado quebraria a constraint de duplicidade e a busca dos inscritos.
- **Manter o nome e o telefone sempre obrigatórios e tornar só o e-mail opcional:** não atende o pedido.

## Consequências

- *Positivas:* atende eventos gerais e formulários mais curtos; a mudança é *expand* (nada é apagado) e os eventos antigos se comportam como antes.
- *Negativas:* em evento sem nome ou sem telefone, a mesma pessoa pode se inscrever mais de uma vez; o painel mostra inscrições sem identificação; qualquer líder com `.own` pode editar, excluir (sem inscrições) e cancelar inscrições de um evento geral, inclusive os criados pela Comunicação, e vê os dados pessoais dos inscritos desses eventos. A auditoria registra quem fez cada alteração.
- *A observar:* se surgirem muitas inscrições repetidas em eventos sem nome ou telefone, avaliar outra chave de duplicidade (por exemplo, e-mail) numa ADR nova.
