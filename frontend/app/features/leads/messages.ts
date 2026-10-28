/**
 * Textos dos formulários de contato (US2; design: SouVisitante, QueroSerMembro, PedidoOracao, Contato). Ficam fora de
 * `~/shared/messages` porque só as telas de formulário e a Política de Privacidade os usam: no `messages` eles entrariam
 * no JS de toda página pública (orçamento de bundle, RNF-05).
 */
export const leadMessages = {
  optional: "(opcional)",
  name: "Nome",
  whatsapp: "WhatsApp",
  phoneOrWhatsapp: "Telefone ou WhatsApp",
  email: "E-mail",
  message: "Mensagem",
  send: "Enviar",
  sending: "Enviando…",
  retry: "Tentar novamente",
  sendFailed: "Não foi possível enviar agora. Tente novamente ou fale conosco pelo WhatsApp.",
  messageTooLong: (max: number): string => `A mensagem pode ter no máximo ${max} caracteres.`,
  phoneOrEmailInvalid: "Informe um telefone ou um e-mail válido.",
  privacyNote:
    "Seus dados ficam só com a equipe da igreja e são usados apenas para falar com você.",
  honeypotLabel: "Não preencha este campo",
  successTitle: "Recebemos seu contato!",

  visitorEyebrow: "Ficha de Visitante",
  visitorTitle: "Que bom ter você aqui!",
  visitorIntro: "Deixe seu contato. A equipe de acolhimento fala com você pelo WhatsApp.",
  neighborhood: "Bairro onde mora",
  wantsVisit: "Deseja receber uma visita?",
  wantsCellGroup: "Deseja conhecer uma Célula de CL?",
  groupOfInterest: "Grupo de interesse",
  noGroupYet: "Nenhum por enquanto",
  groupHint: "Vem preenchido quando você toca em “Quero participar” na página de grupos.",
  visitorMessage: "Quer contar algo?",
  visitorSuccess: "A equipe de acolhimento vai falar com você pelo WhatsApp.",
  seeServiceTimes: "Ver os horários dos cultos",

  memberTitle: "Quero ser membro",
  memberIntro:
    "Que alegria! Deixe seu contato e a liderança pastoral conversa com você sobre os próximos passos.",
  fromOtherBaptistChurch: "É membro de outra igreja batista?",
  memberSuccess: "A liderança pastoral vai falar com você pelo WhatsApp.",

  prayerTitle: "Pedido de oração",
  prayerIntro: "Conte pelo que você quer que a gente ore. Você pode enviar sem se identificar.",
  prayerPrivacy:
    "Seu pedido é lido apenas pela equipe de oração. Ele não aparece no site nem vai por e-mail.",
  prayerRequest: "Seu pedido",
  prayerHint: "Até 4.000 caracteres.",
  identifyMe: "Quero me identificar para a equipe falar comigo",
  whatsappOrEmail: "WhatsApp ou e-mail",
  prayerSend: "Enviar pedido",
  prayerSuccessTitle: "Recebemos seu pedido",
  prayerSuccess: "A equipe de oração vai orar por você.",

  contactTitle: "Contato",
  contactIntro: "Escreva para a secretaria ou direto para um ministério.",
  preferWhatsapp: "Prefere o WhatsApp?",
  preferWhatsappHint: "Atendimento pela secretaria.",
  whoToTalkTo: "Com quem você quer falar?",
  toSecretariat: "Com a secretaria (Fale conosco)",
  toMinistry: "Com um ministério",
  ministry: "Ministério",
  chooseMinistry: "Escolha o ministério",
  howToReply: "Como responder você",
  atLeastOne: "Preencha pelo menos um dos dois.",
  contactSend: "Enviar mensagem",
  contactSuccess: "A resposta vem pelo telefone ou e-mail que você informou.",

  privacyTitle: "Política de Privacidade",
} as const;
