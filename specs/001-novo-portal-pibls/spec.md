# Feature Specification: Novo Portal PIBLS

**Feature Branch**: `001-novo-portal-pibls`  
**Created**: 2026-10-20  
**Status**: Draft  
**Input**: User description: "Novo Portal PIBLS: portal institucional público, hub de membros e ministérios e painel administrativo (R1 e R2), com o prd.md como contexto"

> **Contexto**: o produto, o problema, as personas e as métricas estão em `prd.md` (v0.1). Esta especificação **não copia** o PRD. Ela organiza o que o portal precisa fazer em jornadas testáveis e incorpora as decisões de produto da Etapa 3 de `architecture.md` (RF-D01 a RF-D09) como premissas. Decisões técnicas (stack, dados, APIs, infraestrutura) ficam no `architecture.md` e entram só no `/speckit.plan`.
>
> **Releases**: R1 (go-live, substitui o site atual) = Histórias 1 a 8 e 12. R2 (eventos e inscrições) = Histórias 9 a 11. O modelo de dados e as permissões cobrem R1 e R2 desde o início; o R2 fica desligado até ser ativado.

## Clarifications

### Session 2026-10-20

> Respostas tomadas pela opção recomendada, seguindo a orientação do responsável de adotar as recomendações. Precisam de confirmação; se alguma mudar, rodar `/speckit.clarify` de novo.

- Q: Como o membro "lê o boletim na tela"? → A: A página do boletim mostra o resumo em texto; "Ler boletim" abre o PDF no leitor nativo do aparelho (nova aba) e "Baixar PDF" faz o download. Não há leitor de PDF embutido no site.
- Q: O aviso da Ceia do Senhor é automático ou manual? → A: Manual. A Secretaria edita o texto e liga ou desliga o aviso no painel. O sistema não calcula a data do 1º domingo.
- Q: Haverá medição de uso do site e banner de cookies? → A: Haverá medição agregada de uso, sem cookies, sem identificar a pessoa e, portanto, sem banner de consentimento. A ferramenta é escolhida antes do go-live (TBD-09).
- Q: O que acontece com o texto digitado quando a sessão do painel expira? → A: Nos formulários de conteúdo (boletim, mensagem Palavra Viva e evento), o rascunho fica guardado no próprio navegador e é oferecido de volta após o novo login. Formulários com dados pessoais (atendimento de contatos, anotações, inscrições, PIX) nunca guardam nada no navegador.
- Q: Quais prazos de retenção o expurgo aplica? → A: Os prazos aprovados pela liderança em 2026-10-23 (TBD-03), como valores padrão configuráveis: pedido de oração 60 dias após concluído (90 dias se nunca concluído); demais contatos 12 meses após a última mudança de status; inscrições 3 meses após o término do evento; registros de auditoria 24 meses.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitante conhece a igreja e planeja a primeira visita (Priority: P1)

Uma pessoa que acabou de se mudar para Lagoa Santa encontra o site pelo Google ou por um link no WhatsApp, quase sempre pelo celular. Em menos de um minuto ela descobre os horários dos cultos, o endereço, o que a igreja crê, a programação para crianças e os grupos perto de casa, e decide visitar.

**Why this priority**: é a função principal do portal público e o que permite desligar o site atual. Sem ela, nenhuma outra jornada pública tem por onde começar.

**Independent Test**: com o conteúdo institucional inicial carregado, abrir cada página pública num celular com tela de 360 px. Conferir horários, endereço com mapa, história, ministérios e grupos. Compartilhar um link no WhatsApp e conferir a pré-visualização.

**Acceptance Scenarios**:

1. **Given** o conteúdo institucional está cadastrado, **When** o visitante abre a página inicial, **Then** vê:
   - a mensagem de boas-vindas;
   - o quadro de horários (Quinta 20h Culto de Oração; Domingo 9h EBD; Domingo 10h10 Culto Matinal; Domingo 19h30 Culto Noturno; 1ª sexta-feira 19h30 Culto Salt);
   - o destaque da campanha "Estamos Construindo", com chamada para a área PIX;
   - o aviso da Ceia do Senhor;
   - os botões do YouTube (ao vivo e canal) e do WhatsApp de atendimento.
2. **Given** a Secretaria alterou um horário no painel, **When** o visitante abre a página inicial, **Then** vê o horário novo em até 1 minuto, sem nova publicação do site.
3. **Given** a página "Como chegar", **When** o visitante a abre, **Then** vê:
   - o endereço completo;
   - um mapa, carregado só depois de tocar nele;
   - os botões "Abrir no Google Maps" e "Abrir no Waze".
4. **Given** a página "Quem somos", **When** o visitante a abre, **Then** vê:
   - a linha do tempo, com os marcos: fundação em 13/01/1985 no bairro Promissão, aquisição do terreno com apoio dos batistas norte-americanos, liderança pastoral atual desde fevereiro de 2012, e desabamento em 2018 com reconstrução em curso;
   - a idade da igreja ("N anos de fé e serviço"), sempre calculada a partir de 13/01/1985;
   - os 8 ex-pastores, na ordem do Guia Institucional;
   - a afiliação à Convenção Batista Brasileira, com acesso à Declaração de Fé;
   - a biografia do pastor titular.
5. **Given** o catálogo de ministérios, **When** o visitante toca em "Falar com este ministério", **Then** abre o formulário de contato com o ministério já selecionado.
6. **Given** a página de grupos, **When** o visitante filtra por perfil (Células de CL, Homens, Mulheres, Jovens e Adolescentes, Crianças), **Then** vê:
   - em cada grupo, o dia, o horário e o bairro (nunca o endereço residencial);
   - as células, filtráveis por bairro;
   - o lema da seção (1ª Pedro 4:10).
7. **Given** um grupo ou célula, **When** o visitante toca em "Quero participar", **Then** abre a Ficha de Visitante com o grupo já selecionado.
8. **Given** um link de uma página pública compartilhado no WhatsApp ou exibido num buscador, **When** a pré-visualização é gerada, **Then** mostra título, descrição e imagem daquela página.
9. **Given** um endereço inexistente, **When** o visitante o acessa, **Then** vê uma página amigável de "não encontrado", com links para Início, Horários e Contato.
10. **Given** os dados atualizáveis estão temporariamente indisponíveis, **When** o visitante abre uma página pública, **Then** vê o último conteúdo publicado com o aviso discreto "Algumas informações podem estar desatualizadas.".

---

### User Story 2 - Visitante ou membro envia um contato e a equipe certa é avisada (Priority: P1)

A pessoa preenche um dos cinco formulários: Ficha de Visitante, "Quero ser membro", pedido de oração, Fale conosco ou contato com um ministério. O contato fica registrado, e quem precisa atender é avisado por e-mail. A pessoa recebe uma confirmação clara de que alguém vai falar com ela.

**Why this priority**: mede o problema central do PRD (pessoas interessadas que se perdem) e alimenta a métrica primária (contatos de acolhimento concluídos em até 7 dias).

**Independent Test**: enviar um contato de cada tipo. Conferir que cada um ficou registrado com o status "Novo" e que o aviso chegou aos destinatários configurados para o tipo. Isso funciona mesmo antes de a caixa de entrada existir.

**Acceptance Scenarios**:

1. **Given** a Ficha de Visitante, **When** a pessoa informa nome, WhatsApp, bairro, se deseja receber visita, se deseja conhecer uma Célula de CL e aceita a Política de Privacidade, **Then** vê "Recebemos seu contato! Em breve alguém da nossa equipe vai falar com você." e o contato fica registrado como "Novo".
2. **Given** o formulário "Quero ser membro", **When** a pessoa informa nome, WhatsApp, e-mail opcional, se é membro de outra igreja batista e uma mensagem opcional, **Then** o contato é registrado e o aviso vai para os destinatários do tipo (pastor e secretaria).
3. **Given** o pedido de oração, **When** a pessoa envia só o texto do pedido, sem nome nem contato, **Then** o pedido é aceito como anônimo e o aviso vai para o Ministério de Oração **sem o texto do pedido**, só com o link para o painel.
4. **Given** o Fale conosco ou o contato com um ministério, **When** a pessoa não informa telefone nem e-mail, **Then** o envio é recusado com "Informe um telefone ou um e-mail para retorno.".
5. **Given** um contato com ministério, **When** ele é enviado, **Then** o aviso vai para o e-mail interno do ministério escolhido. Se o ministério não tiver e-mail, o aviso vai para a lista configurada para contatos de ministério.
6. **Given** qualquer formulário público, **When** a pessoa não marca a concordância com a Política de Privacidade, **Then** o envio é bloqueado com "Para enviar, você precisa concordar com a Política de Privacidade.".
7. **Given** um robô que preenche o campo oculto antispam, **When** envia o formulário, **Then** recebe a mesma mensagem de sucesso, mas nada é registrado.
8. **Given** muitos envios seguidos do mesmo local ou com o mesmo telefone, **When** o limite é ultrapassado, **Then** o envio é recusado com "Muitas tentativas. Tente novamente em alguns minutos.".
9. **Given** o envio de e-mail está falhando, **When** um contato é enviado, **Then** o contato continua registrado e visível no painel, a pessoa vê a confirmação normal e o aviso é reenviado automaticamente.
10. **Given** um tipo de contato sem destinatário configurado, **When** um contato desse tipo chega, **Then** ele fica registrado e visível no painel, e a tela de configurações mostra "O tipo X não tem destinatário de e-mail. Os contatos chegam só pelo painel.".

---

### User Story 3 - Operador entra no painel e vê só o que pode usar (Priority: P1)

Um voluntário da Comunicação, da Secretaria ou da Tesouraria, ou um líder de ministério, entra no painel com e-mail e senha. Ele vê só os módulos permitidos pelas permissões que o administrador técnico cadastrou fora da aplicação. Se esquecer a senha, cria uma nova sozinho.

**Why this priority**: todo o painel depende de acesso seguro e de autorização correta. É a base das Histórias 4 a 7 e 9 a 11.

**Independent Test**: provisionar um usuário por papel de referência, seguindo só o runbook. Entrar com cada um e conferir o menu e o bloqueio dos demais módulos. Testar a redefinição de senha e a desativação.

**Acceptance Scenarios**:

1. **Given** um usuário ativo, **When** entra com e-mail e senha corretos, **Then** vê a página inicial do painel com atalhos só para os módulos permitidos.
2. **Given** um e-mail inexistente, uma senha errada ou um usuário inativo, **When** alguém tenta entrar, **Then** vê exatamente a mesma mensagem: "E-mail ou senha inválidos.".
3. **Given** 5 tentativas falhas em 15 minutos para o mesmo e-mail e local, **When** há uma nova tentativa, **Then** ela é bloqueada por 15 minutos com "Muitas tentativas. Aguarde alguns minutos e tente novamente.".
4. **Given** "Esqueci minha senha", **When** o operador informa o e-mail, **Then** a resposta é sempre "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.". O link vale 60 minutos e pode ser usado uma só vez.
5. **Given** o link de redefinição, **When** o operador define uma senha com menos de 12 caracteres ou que já apareceu em vazamentos, **Then** a senha é recusada com a regra violada.
6. **Given** uma redefinição concluída, **When** a senha é trocada, **Then** todas as sessões abertas do usuário são encerradas e ele recebe o e-mail "Sua senha foi alterada".
7. **Given** uma sessão aberta, **When** passam 60 minutos sem uso ou 12 horas desde o login, **Then** a próxima ação leva ao login com "Sua sessão expirou. Entre novamente.".
8. **Given** um usuário desativado pelo administrador técnico com a sessão aberta, **When** faz a próxima ação, **Then** volta ao login.
9. **Given** um usuário sem uma permissão, **When** tenta abrir o módulo correspondente pelo endereço direto, **Then** vê "Você não tem acesso a esta área" e o sistema recusa a operação, independentemente do que a tela mostra.
10. **Given** um usuário com a permissão de ver o diretório, **When** abre o diretório, **Then** vê nome, e-mail, ministério, situação (ativo/inativo), papéis e permissões de todos os usuários, **somente para leitura**. Não há como criar, editar ou desativar usuários pela interface.
11. **Given** o administrador técnico alterou as permissões de um usuário fora da aplicação, **When** o usuário faz a próxima ação, **Then** a mudança já vale.

---

### User Story 4 - Equipe atende cada contato até a conclusão (Priority: P1)

A Secretaria abre a caixa de entrada, vê todos os contatos num só lugar, assume um contato, fala com a pessoa pelo WhatsApp e marca o andamento até concluir. Os pedidos de oração ficam numa caixa separada, visível só para o Ministério de Oração e a liderança pastoral.

**Why this priority**: sem acompanhamento, o contato registrado na História 2 continua podendo se perder. É o que torna a métrica primária mensurável.

**Independent Test**: com contatos de cada tipo registrados, entrar com os papéis Secretaria, Oração e Pastoral. Conferir o que cada um vê, mudar status, atribuir responsável e conferir o histórico.

**Acceptance Scenarios**:

1. **Given** contatos registrados, **When** a Secretaria abre a caixa geral, **Then** vê tipo, nome (ou "Anônimo"), data, status e responsável, do mais recente ao mais antigo. Pode filtrar por tipo, status, responsável e período, e buscar por nome ou telefone.
2. **Given** um contato em "Novo" há mais de 3 dias, **When** aparece na lista, **Then** é destacado com "Aguardando atendimento há N dias".
3. **Given** um contato aberto, **When** há telefone, **Then** o botão "Responder no WhatsApp" abre a conversa com o número da pessoa.
4. **Given** um contato em "Novo", **When** o operador o passa para "Em atendimento", **Then** precisa escolher o responsável (ele mesmo ou outro usuário com permissão de atender aquele tipo). O histórico registra o status anterior, o novo, o responsável, o autor e a data/hora.
5. **Given** as transições permitidas (Novo → Em atendimento; Novo → Concluído; Em atendimento → Concluído; Em atendimento → Novo; Concluído → Em atendimento), **When** o operador tenta outra transição, **Then** vê "Mudança de status não permitida.". Ao voltar para "Novo", o contato perde o responsável.
6. **Given** um pedido de oração, **When** um usuário que só pode ver os contatos gerais procura por ele, **Then** o pedido não aparece em nenhuma lista e, pelo endereço direto, aparece como "Contato não encontrado.".
7. **Given** um contato, **When** o operador escreve uma anotação interna de até 1.000 caracteres, com ou sem mudança de status, **Then** ela entra no histórico.
8. **Given** um contato atribuído a um usuário que foi desativado, **When** aparece na caixa, **Then** mostra o responsável com "(inativo)" e permite reatribuir.
9. **Given** um pedido do titular para apagar seus dados, **When** o operador com permissão de atendimento exclui o contato e confirma "Esta exclusão é definitiva e não pode ser desfeita. Confirmar?", **Then** o contato e o histórico somem para sempre. A ação fica registrada sem dados pessoais.

---

### User Story 5 - Comunicação publica boletins e mensagens; membros leem (Priority: P2)

O voluntário da Comunicação cadastra o boletim da semana com o PDF em poucos minutos, inclusive deixando-o agendado. O pastor ou a Comunicação publica mensagens Palavra Viva. Os membros encontram o boletim de uma data e leem no celular.

**Why this priority**: é conteúdo semanal de alto uso pelos membros e substitui uma função do site atual. Depende do acesso ao painel (História 3).

**Independent Test**: com um usuário de Comunicação, cadastrar, agendar, substituir e excluir boletins e mensagens. Conferir o reflexo nas páginas públicas e na pré-visualização de compartilhamento.

**Acceptance Scenarios**:

1. **Given** boletins publicados, **When** o membro abre a Central de Boletins, **Then** vê edição, data de referência, título e resumo, do mais recente ao mais antigo, 12 por página, com filtro por mês e ano.
2. **Given** um boletim, **When** o membro o escolhe, **Then** vê o resumo em texto. "Ler boletim" abre o PDF no leitor do próprio aparelho, e "Baixar PDF" faz o download.
3. **Given** a Central de Boletins sem nenhum boletim, **When** é aberta, **Then** mostra "Nenhum boletim publicado ainda." em vez de uma lista vazia.
4. **Given** o cadastro de boletim, **When** a Comunicação informa edição, data de referência, título, resumo e PDF, **Then** o boletim aparece no site a partir da data e hora de publicação escolhidas. Uma data futura deixa o boletim agendado e invisível até lá.
5. **Given** o cadastro de boletim, **When** a edição já existe, o arquivo não é um PDF de verdade ou tem mais de 10 MB, **Then** o cadastro é recusado, respectivamente com "Já existe um boletim com a edição N.", "O arquivo precisa ser um PDF." ou "O PDF pode ter no máximo 10 MB.".
6. **Given** um boletim publicado, **When** a Comunicação substitui o PDF ou exclui o boletim, **Then** o site passa a mostrar o novo arquivo, ou deixa de mostrar o boletim.
7. **Given** o cadastro de mensagem Palavra Viva, **When** o autor informa título, endereço da página, texto formatado, autor exibido, link opcional do YouTube e data de publicação, **Then** a mensagem aparece na seção Palavra Viva, da mais recente à mais antiga, 10 por página.
8. **Given** uma mensagem com vídeo, **When** o leitor abre a página, **Then** o vídeo só carrega depois de um toque, e o link compartilhado mostra título, resumo e imagem.
9. **Given** um texto com formatação fora da lista permitida (parágrafo, negrito, itálico, listas, links, citação e títulos), **When** é salvo, **Then** a formatação não permitida é removida e o editor avisa "Parte da formatação não é permitida e foi removida.".
10. **Given** um link de vídeo que não é do YouTube, **When** é salvo, **Then** é recusado com "Informe um link do YouTube.".

---

### User Story 6 - Membro contribui via PIX; Tesouraria mantém os dados com segurança (Priority: P2)

O membro abre a área PIX no celular e copia a chave com um toque para contribuir com dízimos, ofertas ou a construção. A Tesouraria atualiza os dados PIX pelo painel. Toda alteração exige a senha de novo, fica registrada e gera um alerta para o pastor e a Tesouraria.

**Why this priority**: apoia a campanha de reconstrução do templo. A chave PIX é o dado de maior valor financeiro do portal: uma troca indevida desvia contribuições em silêncio.

**Independent Test**: abrir a área PIX e copiar a chave num celular com e sem acesso à área de transferência. Com um usuário da Tesouraria, alterar os dados e conferir a reconfirmação de senha, o registro e o alerta.

**Acceptance Scenarios**:

1. **Given** os dados PIX cadastrados, **When** o membro abre a área PIX, **Then** vê:
   - o QR Code oficial;
   - o favorecido "Primeira Igreja Batista em Lagoa Santa" e a chave CNPJ;
   - o código "Pix Copia e Cola", se cadastrado;
   - um guia de 3 passos;
   - o versículo 2 Coríntios 9:7.
2. **Given** a área PIX, **When** o membro toca em "Copiar Chave PIX", **Then** a chave vai para a área de transferência e aparece "Chave copiada!" por alguns segundos.
3. **Given** um navegador sem acesso à área de transferência, **When** o membro tenta copiar, **Then** a chave fica selecionável, com a orientação "toque e segure para copiar".
4. **Given** um usuário da Tesouraria, **When** altera a chave, o favorecido, o QR Code ou o código Copia e Cola, **Then** precisa informar a senha de novo. Com a senha errada, nada muda: "Senha incorreta. Os dados PIX não foram alterados.".
5. **Given** uma alteração de PIX confirmada, **When** é gravada, **Then**:
   - o sistema registra quem alterou, quando, o valor anterior e o novo;
   - envia um alerta aos destinatários definidos fora do painel (pastor e Tesouraria);
   - a área PIX mostra os novos dados sem nova publicação do site.
6. **Given** os destinatários do alerta de PIX não estão configurados, **When** alguém tenta alterar os dados PIX, **Then** a alteração é bloqueada com "Alteração bloqueada: os destinatários do alerta de PIX não estão configurados no servidor. Fale com o administrador técnico.".
7. **Given** os dados informados, **When** a chave não é um CNPJ válido, o QR Code não é PNG ou JPEG com até 1 MB, ou o código Copia e Cola é inválido, **Then** a alteração é recusada com a mensagem do campo.

---

### User Story 7 - Secretaria mantém os dados institucionais atualizados sem desenvolvedor (Priority: P2)

A Secretaria e a Comunicação atualizam no painel, sem depender de desenvolvedor:
- horários e avisos;
- endereço e links;
- destinatários das notificações;
- ministérios, grupos e Células de CL.

**Why this priority**: garante a autonomia editorial (objetivo de negócio BG-3). Sem ela, o conteúdo da História 1 envelhece.

**Independent Test**: com um usuário da Secretaria, alterar cada configuração e cada tipo de item do catálogo. Conferir o reflexo nas páginas públicas em até 1 minuto e o registro de autoria.

**Acceptance Scenarios**:

1. **Given** as configurações do site, **When** a Secretaria edita o que segue, **Then** as mudanças aparecem no site em até 1 minuto:
   - o quadro de horários (até 20 itens);
   - os avisos da campanha e da Ceia;
   - o endereço;
   - os links de mapa;
   - o WhatsApp de atendimento;
   - os links do YouTube e das redes sociais.
2. **Given** os destinatários de notificação de um tipo de contato, **When** a Secretaria informa mais de 10 e-mails ou um e-mail inválido, **Then** a gravação é recusada com "Informe até 10 e-mails válidos.".
3. **Given** o catálogo, **When** a Secretaria cadastra ou edita um ministério, grupo ou Célula de CL, **Then** pode informar:
   - nome, atribuições, líderes e horário;
   - bairro (obrigatório para célula);
   - endereço residencial, visível só no painel;
   - telefone público e e-mail interno;
   - ordem de exibição e situação (ativo/inativo).
4. **Given** um grupo ou célula sem dia e horário, ou uma célula sem bairro, **When** é salvo, **Then** é recusado com "Informe dia e horário." ou "Informe o bairro.".
5. **Given** um item inativado, **When** o visitante abre o site, **Then** o item não aparece nas páginas nem nos formulários.
6. **Given** um item vinculado a usuários, eventos ou contatos, **When** alguém tenta excluí-lo, **Then** vê "Este item está vinculado a eventos, contatos ou usuários. Desative-o em vez de excluir.".
7. **Given** qualquer alteração de configuração ou de catálogo, **When** é gravada, **Then** o sistema registra o autor e a data/hora.

---

### User Story 8 - A igreja troca o site antigo sem perder e-mail, links nem histórico (Priority: P3)

A liderança aprova a troca do site atual pelo novo portal. O e-mail institucional continua funcionando, quem chega por um link antigo cai na página certa e o histórico de boletins definido pela Comunicação continua disponível.

**Why this priority**: é o marco do go-live do R1. Depende das Histórias 1 a 7 e 12 prontas e validadas em homologação.

**Independent Test**: ensaiar a troca e o retorno ao site antigo no ambiente de homologação. Conferir os redirecionamentos a partir do inventário de URLs e o envio e recebimento de e-mail antes e depois da troca.

**Acceptance Scenarios**:

1. **Given** a data do cutover, **When** a troca começa, **Then** já existem:
   - o portal validado pela Secretaria e pela Comunicação em homologação;
   - o inventário das URLs mais acessadas e dos registros de DNS do e-mail;
   - um backup completo do site antigo, guardado fora da hospedagem e com restauração conferida.
2. **Given** o cutover, **When** acontece, **Then** é dentro da janela de manutenção (segunda a quarta, das 9h às 18h), sem nenhuma alteração de nameservers ou de registros de e-mail.
3. **Given** a troca concluída, **When** o teste de envio e recebimento do e-mail institucional é feito, **Then** funciona, e os registros de DNS conferem com o inventário.
4. **Given** uma URL antiga relevante do inventário, **When** alguém a acessa, **Then** é redirecionado de forma permanente para a página nova correspondente. Uma URL antiga sem correspondente leva à página amigável de "não encontrado".
5. **Given** o go-live, **When** termina, **Then** o novo mapa do site é enviado ao buscador e os erros de "não encontrado" são acompanhados por 7 dias.
6. **Given** o escopo de conteúdo legado aprovado pela Comunicação, **When** é migrado, **Then** os boletins e as mensagens aparecem com as datas originais.
7. **Given** o site fora do ar, ou formulários e e-mail falhando sem correção em até 2 horas após a troca, **When** o retorno é acionado, **Then** o site antigo volta ao ar em até 15 minutos, sem alteração de DNS.
8. **Given** o site antigo desligado, **When** passam 30 dias estáveis, **Then** ele é arquivado fora da hospedagem e removido da conta. O arquivo é destruído 90 dias após o go-live. Contatos e usuários do site antigo não são migrados.

---

### User Story 9 - Líder de ministério cria e publica um evento com formulário de inscrição (Priority: P4, R2)

O líder da Juventude cria a página do acampamento com descrição, data, local, banner, número de vagas, prazo de inscrição e um formulário sob medida. Publica quando estiver pronto e divulga o link.

**Why this priority**: o construtor de formulários é a peça mais complexa do portal. Fica no R2 para não atrasar o go-live.

**Independent Test**: com um líder de ministério (escopo do próprio ministério) e um usuário da Comunicação (todos os ministérios), criar, editar, publicar, despublicar e tentar excluir eventos. Conferir as regras de escopo e de validação.

**Acceptance Scenarios**:

1. **Given** um líder com permissão no próprio ministério, **When** cria um evento, **Then** informa:
   - título e endereço da página;
   - ministério (obrigatoriamente o dele);
   - descrição, início, término opcional e local;
   - banner opcional (JPEG, PNG ou WebP, até 3 MB);
   - vagas (vazio = ilimitado) e prazo de inscrição opcional;
   - se o evento tem menores.
   O evento começa como rascunho.
2. **Given** o formulário de inscrição, **When** o líder o monta, **Then**:
   - pode ter até 30 campos;
   - os tipos são texto curto, texto longo, número, data, escolha única, múltipla escolha e sim/não;
   - cada campo pode ser obrigatório, ter texto de ajuda e mudar de ordem;
   - campos de escolha têm de 2 a 30 opções diferentes.
   Nome, telefone e e-mail do participante são campos fixos, sempre presentes.
3. **Given** um evento em rascunho, **When** o visitante procura eventos, **Then** o evento não aparece. **When** é publicado, **Then** aparece na lista de próximos eventos e tem página própria com pré-visualização de compartilhamento.
4. **Given** um líder com escopo do próprio ministério, **When** tenta ver ou alterar um evento de outro ministério, **Then** o evento aparece como "Evento não encontrado.".
5. **Given** as datas, **When** o término é anterior ao início ou o prazo de inscrição é posterior ao início, **Then** o evento é recusado com "O término precisa ser depois do início." ou "O prazo de inscrição precisa terminar antes do início do evento.".
6. **Given** um evento com inscrições, **When** o líder reduz as vagas abaixo do número de inscritos, **Then** vê "Já existem N inscritos; o número de vagas não pode ser menor.".
7. **Given** um evento com inscrições, **When** o líder remove um campo ou troca o tipo de um campo, **Then** precisa confirmar: "Este campo já tem respostas. As respostas existentes serão mantidas com o rótulo atual. Confirmar?". As respostas já dadas são preservadas com o rótulo da época.
8. **Given** um evento com inscrições, **When** alguém tenta excluí-lo, **Then** vê "Este evento tem inscrições e não pode ser excluído. Despublique-o.".
9. **Given** um evento com o prazo de inscrição vencido, **When** é publicado, **Then** o sistema avisa "O prazo de inscrição já passou; o evento será publicado com inscrições encerradas." e pede confirmação.
10. **Given** um evento publicado, **When** o líder escolhe "Encerrar inscrições", **Then** novas inscrições passam a ser recusadas imediatamente.

---

### User Story 10 - Participante se inscreve em um evento com garantia de vaga (Priority: P4, R2)

Um membro abre o link do evento no celular, preenche o formulário e garante a vaga. Ele recebe uma confirmação na tela e, se informou e-mail, por e-mail. Nunca há mais inscritos que vagas, mesmo quando muita gente se inscreve ao mesmo tempo logo após o anúncio no culto.

**Why this priority**: é o valor do R2 para os membros e para o líder (fim das planilhas manuais). Depende da História 9.

**Independent Test**: num evento com N vagas, fazer inscrições normais, duplicadas, com menores, fora do prazo e um envio simultâneo maior que as vagas. Conferir que exatamente N são aceitas.

**Acceptance Scenarios**:

1. **Given** um evento publicado com inscrições abertas, **When** o participante preenche os campos fixos e os personalizados e aceita a política, **Then**:
   - a inscrição é aceita;
   - ele vê o resumo da inscrição;
   - se informou e-mail, recebe a confirmação por e-mail.
2. **Given** a última vaga, **When** duas pessoas enviam a inscrição ao mesmo tempo, **Then** só uma é aceita, e a outra vê "Vagas esgotadas para este evento.".
3. **Given** uma pessoa já inscrita, **When** alguém tenta inscrever o mesmo nome com o mesmo telefone no mesmo evento, **Then** vê "Esta pessoa já está inscrita neste evento com este telefone.". Irmãos ou cônjuges com o mesmo telefone e nomes diferentes são aceitos.
4. **Given** um evento com menores, **When** a inscrição não traz o nome e o telefone do responsável legal e a autorização "Sou o responsável legal e autorizo a inscrição", **Then** é recusada com "Informe os dados do responsável legal e marque a autorização.".
5. **Given** o prazo de inscrição vencido ou o evento já iniciado, **When** alguém tenta se inscrever, **Then** vê "As inscrições para este evento estão encerradas.".
6. **Given** as vagas esgotadas, **When** o visitante abre a página do evento, **Then** vê "Inscrições encerradas — vagas esgotadas", sem o formulário.
7. **Given** uma resposta inválida (campo obrigatório vazio, opção inexistente, número fora dos limites), **When** é enviada, **Then** o erro aparece no campo, com a regra violada, antes e depois do envio.
8. **Given** um evento despublicado que já tinha inscrições, **When** o visitante abre a página, **Then** vê "Evento não encontrado", e as inscrições continuam acessíveis no painel.

---

### User Story 11 - Líder acompanha, exporta e cancela inscrições (Priority: P4, R2)

O líder vê a lista de inscritos com as respostas e o contador de vagas, exporta em planilha ou PDF para organizar transporte, alimentação e materiais, e cancela uma inscrição quando a pessoa desiste, o que libera a vaga.

**Why this priority**: completa o ciclo do evento e substitui a planilha manual. Depende da História 10.

**Independent Test**: num evento com inscrições, abrir a lista, exportar os dois formatos, abrir a planilha num editor de planilhas em português e cancelar uma inscrição.

**Acceptance Scenarios**:

1. **Given** um evento com inscrições, **When** o líder abre a lista, **Then** vê os campos fixos e as respostas na ordem do formulário, e o contador "X de Y vagas preenchidas".
2. **Given** a exportação em planilha, **When** o arquivo é aberto num editor de planilhas configurado em português, **Then** os acentos e as colunas aparecem certos. As colunas são:
   - data da inscrição, nome, telefone e e-mail;
   - os campos personalizados;
   - responsável e telefone do responsável, se o evento tiver menores.
3. **Given** a exportação em PDF, **When** é gerada para até 500 inscritos, **Then** sai em até 10 segundos, em A4 paisagem, com título, data, local e data de geração no cabeçalho.
4. **Given** um evento sem inscrições, **When** o líder exporta, **Then** o arquivo vem só com o cabeçalho.
5. **Given** uma inscrição, **When** o líder a cancela e confirma "A inscrição de {nome} será excluída definitivamente e a vaga liberada. Confirmar?", **Then** a inscrição é excluída para sempre e a vaga volta a ficar disponível.
6. **Given** um líder com escopo do próprio ministério, **When** tenta ver ou exportar inscritos de outro ministério, **Then** o evento aparece como "Evento não encontrado.".
7. **Given** qualquer exportação ou cancelamento, **When** acontece, **Then** fica registrado quem fez e quando, sem dados pessoais no registro.

---

### User Story 12 - Responsável técnico opera o portal com segurança e recupera falhas rápido (Priority: P3)

O responsável técnico, a única pessoa técnica do time, é avisado no celular quando o site cai ou uma rotina para. Ele publica versões novas só na janela de manutenção, volta à versão anterior em minutos e restaura os dados a partir de backups que já foram testados. Os dados pessoais vencidos são apagados automaticamente.

**Why this priority**: sustenta o RTO de até 4 horas, inclusive aos domingos, com uma pessoa só. Precisa estar pronto antes do go-live (História 8).

**Independent Test**: em homologação, simular uma queda e uma rotina parada e conferir os alertas. Publicar e reverter uma versão. Restaurar o banco e os arquivos a partir da cópia externa. Rodar o expurgo com datas simuladas.

**Acceptance Scenarios**:

1. **Given** o site fora do ar, **When** a falha persiste, **Then** o responsável recebe um alerta no celular e por e-mail em até 10 minutos, e um membro da liderança recebe o aviso por e-mail.
2. **Given** a rotina de envio de e-mails, de ativação de versões ou de backup parada, **When** passa o tempo de tolerância de cada uma, **Then** o responsável é alertado. O tempo de tolerância é de 15 min para e-mail e ativação, 30 min para o backup do banco e 2 h para a cópia externa.
3. **Given** um novo dia, **When** chega às 7h, **Then** o responsável recebe um resumo com:
   - a versão ativa;
   - os tempos de resposta comparados às metas;
   - os erros e os e-mails com falha definitiva;
   - a situação dos backups e o uso de disco;
   - os contatos parados há mais de 3 dias e as inscrições do dia.
   No dia 1 de cada mês, o resumo inclui também os contatos recebidos e concluídos por tipo.
4. **Given** a operação normal, **When** passa uma hora, **Then** existe uma cópia do banco na própria hospedagem. **When** passa um dia, **Then** existe uma cópia cifrada do banco e dos arquivos fora da hospedagem.
5. **Given** um backup externo, **When** o teste trimestral de restauração é feito, **Then** banco e arquivos voltam completos.
6. **Given** uma versão nova, **When** a publicação em produção é pedida fora da janela de manutenção, **Then** é recusada, exceto em correção de incidente justificada.
7. **Given** uma versão com defeito em produção, **When** o retorno é acionado, **Then** a versão anterior volta em até 10 minutos.
8. **Given** dados pessoais com o prazo de retenção vencido, **When** a rotina diária de expurgo roda, **Then** eles são excluídos de forma definitiva, e a quantidade excluída fica registrada sem dados pessoais.
9. **Given** um aviso por e-mail que falhou 5 vezes, **When** as tentativas se esgotam, **Then** ele aparece no resumo diário. Mais de 10 falhas definitivas em 1 hora geram alerta imediato por um canal que não depende do próprio e-mail.

---

### Edge Cases

- **Sessão e envios no painel**:
  - a sessão expira enquanto o operador preenche um formulário: aparece o aviso de sessão expirada, e o operador entra de novo. Num formulário de conteúdo (boletim, mensagem, evento), o rascunho é oferecido de volta: "Encontramos um rascunho não salvo. Deseja restaurar?". Nos demais formulários, o texto digitado se perde;
  - envio repetido (duplo clique): o botão fica desabilitado durante o envio. Contatos duplicados idênticos são aceitos e tratados pela equipe.
- **Conteúdo agendado e datas**:
  - boletim ou mensagem com data de publicação futura: fica agendado e só aparece no site a partir daquela data e hora;
  - datas e horas são sempre exibidas e digitadas no horário de Brasília, independentemente do fuso do aparelho.
- **Inscrições (R2)**:
  - evento despublicado com inscrições: as inscrições continuam no painel, e a página pública mostra "Evento não encontrado";
  - formulário de inscrição alterado depois de existirem inscrições: as respostas antigas são mantidas com o rótulo da época;
  - várias inscrições do mesmo telefone no anúncio do culto, com muita gente no mesmo Wi-Fi: os limites por local são altos o bastante para o anúncio, e o limite por telefone segura abusos.
- **Uploads**: arquivo com extensão `.pdf` mas conteúdo que não é PDF é recusado. Imagens enviadas perdem os metadados (como a localização do aparelho).
- **Contatos**:
  - pedido de oração anônimo: aparece como "Anônimo", sem botão de WhatsApp;
  - contato atribuído a usuário desativado: continua atribuído, marcado como "(inativo)", e pode ser reatribuído.
- **Falhas externas**:
  - serviço de e-mail fora do ar: contatos e inscrições continuam sendo registrados; os avisos esperam a próxima tentativa;
  - verificação de senha vazada indisponível: a senha é aceita se cumprir as demais regras, e o evento é registrado.
- **Navegador e aparelho**:
  - navegador sem acesso à área de transferência: a chave PIX fica selecionável para cópia manual;
  - aparelho abaixo do piso de navegadores suportado: o conteúdo aparece sem formatação, com o aviso "Seu navegador está desatualizado e esta página pode aparecer sem formatação.";
  - página aberta por muito tempo antes do envio: o sistema renova a proteção do formulário e reenvia uma vez; se falhar de novo, pede para recarregar a página.
- **Dados de terceiros**: o endereço residencial de uma Célula de CL nunca aparece em página pública, nem no código-fonte da página.
- **Listas vazias**: toda lista (mensagens, eventos, grupos filtrados, caixas de entrada, inscritos, boletins) mostra um estado vazio com texto e, quando fizer sentido, uma ação. Ex.: "Nenhuma mensagem publicada ainda.", "Nenhum contato com estes filtros.", "Nenhum evento programado no momento.".

## Requirements *(mandatory)*

### Functional Requirements

**Conteúdo público (História 1)**

- **FR-001**: O sistema MUST exibir na página inicial:
  - a mensagem de boas-vindas;
  - o quadro de horários;
  - os avisos da campanha "Estamos Construindo" e da Ceia do Senhor, quando ativos;
  - os botões do YouTube (ao vivo e canal) e do WhatsApp de atendimento.
- **FR-002**: O sistema MUST carregar horários, avisos, endereço, links, ministérios, grupos e dados PIX de dados editáveis no painel, nunca de texto fixo. Mudanças MUST aparecer no site em até 1 minuto, sem nova publicação.
- **FR-003**: O sistema MUST exibir a página "Como chegar" com:
  - o endereço completo;
  - um mapa carregado só depois de tocar nele;
  - os links "Abrir no Google Maps" e "Abrir no Waze".
- **FR-004**: O sistema MUST exibir a página "Quem somos" com:
  - a linha do tempo;
  - a idade da igreja, calculada a partir de 13/01/1985;
  - os 8 ex-pastores;
  - a afiliação à CBB, com acesso à Declaração de Fé;
  - a biografia do pastor titular.
  Esse conteúdo é fixo e muda só com nova publicação do site.
- **FR-005**: O sistema MUST exibir o catálogo de ministérios ativos, com nome, atribuições e líderes. Cada ministério MUST ter uma ação "Falar com este ministério".
- **FR-006**: O sistema MUST exibir grupos e Células de CL ativos, filtráveis por perfil, com dia, horário e bairro. As células MUST ser filtráveis por bairro. Cada item MUST ter a ação "Quero participar", que pré-seleciona o grupo na Ficha de Visitante.
- **FR-007**: O sistema MUST NOT expor em página pública, nem no código-fonte público, o endereço residencial das Células de CL, os destinatários de notificação nem qualquer dado interno.
- **FR-008**: As páginas públicas MUST ser indexáveis por buscadores. Cada uma MUST ter título, descrição e imagem para pré-visualização de compartilhamento, inclusive as páginas de evento e de mensagem criadas depois da publicação do site.
- **FR-009**: O sistema MUST publicar um mapa do site com as páginas fixas, os eventos publicados e as mensagens publicadas.
- **FR-010**: O sistema MUST mostrar uma página amigável de "não encontrado", com links para Início, Horários e Contato.
- **FR-011**: Quando os dados atualizáveis estiverem indisponíveis, o sistema MUST mostrar o último conteúdo publicado com o aviso "Algumas informações podem estar desatualizadas.". Se não houver conteúdo, MUST mostrar um estado de erro com "Tentar novamente" e o link do WhatsApp.
- **FR-012**: Vídeos do YouTube e mapas MUST carregar só depois da interação do visitante, para não instalar cookies de terceiros antes do toque.

**Contatos (História 2)**

- **FR-013**: O sistema MUST oferecer cinco tipos de contato, com os campos abaixo.

  | Tipo | Obrigatórios | Opcionais |
  |---|---|---|
  | Ficha de Visitante | Nome, WhatsApp, bairro, "Deseja receber uma visita?", "Deseja conhecer uma Célula de CL?" | Grupo pré-selecionado, mensagem |
  | Quero ser membro | Nome, WhatsApp, "É membro de outra igreja batista?" | E-mail, mensagem |
  | Pedido de oração | Texto do pedido | Nome e contato (pode ser anônimo) |
  | Fale conosco | Nome, mensagem, e telefone **ou** e-mail | — |
  | Contato com ministério | Nome, ministério ativo, mensagem, e telefone **ou** e-mail | — |

- **FR-014**: O sistema MUST validar os campos no navegador e de novo ao receber o envio. Regras:
  - nome: 2 a 120 caracteres, com pelo menos uma letra;
  - telefone: brasileiro, com DDD;
  - e-mail: formato válido;
  - mensagem: limites por tipo (pedido de oração de 5 a 4.000 caracteres; Fale conosco e ministério de 5 a 2.000; demais até 2.000).
- **FR-015**: Todo formulário público MUST exigir a concordância com a Política de Privacidade e registrar a data/hora e a versão da política aceita.
- **FR-016**: O sistema MUST proteger os formulários públicos sem custo e sem incomodar a pessoa:
  - campo oculto antispam: envio preenchido é descartado em silêncio, com resposta de sucesso;
  - limite de envios por local e por telefone ou e-mail;
  - proteção contra envio forjado de outro site.
- **FR-017**: Ao aceitar um contato, o sistema MUST registrá-lo com o status "Novo" e enfileirar, na mesma operação, um aviso por e-mail para cada destinatário do tipo. O tipo "contato com ministério" vai para o e-mail interno do ministério e, sem ele, para a lista do tipo.
- **FR-018**: O aviso de pedido de oração MUST NOT conter o texto do pedido; só o tipo, a data e o link para o painel.
- **FR-019**: Uma falha no envio de e-mail MUST NOT impedir o registro do contato nem mudar a confirmação mostrada à pessoa. O aviso MUST ser reenviado automaticamente, até 5 tentativas.
- **FR-020**: Um tipo de contato sem destinatário MUST continuar recebendo contatos, que ficam visíveis no painel. O sistema MUST avisar a situação na tela de configurações.

**Acesso ao painel (História 3)**

- **FR-021**: O sistema MUST autenticar operadores ativos por e-mail (sem diferenciar maiúsculas) e senha, com a mesma mensagem de erro para e-mail inexistente, senha errada ou usuário inativo.
- **FR-022**: O sistema MUST bloquear por 15 minutos o login de um e-mail num mesmo local após 5 falhas em 15 minutos, e limitar as tentativas por local.
- **FR-023**: A sessão MUST expirar após 60 minutos sem uso e 12 horas após o login. Ao entrar, o identificador de sessão MUST ser trocado. Ao sair, a sessão MUST ser encerrada no servidor.
- **FR-024**: O sistema MUST permitir a redefinição de senha por autoatendimento:
  - a resposta é sempre a mesma, exista ou não o e-mail;
  - o link é de uso único e vale 60 minutos;
  - a nova senha tem de 12 caracteres a 72 bytes e não pode estar entre as senhas vazadas conhecidas;
  - ao concluir, todas as sessões do usuário são encerradas e ele recebe o aviso por e-mail.
- **FR-025**: O sistema MUST conferir em toda ação do painel se o usuário continua ativo e se tem a permissão exigida. Sem permissão, MUST recusar a ação, independentemente do que a tela mostra.
- **FR-026**: O painel MUST mostrar só os módulos permitidos ao usuário. Um acesso direto a um módulo sem permissão MUST mostrar "Você não tem acesso a esta área".
- **FR-027**: As permissões MUST ser aditivas: o usuário recebe a união das permissões dos seus papéis. As permissões "do próprio ministério" MUST valer só para registros do ministério vinculado ao usuário e MUST NOT conceder acesso a um usuário sem ministério vinculado.
- **FR-028**: O sistema MUST oferecer o diretório de usuários somente para leitura (nome, e-mail, ministério, situação, papéis e permissões), visível só com a permissão própria.
- **FR-029**: O sistema MUST NOT criar, editar, desativar ou excluir usuários, papéis ou permissões pela interface. O provisionamento é feito pelo administrador técnico fora da aplicação, com um procedimento documentado e um utilitário local para gerar a senha inicial.

**Atendimento de contatos (História 4)**

- **FR-030**: O sistema MUST oferecer duas caixas de entrada:
  - a geral, com Ficha de Visitante, Quero ser membro, Fale conosco e contato com ministério;
  - a de pedidos de oração.
  Cada caixa tem permissões próprias de leitura e de atendimento. Pedidos de oração MUST NOT aparecer na caixa geral e, para quem não tem a permissão, MUST aparecer como "não encontrado".
- **FR-031**: As caixas MUST listar tipo, nome (ou "Anônimo"), data, status e responsável, com:
  - filtros por tipo, status, responsável e período;
  - busca por nome ou telefone;
  - ordem do mais recente para o mais antigo;
  - 25 itens por página.
- **FR-032**: O sistema MUST destacar contatos em "Novo" há mais de 3 dias, com o texto "Aguardando atendimento há N dias".
- **FR-033**: O sistema MUST permitir só estas transições de status: Novo → Em atendimento; Novo → Concluído; Em atendimento → Concluído; Em atendimento → Novo; Concluído → Em atendimento.
- **FR-034**: Ao passar para "Em atendimento", o operador MUST indicar um responsável ativo com permissão de atendimento do tipo. Ao voltar para "Novo", o responsável MUST ser removido.
- **FR-035**: Toda mudança de status, troca de responsável ou anotação interna (até 1.000 caracteres) MUST entrar no histórico do contato, com autor e data/hora.
- **FR-036**: O contato aberto MUST mostrar todos os campos, o histórico e, quando houver telefone, o botão "Responder no WhatsApp".
- **FR-037**: Um operador com permissão de atendimento MUST conseguir excluir um contato em definitivo, a pedido do titular, após confirmação. A ação MUST ser registrada sem dados pessoais.

**Boletins e Palavra Viva (História 5)**

- **FR-038**: O sistema MUST listar os boletins publicados por data de referência, do mais recente ao mais antigo, 12 por página. Cada item mostra edição, data de referência, título e resumo. A lista MUST ter filtro por mês e ano e um estado vazio amigável.
- **FR-039**: O membro MUST ver o resumo do boletim em texto, abrir o PDF no leitor nativo do aparelho (nova aba) e baixar o PDF. O site MUST NOT embutir um leitor de PDF próprio.
- **FR-040**: O sistema MUST permitir cadastrar, editar, substituir o PDF e excluir boletins, com:
  - edição única (inteiro positivo);
  - data de referência;
  - título de 3 a 150 caracteres;
  - resumo de até 5.000 caracteres;
  - PDF verdadeiro com até 10 MB;
  - data/hora de publicação, com padrão "agora".
- **FR-041**: Boletins e mensagens com data de publicação futura MUST ficar invisíveis no site até aquela data e hora, sem ação manual.
- **FR-042**: O sistema MUST permitir cadastrar, editar e excluir mensagens Palavra Viva, com:
  - título de 3 a 150 caracteres;
  - endereço de página único;
  - texto formatado de até 50.000 caracteres;
  - autor exibido opcional;
  - link opcional do YouTube;
  - data/hora de publicação.
  As mensagens publicadas são listadas da mais recente à mais antiga, 10 por página.
- **FR-043**: Todo texto formatado MUST ser limpo antes de gravar, mantendo só parágrafo, quebra de linha, negrito, itálico, listas, links (com proteção de abertura em nova aba), citação e títulos de dois níveis. O editor MUST avisar quando algo for removido.
- **FR-044**: Boletins e mensagens excluídos MUST sumir do site e continuar recuperáveis pelo administrador técnico.

**PIX (História 6)**

- **FR-045**: A área PIX MUST exibir:
  - o QR Code;
  - o favorecido e a chave CNPJ;
  - o código Copia e Cola, se cadastrado;
  - o botão "Copiar Chave PIX", com a confirmação "Chave copiada!" e o fallback de seleção manual;
  - o guia de 3 passos;
  - o versículo 2 Coríntios 9:7.
- **FR-046**: A alteração dos dados PIX MUST exigir:
  - a permissão própria de PIX;
  - a reconfirmação da senha do usuário na mesma operação;
  - CNPJ com dígitos verificadores válidos;
  - QR Code PNG ou JPEG com até 1 MB;
  - código Copia e Cola válido, quando informado.
- **FR-047**: Toda alteração de PIX MUST registrar o valor anterior, o novo, o autor e a data/hora, e enviar um alerta aos destinatários definidos fora do painel. Sem esses destinatários configurados, a alteração MUST ser bloqueada.

**Dados institucionais (História 7)**

- **FR-048**: O sistema MUST permitir editar:
  - o quadro de horários: até 20 itens, cada um com dia ou recorrência, atividade, horário e modalidade;
  - o aviso da campanha: título até 80 e texto até 500 caracteres, ativo/inativo;
  - o aviso da Ceia: texto até 300 caracteres, ligado e desligado manualmente (sem cálculo automático de data);
  - o endereço, com CEP de 8 dígitos;
  - os links de mapa;
  - o WhatsApp de atendimento;
  - os links do YouTube e das redes sociais;
  - os destinatários de notificação por tipo: até 10 e-mails válidos, nunca expostos ao público.
- **FR-049**: O sistema MUST permitir cadastrar, editar, ordenar, ativar, desativar e excluir ministérios, grupos e Células de CL. Regras:
  - grupos e células exigem dia e horário; células exigem bairro;
  - o endereço residencial é visível só no painel;
  - um item vinculado a usuários, eventos ou contatos MUST NOT ser excluído, só desativado.
- **FR-050**: Toda criação, alteração ou exclusão de conteúdo, configuração ou catálogo MUST registrar autor e data/hora.

**Eventos e inscrições — R2 (Histórias 9 a 11)**

- **FR-051**: O sistema MUST permitir cadastrar eventos, sempre ligados a um ministério ativo, com:
  - título e endereço de página único;
  - descrição formatada de até 20.000 caracteres;
  - início, término opcional (não anterior ao início) e local;
  - banner opcional (JPEG, PNG ou WebP, até 3 MB);
  - vagas opcionais (vazio = ilimitado);
  - prazo de inscrição opcional (até o início);
  - indicação de menores;
  - situação rascunho ou publicado.
- **FR-052**: O sistema MUST oferecer um construtor de formulário com até 30 campos personalizados, com chave única e estável, rótulo, tipo, obrigatoriedade, texto de ajuda, limites e opções.
  - Tipos: texto curto, texto longo, número, data, escolha única, múltipla escolha e sim/não.
  - Campos de escolha têm de 2 a 30 opções sem repetição.
  - Nome, telefone e e-mail do participante são fixos.
- **FR-053**: O sistema MUST aplicar estas regras de alteração:
  - vagas não podem ficar abaixo do número de inscritos;
  - evento com inscrições não pode ser excluído, só despublicado;
  - remover campo ou trocar o tipo de um campo com inscrições exige confirmação, e as respostas antigas são preservadas com o rótulo da época;
  - publicar com prazo vencido exige confirmação;
  - "Encerrar inscrições" encerra no mesmo instante.
- **FR-054**: Um operador com permissão do próprio ministério MUST ver e alterar só eventos e inscrições desse ministério. Os demais MUST aparecer como inexistentes.
- **FR-055**: O sistema MUST aceitar inscrição só em evento publicado, antes do início, dentro do prazo e com vaga. A garantia MUST valer também em envios simultâneos: nunca há mais inscrições que vagas.
- **FR-056**: O sistema MUST recusar uma segunda inscrição com o mesmo telefone e o mesmo nome (sem diferenciar maiúsculas e acentos) no mesmo evento, e aceitar nomes diferentes com o mesmo telefone.
- **FR-057**: Em evento com menores, a inscrição MUST exigir o nome e o telefone do responsável legal e a autorização expressa dele.
- **FR-058**: As respostas MUST ser validadas contra o formulário vigente e guardadas com o rótulo do campo no momento da inscrição.
- **FR-059**: Após a inscrição, o sistema MUST mostrar o resumo e, se houver e-mail, enfileirar a confirmação. Uma falha no e-mail MUST NOT desfazer a inscrição.
- **FR-060**: O sistema MUST listar os inscritos com os campos fixos e as respostas na ordem do formulário, e o contador "X de Y vagas preenchidas".
- **FR-061**: O sistema MUST exportar os inscritos em planilha e em PDF:
  - planilha: abre corretamente num editor em português (acentos e separador de colunas), com cabeçalho;
  - PDF: A4 paisagem, com cabeçalho do evento;
  - ambos têm as mesmas colunas, e um evento sem inscrições gera o arquivo só com o cabeçalho.
- **FR-062**: O sistema MUST permitir cancelar uma inscrição pelo painel após confirmação. O cancelamento exclui o registro em definitivo e libera a vaga.
- **FR-063**: O módulo de eventos MUST poder ficar desligado no R1 e ser ativado no R2 sem migração de dados.

**Privacidade e LGPD**

- **FR-064**: O sistema MUST guardar cifrados os conteúdos sensíveis:
  - mensagens e pedidos;
  - anotações internas;
  - respostas de inscrição;
  - endereço residencial das células.
  Esses dados MUST NOT aparecer em registros técnicos, em ferramentas de erro, em endereços de página ou em e-mails.
- **FR-065**: O sistema MUST excluir de forma definitiva, por rotina diária, os dados pessoais com prazo de retenção vencido, e registrar só as quantidades. Os prazos padrão, configuráveis sem nova versão do código, são:
  - pedido de oração: 60 dias após concluído, ou 90 dias após o envio se nunca for concluído;
  - demais contatos: 12 meses após a última mudança de status;
  - inscrições: 3 meses após o término (ou o início, se não houver término) do evento;
  - registros de auditoria: 24 meses.
- **FR-066**: A Política de Privacidade MUST ficar publicada e versionada. Todo consentimento registrado MUST apontar a versão vigente no momento do envio.
- **FR-076**: A medição de uso do site MUST ser agregada, sem cookies e sem identificar a pessoa, para dispensar banner de consentimento. O site MUST NOT carregar rastreadores de terceiros.
- **FR-077**: Nos formulários de conteúdo do painel (boletim, mensagem Palavra Viva e evento), o sistema MUST guardar o rascunho no próprio navegador enquanto o operador digita e oferecê-lo de volta após um novo login. O rascunho MUST ser apagado ao salvar com sucesso ou ao descartar. Formulários com dados pessoais (atendimento de contatos, anotações, inscrições, PIX) MUST NOT guardar nada no navegador.

**Operação, migração e confiabilidade (Histórias 8 e 12)**

- **FR-067**: O sistema MUST fazer:
  - uma cópia do banco a cada hora, na própria hospedagem;
  - uma cópia diária cifrada do banco e dos arquivos fora da hospedagem.
  A cópia externa MUST ser protegida contra exclusão por quem invadir a hospedagem.
- **FR-068**: O responsável técnico MUST receber alertas automáticos nos seguintes casos:
  - queda do site;
  - certificado perto do vencimento;
  - rotinas paradas (e-mail, ativação, backups);
  - onda de falhas de e-mail.
  Ele MUST receber também um resumo diário às 7h.
- **FR-069**: A publicação em produção MUST acontecer só de segunda a quarta, das 9h às 18h, salvo correção de incidente justificada. O retorno à versão anterior MUST levar no máximo 10 minutos.
- **FR-070**: A troca do site antigo MUST:
  - preservar nameservers e registros de e-mail;
  - redirecionar de forma permanente as URLs antigas relevantes;
  - manter o site antigo recuperável em até 15 minutos por 30 dias.
- **FR-071**: O sistema MUST permitir importar o conteúdo legado aprovado (boletins e mensagens) preservando as datas originais.

**Acessibilidade, idioma e compatibilidade**

- **FR-072**: Site e painel MUST atender WCAG 2.1 nível AA:
  - contraste;
  - texto redimensionável até 200%;
  - navegação por teclado com foco visível;
  - textos alternativos;
  - rótulos sempre visíveis nos formulários;
  - erros ligados ao campo.
- **FR-073**: Site e painel MUST funcionar a partir de 360 px de largura e nas duas últimas versões de Chrome, Safari (iOS), Edge, Firefox e Samsung Internet. Em navegadores abaixo do piso suportado, o sistema MUST exibir o aviso de navegador desatualizado.
- **FR-074**: Toda a interface, os e-mails e as mensagens de erro MUST estar em português do Brasil. Datas e horas MUST ser exibidas e digitadas no horário de Brasília. Os formatos são dd/MM/aaaa, HH:mm, telefone (31) 99999-8888 e CNPJ 00.000.000/0000-00.
- **FR-075**: Os formulários públicos que falharem por limite, conflito ou instabilidade MUST mostrar a mensagem e uma ação sugerida: "Tentar novamente" ou "Falar no WhatsApp". Erros inesperados MUST mostrar um código para a pessoa repassar à equipe.

### Key Entities *(include if feature involves data)*

- **Usuário do painel**: pessoa da equipe que entra no painel.
  - Dados: nome, e-mail único, ministério vinculado (opcional), situação (ativo/inativo), datas de último login e de troca de senha.
  - Criado e alterado só fora da aplicação.
- **Papel e Permissão**: o papel agrupa permissões no provisionamento (ex.: Comunicação, Secretaria). A permissão é o direito atômico conferido em cada ação. Catálogo com 14 permissões, incluindo variantes "do próprio ministério".
- **Ministério / Grupo / Célula de CL**: item do catálogo institucional.
  - Dados: categoria, nome, atribuições, líderes, horário, bairro, endereço residencial (privado), telefone público, e-mail interno, ordem e situação.
  - É referenciado por usuários, contatos e eventos.
- **Boletim**: publicação semanal identificada pela edição.
  - Dados: data de referência, título, resumo, PDF, data de publicação, autoria.
  - Exclusão recuperável.
- **Mensagem Palavra Viva**: texto pastoral.
  - Dados: título, endereço de página, texto formatado, resumo, autor exibido, vídeo opcional, data de publicação, autoria.
  - Exclusão recuperável.
- **Configurações do site**: horários, avisos, endereço, links, WhatsApp, redes e destinatários de notificação (privados). Cada configuração é pública ou interna.
- **Dados PIX**: favorecido, chave CNPJ, imagem do QR Code e código Copia e Cola. Toda alteração tem auditoria e alerta.
- **Contato**: mensagem recebida por formulário público.
  - Dados: tipo, campos por tipo, status, responsável, ministério ou grupo relacionado, consentimento (data e versão).
- **Registro de atendimento**: histórico do contato. Pode ser mudança de status, troca de responsável ou anotação interna, sempre com autor e data/hora.
- **Evento** (R2): atividade com página pública.
  - Dados: ministério, datas, local, banner, vagas, prazo, indicação de menores, situação e formulário de inscrição.
- **Campo personalizado** (R2): item do formulário de inscrição, com chave estável, rótulo, tipo, obrigatoriedade, opções e limites.
- **Inscrição** (R2): registro de um participante num evento.
  - Dados: nome, telefone, e-mail, responsável legal e autorização (se houver menores), respostas com o rótulo da época, consentimento.
  - Única por evento, telefone e nome.
- **Notificação**: e-mail gerado pelo sistema e posto na fila de envio, com tentativas e registro de falha definitiva.
- **Registro de auditoria**: registro imutável de uma ação relevante (quem, o quê, quando, de onde), sem dados pessoais do público.
- **Consentimento**: aceite da Política de Privacidade, com data/hora e versão.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em teste de usabilidade com 5 pessoas que não conhecem a igreja, pelo menos 4 encontram, pelo celular e em menos de 1 minuto, o horário do próximo culto e o endereço.
- **SC-002**: As páginas públicas exibem o conteúdo principal em até 2,5 s em 75% das visitas por celular em rede 4G. Antes do go-live, a meta é medida em laboratório (perfil de celular com 4G simulado); depois, com dados de campo, assim que houver tráfego suficiente.
- **SC-003**: Pelo menos 90% das Fichas de Visitante e dos "Quero ser membro" chegam a "Concluído" em até 7 dias após o envio, medido 30, 60 e 90 dias após o go-live.
- **SC-004**: A mediana do tempo entre o envio de um contato e a primeira mudança de status é de até 48 horas.
- **SC-005**: Um voluntário da Comunicação publica o boletim da semana, com PDF, em até 15 minutos sem ajuda, no teste de usabilidade.
- **SC-006**: Em pelo menos 90% das semanas, o boletim está publicado até domingo às 8h.
- **SC-007**: 100% das alterações de horários, líderes, células, PIX, boletins e eventos são feitas pela própria equipe no painel, sem desenvolvedor.
- **SC-008**: Zero mensagens de e-mail institucional perdidas e zero alterações de nameservers ou registros de e-mail durante a troca do site.
- **SC-009**: O tráfego vindo de buscadores cai no máximo 20% nos 60 dias após a troca, em relação à linha de base anterior.
- **SC-010**: O custo mensal adicional de infraestrutura é zero.
- **SC-011**: Zero alterações de dados PIX sem alerta ao pastor e à Tesouraria.
- **SC-012**: Com 100 pessoas usando o site ao mesmo tempo, 95% das consultas respondem em até 0,8 s, 95% dos envios em até 1,5 s, e menos de 1% das requisições falham.
- **SC-013**: Num evento com 250 vagas que recebe 300 tentativas de inscrição em 15 minutos, exatamente 250 inscrições são aceitas.
- **SC-014**: A exportação em PDF de 500 inscritos termina em até 10 segundos num computador de referência: notebook de entrada com 4 GB de RAM e navegador atual.
- **SC-015**: Depois de uma falha, o site volta ao ar em até 4 horas, inclusive aos domingos. A perda máxima de dados é de 1 hora, ou de 24 horas se a hospedagem inteira for perdida.
- **SC-016**: As páginas públicas e as telas principais do painel não têm violação de acessibilidade grave ou crítica. Em teste com 2 a 3 membros com mais de 60 anos, todos completam sem ajuda as tarefas de achar o horário, ler o boletim e copiar a chave PIX.
- **SC-017**: Pelo menos 80% das inscrições dos eventos do R2 são feitas pelo portal, em vez de planilha ou papel.
- **SC-018**: Zero incidentes de vazamento de dados pessoais.
- **SC-019**: 95% dos avisos por e-mail de contatos e inscrições chegam aos destinatários em até 10 minutos após o envio.

## Assumptions

- **Fatiamento**: R1 = Histórias 1 a 8 e 12; R2 = Histórias 9 a 11, ativado depois do go-live. Dados e permissões cobrem os dois desde o início.
- **Público**: o site não distingue visitante de membro. Não há área logada de membros. O login existe só para a equipe.
- **Conteúdo**:
  - é fixo no código, com mudança só por nova publicação: história, linha do tempo, ex-pastores, biografia pastoral, texto sobre a CBB e Política de Privacidade;
  - todo o resto é editável no painel.
- **Conteúdo inicial**: vem do Guia Institucional e é revisado pela Secretaria em homologação. Itens ainda sem resposta não mudam a estrutura (TBD-11): confirmação do PIX por finalidade e dos campos de "Quero ser membro". Endereço, lista de ministérios, Declaração de Fé e fotos já foram informados (2026-10-23).
- **PIX**: uma única chave para dízimos, ofertas e construção, até a Tesouraria decidir outra coisa.
- **Pedido de oração**: pode ser anônimo; nome e contato são opcionais.
- **Endereço das Células de CL**: nunca é público. O contato acontece pela ficha ou pelo WhatsApp.
- **Avisos por e-mail**: saem por uma rotina automática, com até cerca de 5 minutos de atraso, inclusive o link de redefinição de senha.
- **Inscrição duplicada**: medida por telefone + nome. Pagamento, lista de espera e inscrição de grupos ficam fora do escopo.
- **Sessão do painel**: 60 minutos de inatividade e 12 horas no máximo, sem verificação em duas etapas nesta versão.
- **Retenção de dados pessoais**: os prazos do FR-065 são padrões configuráveis, aprovados pela liderança em 2026-10-23 (TBD-03).
- **Medição de uso**: sem cookies e sem banner (FR-076). A ferramenta é escolhida antes do go-live (TBD-09).
- **Direitos do titular**: a exclusão é feita pelo painel (FR-037, FR-062). Acesso e portabilidade são atendidos pelo procedimento documentado do administrador técnico, sem tela própria, com resposta em até 15 dias.
- **Contatos do site antigo**: não são migrados (sem consentimento compatível). O escopo do conteúdo legado é definido pela Comunicação (TBD-08).
- **Ambiente e carga**:
  - a operação técnica é de uma pessoa, com apoio de um agente de código;
  - o envelope de carga é de 100 pessoas simultâneas e 300 inscrições na primeira hora de um evento grande.

## Dependencies

| Dependência | Responsável | Bloqueia |
|---|---|---|
| Prova de desempenho da plataforma na hospedagem atual (TBD-05) | Responsável pelo projeto | Início da construção dos módulos (**bloqueante**) |
| Política de Privacidade, textos de consentimento e canal do titular (TBD-06): texto aprovado em 2026-10-23; falta a data de vigência | Liderança pastoral | Go-live |
| Aprovação dos prazos de retenção (TBD-03): aprovados em 2026-10-23 | Liderança pastoral | Concluída |
| Conteúdo institucional pendente (TBD-11): faltam a confirmação do PIX (Q-11) e dos campos de "Quero ser membro" (Q-13) | Secretaria, Comunicação, Tesouraria | Carga inicial e páginas fixas |
| Escopo do conteúdo legado e inventário do site atual (TBD-08) | Comunicação + administrador técnico | ≥ 30 dias antes do go-live |
| Identidade visual (TBD-10) | Comunicação | Páginas finais (até lá, paleta neutra) |
| Ferramenta de métricas de uso (TBD-09) | Responsável + liderança | Go-live |
| Limites e versões da conta de hospedagem (TBD-01, TBD-02, TBD-04) | Administrador técnico | Prova de desempenho |
| Condições dos planos gratuitos de alertas, erros e backup (TBD-07) | Responsável pelo projeto | Backups externos |
| Consentimento específico para dados de saúde nas inscrições (TBD-12): decidido, `FormField.sensitive` + `health_consent_at` (ADR-020, BR-083); falta a confirmação da liderança | Responsável pelo projeto + liderança | Construtor de formulário do R2 (História 9) |
| Linha de base de buscas e acessos do site atual | Administrador técnico | Medição do SC-009 |

## Out of Scope

- Criação ou edição de usuários e permissões pela interface.
- Área logada de membros, cadastro completo de membros, frequência ou dízimos individuais.
- Pagamento online (gateway, cartão, boleto, conciliação de PIX); o PIX é só exibido e copiado.
- Lista de espera, inscrição de grupos ou famílias e pagamento de inscrição em eventos.
- Transmissão ou hospedagem de vídeo própria (o portal só incorpora o YouTube).
- Aplicativo nativo, automação de WhatsApp, comentários públicos, fórum.
- Multi-idioma, infraestrutura paga e mudança de provedor de e-mail ou DNS.
- Verificação em duas etapas no painel, tela de auditoria e painel de indicadores (melhorias futuras).
