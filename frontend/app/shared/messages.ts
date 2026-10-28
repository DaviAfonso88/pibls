/**
 * Textos da interface em pt-BR, num lugar só (i18n / L10n Strategy).
 *
 * O texto exato de cada regra de negócio (BR-xxx) vem do `architecture.md` e mora em `backend/lang/pt_BR/business.php`.
 * Aqui ficam só as mensagens que o frontend mostra por conta própria (validação do formulário antes de enviar), e o
 * teste `messages.test.ts` confere cada uma contra o arquivo do backend: se um texto mudar de um lado, o CI falha.
 *
 * Telas e componentes importam daqui; não escrevem frase solta no JSX, a não ser rótulo de um uso só.
 */

export const messages = {
  common: {
    retry: "Tentar novamente",
    close: "Fechar",
    cancel: "Cancelar",
    confirm: "Confirmar",
    save: "Salvar",
    saving: "Salvando…",
    send: "Enviar",
    sending: "Enviando…",
    loading: "Carregando…",
    back: "Voltar",
    yes: "Sim",
    no: "Não",
    optional: "(opcional)",
    required: "obrigatório",
    whatsapp: "Falar no WhatsApp",
    stale: "Algumas informações podem estar desatualizadas.",
  },

  /** Mensagens de erro de rede e de servidor (Error Handling Strategy). */
  errors: {
    network: "Não foi possível conectar. Verifique sua internet e tente de novo.",
    generic: "Algo deu errado. Tente novamente em instantes.",
    internal: (traceId: string): string =>
      `Algo deu errado do nosso lado. Tente novamente em instantes. Código do erro: ${traceId}`,
    serviceUnavailable:
      "O site está com instabilidade. Tente novamente em instantes ou fale conosco pelo WhatsApp.",
    csrf: "A página ficou aberta por muito tempo. Recarregue e tente novamente.",
    sessionExpired: "Sua sessão expirou. Entre novamente.",
    forbidden: "Você não tem permissão para esta ação.",
    notFound: "Não encontramos o que você procurou.",
    tooManyRequests: "Muitas tentativas. Tente novamente em alguns minutos.",
    payloadTooLarge: "O arquivo é grande demais.",
    traceLabel: "Código do erro",
  },

  /** Acessibilidade e estrutura da página. */
  a11y: {
    skipToContent: "Ir para o conteúdo",
    mainNavigation: "Navegação principal",
    openMenu: "Abrir o menu",
    closeMenu: "Fechar o menu",
    menu: "Menu",
    footer: "Rodapé",
    loadingContent: "Carregando o conteúdo",
  },

  browserOutdated: {
    text: "Seu navegador está desatualizado e esta página pode aparecer sem formatação. Atualize o aparelho ou use outro navegador.",
    link: "Veja como chegar à igreja",
  },

  /** Rótulos do menu do site público. */
  nav: {
    home: "Início",
    about: "Quem somos",
    ministries: "Ministérios",
    groups: "Grupos",
    bulletins: "Boletins",
    palavraViva: "Palavra Viva",
    events: "Eventos",
    give: "Contribua",
    directions: "Como chegar",
    visitor: "Sou visitante",
    member: "Quero ser membro",
    prayer: "Pedido de oração",
    contact: "Contato",
    privacy: "Privacidade",
  },

  states: {
    emptyList: "Nada por aqui ainda.",
    errorTitle: "Não foi possível carregar",
    notFoundEyebrow: "Erro 404",
    notFoundTitle: "Não encontramos esta página",
    notFoundText:
      "O endereço pode ter mudado. Estes caminhos levam ao que as pessoas mais procuram:",
    notFoundShortcutsLabel: "Atalhos",
    notFoundHome: "Início",
    notFoundSchedules: "Horários dos cultos",
    notFoundContact: "Contato",
    unexpectedTitle: "Algo deu errado",
    backHome: "Voltar ao início",
  },

  /** Cabeçalho e rodapé do site público. */
  site: {
    homeLinkHint: "página inicial",
    contactLink: "Fale com a igreja",
    footerWhere: "Onde estamos",
    footerServices: "Cultos",
    footerContact: "Fale com a gente",
    footerParticipate: "Participe",
    directions: "Como chegar",
    allSchedules: "Todos os horários",
    youtube: "YouTube",
    footerYoutubeTitle: "Acompanhe os cultos",
    footerYoutubeText: "Ao vivo e gravados, no canal Batista em Lagoa Santa.",
    footerYoutubeCta: "Ver o canal",
    privacy: "Política de Privacidade",
    staffAccess: "Acesso da equipe",
  },

  /** Mapa e vídeo: o conteúdo de terceiros só carrega depois do toque. */
  media: {
    showMap: "Mostrar o mapa",
    mapHint: "O mapa é carregado só quando você pede.",
    mapTitle: "Mapa com a localização da igreja",
    playVideo: "Assistir ao vídeo",
    videoHint: "O vídeo do YouTube é carregado só quando você pede.",
  },

  /** Textos das páginas públicas (design: boards do canvas "Portal PIBLS — Páginas"). */
  pages: {
    callWhatsapp: "Chamar no WhatsApp",

    // Ministérios e grupos
    ministriesTitle: "Ministérios",
    ministriesIntro:
      "Cada ministério cuida de uma parte da vida da igreja. Toque em um deles para ver o que faz e quem lidera.",
    ministriesList: "Lista de ministérios",
    talkToMinistry: "Falar com este ministério",
    wantToServe: "Quer servir?",
    wantToServeText:
      "Escolha o ministério que tem a ver com você e mande uma mensagem. A liderança responde.",
    talkToAMinistry: "Falar com um ministério",
    groupsTitle: "Para você",
    groupsIntro: "Grupos por fase da vida e Células de CL nos lares, perto da sua casa.",
    groupsVerse:
      "Cada um exerça o dom que recebeu para servir os outros, administrando fielmente a graça de Deus em suas múltiplas formas.",
    groupsVerseReference: "1 Pedro 4:10",
    filters: "Filtros",
    filterByProfile: "Filtrar por perfil",
    all: "Todos",
    cellNeighborhood: "Bairro das Células de CL",
    allNeighborhoods: "Todos os bairros",
    groupsList: "Grupos",
    noGroups: "Nenhum grupo neste filtro. Escolha outro perfil ou bairro.",
    wantToJoin: "Quero participar",
  },

  /** Rótulos dos controles compartilhados de formulário. */
  forms: {
    consentBefore: "Li e concordo com a ",
    consentLink: "Política de Privacidade",
    consentAfter: ".",
    opensInNewTab: "(abre em nova aba)",
    fileDropPrompt: "Arraste o arquivo para cá ou",
    fileChoose: "Escolher arquivo",
    fileReplace: "Trocar arquivo",
    fileRemove: "Remover arquivo",
    fileNone: "Nenhum arquivo escolhido.",
    fileChosen: "Arquivo escolhido:",
  },
} as const;

export type Messages = typeof messages;
