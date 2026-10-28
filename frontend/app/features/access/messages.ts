/**
 * Textos do painel (acesso, menu, início e usuários). Ficam fora de `~/shared/messages` porque o painel é carregado sob
 * demanda: no `messages` entrariam no JS de toda página pública (orçamento de bundle, RNF-05). As frases das regras de
 * negócio (BR-070 a BR-073) vêm da própria API e são exibidas como chegam.
 */
export const accessMessages = {
  panelName: "Painel da equipe",
  church: "Primeira Igreja Batista em Lagoa Santa",
  backToSite: "Voltar para o site",
  seeSite: "Ver o site",
  noAccessYet: "Não tem acesso? Fale com o administrador técnico da igreja.",
  sessionExpired: "Sua sessão expirou. Entre novamente.",
  checkingSession: "Verificando sua sessão",

  login: {
    title: "Painel da equipe",
    intro: "Entre com o e-mail e a senha que você recebeu.",
    email: "E-mail",
    password: "Senha",
    submit: "Entrar",
    submitting: "Entrando…",
    forgot: "Esqueci minha senha",
    formLabel: "Entrar no painel",
  },

  forgot: {
    title: "Criar uma nova senha",
    intro: "Informe seu e-mail. Mandamos um link para você criar uma senha nova.",
    email: "E-mail",
    submit: "Enviar link",
    submitting: "Enviando…",
    back: "Voltar para entrar",
    formLabel: "Pedir link de nova senha",
    sentTitle: "Confira seu e-mail",
    sentText:
      "Se esse e-mail tiver acesso ao painel, o link chega em alguns minutos. Ele vale por pouco tempo e só funciona uma vez.",
  },

  reset: {
    title: "Escolha sua nova senha",
    intro: "Use pelo menos 12 caracteres. Uma frase fácil de lembrar é melhor do que símbolos.",
    password: "Nova senha",
    passwordHint: "Mínimo de 12 caracteres.",
    confirmation: "Repita a nova senha",
    mismatch: "As duas senhas precisam ser iguais.",
    submit: "Salvar nova senha",
    submitting: "Salvando…",
    formLabel: "Definir nova senha",
    doneTitle: "Senha alterada",
    doneText:
      "Pronto. Entre com a nova senha. Por segurança, as outras sessões abertas foram encerradas.",
    goToLogin: "Entrar no painel",
    invalidTitle: "Link inválido ou expirado",
    invalidText: "Link inválido ou expirado. Solicite um novo.",
    requestNew: "Pedir um novo link",
  },

  menu: {
    label: "Painel",
    open: "Abrir o menu",
    close: "Fechar o menu",
    groups: {
      service: "Atendimento",
      content: "Conteúdo",
      church: "Igreja",
      team: "Equipe",
    },
    home: "Início",
    contacts: "Contatos",
    prayer: "Pedidos de oração",
    bulletins: "Boletins",
    palavraViva: "Palavra Viva",
    events: "Eventos",
    ministries: "Ministérios e grupos",
    settings: "Configurações",
    pix: "PIX",
    users: "Usuários",
    newCount: (total: number): string => `${total} ${total === 1 ? "novo" : "novos"}`,
    signOut: "Sair",
    signingOut: "Saindo…",
  },

  denied: {
    title: "Você não tem acesso a esta área",
    text: "Seu perfil não inclui esta parte do painel. Se precisar dela, fale com o administrador técnico da igreja.",
    back: "Voltar ao início do painel",
  },

  notFound: {
    title: "Esta página do painel não existe",
    text: "Pode ser um endereço antigo ou uma área que ainda não está disponível.",
  },

  home: {
    greetingMorning: "Bom dia",
    greetingAfternoon: "Boa tarde",
    greetingEvening: "Boa noite",
    shortcuts: "Atalhos",
    stalledTitle: "Contatos parados há mais de 3 dias",
    stalledAll: "Ver todos",
    stalledEmpty: "Nenhum contato esperando há mais de 3 dias. Bom trabalho!",
    stalledError: "Não foi possível carregar os contatos agora.",
    noOwner: "Sem responsável",
    anonymous: "Anônimo",
    summary: "Resumo",
    cards: {
      contacts: { label: "Contatos novos", action: "Abrir contatos" },
      prayer: { label: "Pedidos de oração novos", action: "Abrir pedidos" },
      registrations: { label: "Inscrições hoje", action: "Ver inscritos" },
      spots: { label: "Vagas no próximo evento", action: "Ver evento" },
      unlimited: "Sem limite",
      unavailable: "—",
      unavailableLabel: "indisponível",
      noEvent: "nenhum evento com inscrições abertas",
    },
    today: {
      title: "Inscrições de hoje",
      all: "Ver inscritos",
      time: "Hora",
      name: "Nome",
      event: "Evento",
      empty: "Nenhuma inscrição hoje.",
      error: "Não foi possível carregar as inscrições de hoje.",
      more: (rest: number): string =>
        `e mais ${rest} ${rest === 1 ? "inscrição" : "inscrições"} hoje`,
    },
    week: {
      title: "Nesta semana",
      bulletinMissing: "O boletim de domingo ainda não foi publicado.",
      bulletinScheduled: "O boletim de domingo está agendado.",
      bulletinPublished: "O boletim de domingo foi publicado.",
      bulletinPublish: "Publicar boletim",
      bulletinOpen: "Ver boletim",
      postMissing: "A Palavra Viva de domingo ainda não foi publicada.",
      postPublished: "Palavra Viva de domingo publicada",
      postWrite: "Nova mensagem",
      postOpen: "Ver mensagem",
      error: "Não foi possível carregar o resumo da semana.",
    },
    waiting: (days: number): string =>
      `Aguardando atendimento há ${days} ${days === 1 ? "dia" : "dias"}`,
    shortcutLabels: {
      contacts: "Atender contatos",
      prayer: "Pedidos de oração",
      bulletin: "Publicar boletim",
      palavraViva: "Nova mensagem da Palavra Viva",
      event: "Novo evento",
      ministries: "Ministérios e grupos",
      settings: "Horários e avisos do site",
      pix: "Dados do PIX",
      users: "Ver quem tem acesso",
    },
  },

  users: {
    title: "Usuários",
    intro: "Quem tem acesso ao painel e o que cada pessoa pode fazer.",
    readOnlyTitle: "Esta lista é só para consulta.",
    readOnlyText:
      "Novas contas, mudanças de permissão e desligamentos são feitos pelo administrador técnico. Para pedir, fale com ele.",
    count: (total: number): string =>
      `${total} ${total === 1 ? "pessoa com acesso" : "pessoas com acesso"}`,
    name: "Nome",
    role: "Papel",
    areas: "Pode cuidar de",
    lastAccess: "Último acesso",
    you: "Você",
    inactive: "Desativado",
    never: "Nunca entrou",
    loadError: "Não foi possível carregar a lista de usuários.",
  },
} as const;
