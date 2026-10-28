# Conteúdo institucional (fonte para o seed e as páginas fixas)

> Extraído em 2026-10-20 de **https://pibls.com** (páginas Início, Conheça a Igreja e Como Chegar) e do **Guia Institucional** (`docs/Guia Institucional - (PIBLS).pdf`, 3 páginas). Alimenta `backend/database/data/initial_content.php` (T025) e as páginas das T062 a T065 e T080.
>
> Regra do projeto: o que **não** aparece nas duas fontes continua pendente (TBD-11) e entra no seed como `TODO(TBD-11)`. Nada foi inventado. Antes do go-live, a Secretaria confere cada valor abaixo.

## Identidade

| Item | Valor | Fonte |
|---|---|---|
| Nome | Primeira Igreja Batista em Lagoa Santa (PIBLS) | site, guia |
| Fundação | 13 de janeiro de 1985, no bairro Promissão | site, guia |
| Lema do site atual | "40 anos de fé e serviço"; "As pessoas, de fato, importam para nós!" | guia |
| Afiliação | Convenção Batista Brasileira (CBB) | site, guia |
| Declaração de Fé | A da CBB, "disponível para consulta no site". Link: https://convencaobatista.com.br/site/pagina.php?MEN_ID=22 (**link, não PDF**) | site, guia |
| Norma de fé e prática | A Bíblia | site, guia |
| Missão | "Cumprir a missão ordenada por Jesus de fazer discípulos" | site, guia |

## Horários (programação regular)

| Dia | Atividade | Horário | Modalidade |
|---|---|---|---|
| Quinta-feira | Culto de Oração | 20h00 | Presencial e online |
| Domingo | EBD (Escola Bíblica Dominical) | 09h00 | Presencial (classes por faixa etária) |
| Domingo | Culto Matinal | 10h10 | Presencial e YouTube |
| Domingo | Culto Noturno | 19h30 | Presencial e YouTube |
| 1ª sexta-feira do mês | Culto Salt (juventude) | 19h30 | Presencial |

**Ceia do Senhor:** todo primeiro domingo do mês. Membros da igreja e de outras igrejas da mesma denominação podem participar.

## Canais

| Canal | Valor | Observação |
|---|---|---|
| WhatsApp / telefone da secretaria | `(31) 7256-1985` (`+553172561985`), informado pelo responsável em 2026-10-23; substitui o `(31) 96441952` do site antigo | Entra em `whatsapp.phone` no seed |
| YouTube | canal "Batista em Lagoa Santa": https://www.youtube.com/channel/UCrq1VyMf5AhR5bLXR80PLCw (cultos gravados e ao vivo; quadro **Palavra Viva**) | Informado em 2026-10-23. A transmissão ao vivo usa `/live` do canal |
| Instagram | PIBLS `@pib_ls` · Salt (Juventude) `@saltjuventude_` · MCM `@mcmpiblagoasanta` · Mini PIB `@minipibls` | site |
| E-mail | `pibls@pibls.com`, informado em 2026-10-23 | Destinatário dos avisos de todos os tipos de contato (`notification_recipients`, privada) e canal do titular na Política de Privacidade |
| Pastor (telefone) | `(38) 9962-8960`, informado em 2026-10-23 | Sem campo no modelo de configurações: **destino a definir** (não entra no público sem decisão) |
| Gazofilácio digital (comprovantes de PIX) | `(31) 9701-8582`, informado em 2026-10-23, para enviar comprovantes à igreja | Sem campo no modelo: **destino a definir** (candidato: texto na página Contribua) |
| Facebook | **não consta** | — |

## PIX (Contribua)

| Item | Valor |
|---|---|
| Favorecido | Primeira Igreja Batista em Lagoa Santa |
| Chave | CNPJ `20969119000184` (os dígitos verificadores conferem) |
| Versículo | "Deus ama a quem contribui com alegria." (2 Coríntios 9:7) |
| Uma chave ou uma por finalidade (Q-11) | As duas fontes mostram **uma única chave**, usada para dízimos, ofertas e construção. Falta a Tesouraria confirmar. |
| Passos exibidos | 1) abrir o app do banco e o menu Pix; 2) apontar a câmera para o QR Code ou usar "Pix Copia e Cola" com a chave; 3) informar o valor e confirmar |

O QR Code é uma imagem do site atual (não extraída aqui): precisa vir do arquivo original, via painel (`/admin/pix`).

## Campanha "Estamos Construindo"

Em 2018 o templo desabou. A igreja constrói um novo local "para reuniões, classes e encontros, equipado com tudo de que precisamos para levar o Evangelho de forma eficiente". Chamada: "Você pode nos ajudar!". Alimenta o aviso da campanha (`site_settings`) e a chamada para `/contribua`.

## História (linha do tempo da página Quem somos, T065)

| Data | Marco |
|---|---|
| 13/01/1985 | Fundação da PIBLS, no bairro Promissão |
| "Mais tarde" | Aquisição do terreno atual e, com o apoio dos batistas norte-americanos, construção do antigo templo (sem datas nas fontes) |
| Fev/2012 | Pr. Joselito F. Sena assume a liderança pastoral |
| 2018 | Acidente que resultou no desabamento do templo |
| 2018 em diante | Mobilização para a construção do novo templo |
| Out/2026 | O Pr. Alan Gefferson de Assunção Taques assume o pastorado |

**Pastores, em ordem de liderança** (as fontes não trazem períodos): Vanduídes Cristovam dos Santos · José Pinto de Resende · Sinésio Vilaça da Silva · Sebastião Oliveira de Souza (em duas ocasiões) · Adilson Cleuber Lourenço · Ozimar Machado Leite · Buglêr Silva Meira · Luiz Carlos · Joselito F. Sena (desde fevereiro de 2012). **Atual:** Pr. Alan Gefferson de Assunção Taques desde outubro de 2026 (biografia enviada pela igreja).

**Pr. Joselito F. Sena (biografia do guia):** natural de Jitaúna (BA); casado com a professora Idélia S. Sena; dois filhos e cinco netos; autor de obras sobre evangelismo e discipulado. Bacharel em Teologia pelo Seminário Teológico Batista do Sul do Brasil (Rio de Janeiro), graduado e pós-graduado em Teologia pela Faculdade Teológica Batista Mineira (Belo Horizonte); psicanalista didático pela Sociedade Psicanalítica Ortodoxa do Brasil e graduado em Psicanálise pela Faculdade Einstein. Pastoreou: Igreja Batista Novo Horizonte (RJ); Igreja Batista de Acari (RJ); 1ª Igreja Batista de Muriaé (MG); 1ª Igreja Batista de Cel. Fabriciano (MG); 1ª Igreja Batista do Barreiro, Belo Horizonte (MG); coordenou o Ministério de Evangelismo e Missões da Igreja Batista do Barro Preto (BH). Desde fev/2012 pastoreia a PIBLS.

## Como somos e Ceia do Senhor (página Quem somos)

Texto enviado pela liderança. **Como somos:** a Bíblia é a norma de fé e prática; cultivamos o amor entre os irmãos e cumprimos a missão ordenada por Jesus de fazer discípulos. "As pessoas, de fato, importam para nós!" **Ceia do Senhor:** realizada todo primeiro domingo do mês; todos os membros da igreja e os membros de outras igrejas da mesma denominação são bem-vindos a participar.

## Ministérios e departamentos (candidatos ao catálogo, Q-04)

Nomes conforme o guia e a página Conheça a Igreja. Os **responsáveis** estão nessas fontes, mas ficam fora deste arquivo e do seed: o catálogo guarda ministério e canal de contato, não pessoas.

Comunicação · Oração · Apoio à Tesouraria · Diáconos · Patrimônio · Recepção / Acolhimento · Juventude (Salt) · Música · Sonoplastia · Multimídia · Transmissão pelas mídias sociais · Evangelismo e Missões · Cantina · Programas Especiais · Ação Social · Educação Cristã · Escola Bíblica Dominical (EBD) · Departamento Infantil (Mini PIB) · MCM (Mulher Cristã em Missões) · UMHBB (União Missionária de Homens Batistas do Brasil) · Embaixadores do Rei · Mensageiras do Rei.

Falta decidir a **categoria** de cada um (ministério, grupo ou célula) e quais têm `contact_email`.

## Grupos e Células de CL (aba "Para Você")

Lema: 1 Pedro 4:10, "Venha servir a Deus e ao próximo conosco!".

| Grupo | Encontro | Observação |
|---|---|---|
| Células de CL (cultos nos lares, por bairro) | terças ou quartas-feiras, 20h | **lista de bairros e endereços não consta**: pendente. Endereço residencial nunca vai ao público (BR-048) |
| Homens | todo último sábado do mês, 20h | — |
| Mulheres | todo terceiro sábado do mês, 17h30 | — |
| Jovens e Adolescentes | ver Juventude / Salt | página própria no site atual (`/juventude/`) |
| Crianças (Mini PIB) | EBD Infantil aos domingos, 9h; Culto Infantil aos domingos, 19h30 | Conferido no Guia em 2026-10-23 |

## Menu do site atual (base do mapa de 301, T156 e T158)

Início `/` · Conheça a Igreja `/conheca-a-igreja/` · Para Você `/para-voce/` · Eventos `/eventos/` · Adoração `/adoracao/` · Boletins `/boletins/` · Como Chegar `/como-chegar/` · Salt `/juventude/`. O guia cita ainda MCM, Mini PIB, "Quero ser membro" e o atendimento por WhatsApp. O inventário completo (URLs mais acessadas, plugins, mídia) é a T156.

## Situação das lacunas (TBD-11), atualizada em 2026-10-23

| Q | O quê | Situação |
|---|---|---|
| Q-03 | Endereço e local atual dos cultos | **Resolvida**: R. Jair Gonçalves Bastos, 64, Jardim Ipê, Lagoa Santa, MG, 33239-800. O link do mapa incorporado (`embed_url`) precisa ser colado pelo painel; os do Google Maps e do Waze vão no seed |
| Q-04 | Lista canônica de ministérios | **Resolvida**: os 22 itens do Guia (aba 02), sem e-mail interno por ministério; os avisos usam a lista de destinatários |
| Q-07 | Declaração de Fé | **Resolvida**: link da CBB |
| Q-08 | Fotos e material histórico | **Material disponível**: 6 fotos em `frontend/public/images` (1,9 a 7,3 MB cada, cruas) e 5 logos em `frontend/public/logos`. Em 2026-10-23 os originais foram para `frontend/assets-src/` (fora de `public/`) e `frontend/scripts/optimize-images.py` gera os WebP responsivos, os logos recortados e os ícones. As fotos estão no Início, em Quem somos e nos formulários de visitante, membro e oração. Antes do go-live, confirmar a autorização de uso de imagem das pessoas fotografadas (LGPD) |
| Q-11 | Uma chave PIX ou por finalidade | Uma chave (CNPJ). Falta confirmar com a Tesouraria |
| Q-13 | Campos do "Quero ser membro" | Não é conteúdo de site; vale o FR-013 até resposta |
| — | E-mail institucional e URLs do YouTube | **Resolvidos** (ver Canais) |
