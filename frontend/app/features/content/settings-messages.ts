/**
 * Textos da tela de configurações do site (design: AdminConfiguracoes; CAP-17). Fora de `~/shared/messages` porque só o
 * painel os usa (orçamento de bundle, RNF-05).
 */
export const LEAD_TYPES = ["VISITANTE", "MEMBRO", "ORACAO", "CONTATO", "MINISTERIO"] as const;
export type LeadTypeCode = (typeof LEAD_TYPES)[number];

export const MAX_SCHEDULE_ITEMS = 20;
export const MAX_SOCIAL_LINKS = 10;
export const MAX_RECIPIENTS = 10;

/** Os dias que a lista oferece. "Quinta-feira" e "Sexta-feira" são os mesmos valores do conteúdo inicial. */
export const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export const settingsMessages = {
  title: "Configurações do site",
  intro: "Horários, avisos, endereço e quem recebe os contatos.",
  formLabel: "Configurações do site",
  loadError: "Não foi possível carregar as configurações.",
  saved: "Alterações salvas. O site atualiza em seguida.",
  nothingToSave: "Nada mudou desde o último salvamento.",
  save: "Salvar alterações",
  saving: "Salvando…",
  optional: "(opcional)",
  saveHint: "As mudanças aparecem no site depois de salvar.",

  schedule: {
    title: "Horários dos cultos",
    count: (total: number): string => `${total} de ${MAX_SCHEDULE_ITEMS} horários`,
    day: "Dia",
    time: "Hora",
    activity: "Atividade",
    recurrence: "Recorrência",
    mode: "Modalidade",
    add: "Adicionar horário",
    hint: "A ordem no site é a desta lista.",
    empty: "Nenhum horário cadastrado.",
    rowLabel: (field: string, position: number): string => `${field} do horário ${position}`,
    remove: (name: string, position: number): string => `Remover ${name || `horário ${position}`}`,
    dayRequired: "Escolha o dia.",
    timeInvalid: "Informe o horário no formato HH:MM, por exemplo 10:10.",
    activityRequired: "Informe o nome da atividade.",
    activityLength: "O nome pode ter no máximo 80 caracteres.",
    recurrenceLength: "A recorrência pode ter no máximo 60 caracteres.",
    modeLength: "A modalidade pode ter no máximo 80 caracteres.",
    recurrencePlaceholder: "Ex.: semanal…",
    modePlaceholder: "Ex.: Presencial e YouTube…",
  },

  campaign: {
    title: "Aviso de campanha",
    titleField: "Título",
    text: "Texto do aviso",
    on: "Aparece no topo da página inicial.",
    off: "Desligado: não aparece no site.",
    titleLength: "O título pode ter no máximo 80 caracteres.",
    textLength: "O texto pode ter no máximo 500 caracteres.",
    textRequired: "Escreva o texto do aviso ou desligue-o.",
  },

  supper: {
    title: "Aviso da Ceia",
    text: "Texto do aviso",
    textHint:
      "Escreva a data e o culto. O aviso é manual: ligue na semana da Ceia e desligue depois.",
    on: "Aparece na página inicial enquanto estiver ligado.",
    off: "Desligado: não aparece no site.",
    textLength: "O texto pode ter no máximo 300 caracteres.",
    textRequired: "Escreva o texto do aviso ou desligue-o.",
  },

  address: {
    title: "Endereço do templo",
    street: "Rua ou avenida",
    number: "Número",
    complement: "Complemento",
    neighborhood: "Bairro",
    city: "Cidade",
    state: "UF",
    zip: "CEP",
    streetRequired: "Informe a rua ou avenida.",
    numberRequired: "Informe o número.",
    neighborhoodRequired: "Informe o bairro.",
    cityRequired: "Informe a cidade.",
    stateInvalid: "Informe a sigla do estado, com 2 letras.",
    zipInvalid: "Informe o CEP com 8 dígitos.",
    maps: "Link do Google Maps",
    waze: "Link do Waze",
    embed: "Link do mapa incorporado",
    embedHint:
      "Só vale o endereço de Compartilhar › Incorporar um mapa (o src do iframe, começa com https://www.google.com/maps/embed). O link comum do Maps não funciona aqui.",
  },

  channels: {
    title: "Canais da igreja",
    whatsapp: "WhatsApp da secretaria",
    whatsappText: "Mensagem inicial do WhatsApp",
    youtubeChannel: "Canal do YouTube",
    youtubeLive: "Transmissão ao vivo (YouTube)",
    social: "Redes sociais",
    socialNetwork: "Rede",
    socialUrl: "Endereço do perfil",
    socialAdd: "Adicionar rede social",
    socialEmpty: "Nenhuma rede social cadastrada.",
    socialRemove: (network: string, position: number): string =>
      `Remover ${network || `rede social ${position}`}`,
    socialNetworkRequired: "Informe a rede.",
    socialNetworkLength: "O nome da rede pode ter no máximo 30 caracteres.",
    urlInvalid: "Informe um endereço que comece com https://.",
    defaultTextLength: "A mensagem pode ter no máximo 200 caracteres.",
  },

  recipients: {
    title: "Quem recebe o aviso de cada contato",
    intro:
      "Esses e-mails nunca aparecem no site. O aviso diz só que chegou um contato novo; os dados ficam no painel.",
    footnote:
      "Contatos para um ministério vão para o e-mail interno do ministério, definido em Ministérios e grupos. A lista de “Contato com um ministério” vale só para o ministério que não tem e-mail interno.",
    footnoteLink: "Ministérios e grupos",
    none: "Sem destinatário",
    add: "Adicionar e-mail",
    addFor: (type: string): string => `Adicionar e-mail para ${type}`,
    addLabel: (type: string): string => `Novo e-mail para ${type}`,
    addConfirm: "Incluir",
    cancel: "Cancelar",
    remove: (email: string, type: string): string => `Remover ${email} de ${type}`,
    limit: `No máximo ${MAX_RECIPIENTS} e-mails por tipo.`,
    duplicate: "Este e-mail já está na lista.",
    types: {
      VISITANTE: "Sou visitante",
      MEMBRO: "Quero ser membro",
      ORACAO: "Pedido de oração",
      CONTATO: "Fale conosco",
      MINISTERIO: "Contato com um ministério",
    } satisfies Record<LeadTypeCode, string>,
  },

  warning: {
    title: (type: string): string => `“${type}” está sem destinatário.`,
    text: "Os contatos desse tipo chegam ao painel, mas ninguém recebe aviso por e-mail.",
    fix: "Resolver agora",
  },
} as const;
