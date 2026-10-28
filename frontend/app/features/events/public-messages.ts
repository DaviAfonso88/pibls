/**
 * Textos das telas públicas de eventos (R2): a lista, a página do evento e a inscrição. Ficam fora de `~/shared/messages`
 * para não entrar no JS das outras páginas (orçamento de bundle, RNF-05). As frases de regra (BR-020 a BR-024, BR-083)
 * que o servidor devolve vêm dele; as daqui são as que a tela mostra por conta própria.
 */
export const publicEventMessages = {
  title: "Eventos",
  intro: "Retiros, encontros e cursos dos ministérios. Faça a sua inscrição por aqui.",
  upcoming: "Próximos eventos",
  past: "Eventos anteriores",
  noUpcoming: "Não há eventos marcados no momento.",
  noUpcomingHint: "Volte em breve: os próximos aparecem aqui assim que forem publicados.",
  noEvents: "Ainda não há eventos.",
  seeEvent: "Ver evento",
  allEvents: "Todos os eventos",
  listLabel: "Lista de eventos",
  loadingList: "Carregando os eventos",
  pagination: "Paginação dos eventos",
  previous: "Anterior",
  next: "Próxima",
  pageOf: (page: number, last: number): string => `Página ${page} de ${last}`,
  bannerPlaceholder: "Evento sem imagem",

  open: "Inscrições abertas",
  openWithSpots: (spots: number): string =>
    `Inscrições abertas · ${spots} ${spots === 1 ? "vaga" : "vagas"}`,
  full: "Vagas esgotadas",
  closed: "Inscrições encerradas",
  held: "Evento realizado",
  spotsLeft: (spots: number): string =>
    spots === 1 ? "1 vaga restante" : `${spots} vagas restantes`,
  deadlineUntil: (when: string): string => `Inscrições até ${when}`,
  whenLabel: "Quando",
  whereLabel: "Onde",

  fullTitle: "As vagas acabaram",
  fullText:
    "Todas as vagas deste evento foram preenchidas. Fale com o ministério se quiser saber de novas turmas.",
  talkToMinistry: "Falar com o ministério",
  closedTitle: "Inscrições encerradas",
  closedText: (when: string): string => `O prazo terminou em ${when}.`,
  closedStarted: "As inscrições se encerram quando o evento começa.",
  heldTitle: "Este evento já aconteceu",
  heldText: "Veja os próximos eventos e faça a sua inscrição.",

  notFoundTitle: "Evento não encontrado",
  notFoundText: "Este evento não existe ou não está mais disponível.",
  notFoundEyebrow: "Eventos",

  registration: "Inscrição",
  fullName: "Nome completo",
  whatsapp: "WhatsApp",
  email: "E-mail",
  optional: "(opcional)",
  emailHint: "Para receber a confirmação da inscrição.",
  choose: "Escolha",
  yes: "Marcar",
  guardianLegend: "Responsável legal (participante menor de 18 anos)",
  guardianName: "Nome do responsável",
  guardianPhone: "Telefone do responsável",
  guardianConsent: "Sou o responsável legal e autorizo a participação no evento.",
  healthLegend: "Informações de saúde",
  healthHint:
    "Este formulário pede informações de saúde. Usamos só para cuidar de você durante o evento.",
  healthConsent: "Autorizo o uso destas informações de saúde para a organização do evento.",
  confirm: "Confirmar inscrição",
  sending: "Enviando…",
  retry: "Tentar novamente",
  privacyNote:
    "Seus dados ficam só com a equipe do evento e são usados para a organização dele. Nada é compartilhado.",
  refreshedFull: "As vagas acabaram enquanto você preenchia. A página foi atualizada.",

  successTitle: "Inscrição confirmada!",
  successEvent: "Evento",
  successDate: "Data",
  successParticipant: "Participante",
  successEmail: "Se você informou um e-mail, a confirmação chega em alguns minutos.",
  seeOthers: "Ver outros eventos",

  tooLong: (max: number): string => `Use no máximo ${max} caracteres.`,
  tooShort: (min: number): string => `Use pelo menos ${min} caracteres.`,
  numberBetween: (min: number, max: number): string => `Informe um número entre ${min} e ${max}.`,
  numberFrom: (min: number): string => `Informe um número a partir de ${min}.`,
  numberUpTo: (max: number): string => `Informe um número de até ${max}.`,
  invalidNumber: "Informe uma resposta válida.",
  invalidDate: "Informe uma data válida.",
} as const;
