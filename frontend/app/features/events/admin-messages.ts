/**
 * Textos das telas de eventos do painel (design: AdminEvento; CAP-12, R2). Ficam fora de `~/shared/messages` porque só o
 * painel os usa (orçamento de bundle, RNF-05). As frases das regras (BR-025 a BR-033) são as do architecture.md.
 */
export const eventAdminMessages = {
  list: {
    title: "Eventos",
    intro: "Eventos com inscrição: crie, publique e acompanhe as vagas.",
    newEvent: "Novo evento",
    columns: {
      title: "Evento",
      date: "Começa em",
      ministry: "Ministério",
      status: "Situação",
      spots: "Inscritos",
    },
    state: "Situação",
    allStates: "Todas",
    ministryFilter: "Ministério",
    allMinistries: "Todos",
    filtersLabel: "Filtrar eventos",
    spots: (count: number, total: number | null): string =>
      total === null ? `${count} inscrito${count === 1 ? "" : "s"}` : `${count} de ${total} vagas`,
    actions: "Ações",
    edit: "Editar",
    editEvent: (title: string): string => `Editar o evento ${title}`,
    empty: "Nenhum evento por aqui ainda.",
    emptyHint: "Crie o primeiro evento para abrir inscrições.",
    emptyFiltered: "Nenhum evento com esse filtro.",
    loadError: "Não foi possível carregar os eventos.",
    pagesLabel: "Páginas",
    previous: "Anterior",
    next: "Próxima",
    page: (number: number): string => `Página ${number}`,
    showing: (from: number, to: number, total: number): string =>
      `Mostrando ${from}–${to} de ${total}`,
  },

  state: {
    RASCUNHO: "Rascunho · fora do site",
    INSCRICOES_ABERTAS: "Publicado · inscrições abertas",
    INSCRICOES_ENCERRADAS: "Publicado · inscrições encerradas",
    REALIZADO: "Realizado",
  },

  stateShort: {
    RASCUNHO: "Rascunho",
    INSCRICOES_ABERTAS: "Inscrições abertas",
    INSCRICOES_ENCERRADAS: "Inscrições encerradas",
    REALIZADO: "Realizado",
  },

  form: {
    newTitle: "Novo evento",
    editTitle: "Editar evento",
    back: "Eventos",
    formLabel: "Dados do evento",
    aboutSection: "Sobre o evento",
    titleField: "Nome",
    titleLength: "O nome precisa ter de 3 a 150 caracteres.",
    slugField: "Endereço da página",
    slugPrefix: "/eventos/",
    slugHint: "Gerado a partir do nome. Depois de criado, não muda.",
    slugConflictHint: "Este endereço já está em uso. Ajuste-o para salvar.",
    slugRequired: "Escreva um nome para gerar o endereço.",
    slugInvalid: "Use só letras minúsculas, números e hífens, sem acento.",
    ministry: "Ministério responsável",
    ministryRequired: "Escolha o ministério.",
    ministryPlaceholder: "Escolha…",
    startsAt: "Começa",
    endsAt: "Termina",
    optionalEnd: "Se o evento não tem hora para acabar, deixe em branco.",
    startsRequired: "Informe quando o evento começa.",
    zone: "Horário de Brasília.",
    location: "Local",
    locationPlaceholder: "Templo da PIBLS",
    locationRequired: "Informe o local do evento.",
    locationLength: "O local pode ter no máximo 200 caracteres.",
    descriptionLabel: "Descrição",
    descriptionHint: "Mesmo editor da Palavra Viva: negrito, itálico, listas e link.",
    descriptionRequired: "Escreva a descrição do evento.",
    descriptionLength: "A descrição pode ter no máximo 20.000 caracteres.",
    loadingEditor: "Carregando o editor…",

    registrationSection: "Inscrições",
    spots: "Vagas",
    spotsHint:
      "Deixe em branco para vagas ilimitadas. Quando acabarem, a página mostra “Esgotado”.",
    spotsInvalid: "Informe um número de vagas de 1 a 100.000.",
    spotsBelow: (count: number): string =>
      count === 1
        ? "Já existe 1 inscrito; o número de vagas não pode ser menor."
        : `Já existem ${count} inscritos; o número de vagas não pode ser menor.`,
    deadline: "Inscrições até",
    deadlineHint:
      "Depois deste horário o formulário some da página. Em branco, vale até o início do evento.",
    endBeforeStart: "O término precisa ser depois do início.",
    deadlineAfterStart: "O prazo de inscrição precisa terminar antes do início do evento.",
    minors: "Aceita menores de idade",
    minorsHint: "Se ligado, o formulário pede nome, telefone e autorização do responsável.",

    bannerSection: "Imagem de capa",
    bannerLabel: "Imagem de capa",
    bannerHint:
      "JPG, PNG ou WebP, horizontal, até 3 MB. O site gera versões menores para o celular.",
    bannerType: "A imagem precisa ser JPEG, PNG ou WebP, com até 3 MB.",
    bannerSize: "A imagem precisa ser JPEG, PNG ou WebP, com até 3 MB.",
    bannerCurrent: "Imagem de capa atual",
    bannerChosen: (name: string): string => `Nova imagem: ${name}`,
    bannerRemove: "Remover imagem",
    bannerRemoved: "A imagem será removida quando você salvar.",
    bannerUndoRemove: "Manter a imagem",
    bannerFailed: "O evento foi salvo, mas a imagem não pôde ser enviada. Tente de novo.",

    saveDraft: "Salvar rascunho",
    saveAndPublish: "Salvar e publicar",
    save: "Salvar alterações",
    saving: "Salvando…",
    created: "Evento criado.",
    createdPublished: "Evento criado e publicado.",
    updated: "Alterações salvas.",
    preview: "Ver página do evento",
    delete: "Excluir evento",
    deleteTitle: (title: string): string => `Excluir "${title}"?`,
    deleteBody:
      "A exclusão é definitiva. Só é possível excluir um evento sem inscrições; com inscrições, o caminho é despublicar.",
    deleteConfirm: "Excluir evento",
    deleted: "Evento excluído.",
    hasRegistrations: "Este evento tem inscrições e não pode ser excluído. Despublique-o.",
    notFound: "Não encontramos este evento.",
    loadError: "Não foi possível carregar o evento.",
    spotsSummary: (count: number, total: number | null): string =>
      total === null
        ? `${count} inscrito${count === 1 ? "" : "s"} · vagas ilimitadas`
        : `${count} de ${total} vagas preenchidas`,
  },

  actions: {
    publish: "Publicar",
    unpublish: "Despublicar",
    closeRegistration: "Encerrar inscrições",
    reopenRegistration: "Reabrir inscrições",
    closeTitle: "Encerrar as inscrições agora?",
    closeBody: "O formulário some da página do evento. Quem já se inscreveu continua na lista.",
    closeConfirm: "Encerrar",
    cancel: "Cancelar",
    published: "Evento publicado.",
    unpublished: "Evento despublicado. Ele saiu do site.",
    closed: "Inscrições encerradas.",
    reopened: "Inscrições reabertas.",
    // BR-033
    expiredTitle: "Publicar com as inscrições encerradas?",
    expiredBody:
      "O prazo de inscrição já passou; o evento será publicado com inscrições encerradas.",
    expiredConfirm: "Publicar mesmo assim",
    groupLabel: "Situação do evento",
  },

  builder: {
    section: "Formulário de inscrição",
    intro: "Peça só o que a organização realmente precisa.",
    fixedLabel: "Campos que o formulário sempre pede",
    fixed: [
      { name: "Nome completo", rule: "Sempre pedido · obrigatório" },
      { name: "WhatsApp", rule: "Sempre pedido · obrigatório" },
      { name: "E-mail", rule: "Sempre pedido · opcional" },
    ],
    questionsLabel: "Perguntas do evento",
    question: "Pergunta",
    questionRequired: "Escreva a pergunta.",
    questionLength: "A pergunta pode ter no máximo 150 caracteres.",
    type: "Tipo de resposta",
    types: {
      TEXT: "Texto curto",
      TEXTAREA: "Texto longo",
      NUMBER: "Número",
      DATE: "Data",
      SELECT: "Escolha uma opção",
      MULTISELECT: "Escolha várias opções",
      BOOLEAN: "Sim ou não",
    },
    required: "Obrigatória",
    help: "Dica para quem responde",
    helpOptional: "Aparece embaixo da pergunta.",
    helpLength: "A dica pode ter no máximo 300 caracteres.",
    options: "Opções (uma por linha)",
    optionsHint: "De 2 a 30 opções diferentes.",
    optionsInvalid: "Informe de 2 a 30 opções diferentes.",
    min: "Valor mínimo",
    max: "Valor máximo",
    limitsInvalid: "O mínimo não pode ser maior que o máximo.",
    numberInvalid: "Informe um número.",
    sensitive: "É informação de saúde",
    sensitiveHint:
      "Marque se a resposta for informação de saúde (alergia, remédio, restrição alimentar por motivo médico).",
    sensitiveNotice:
      "Este formulário pede informação de saúde. Por isso, quem se inscrever precisará dar uma autorização específica, num segundo aceite, para o uso dessas informações.",
    add: "Adicionar pergunta",
    limit: (max: number): string => `O formulário chegou ao limite de ${max} perguntas.`,
    count: (count: number, max: number): string => `${count} de ${max} perguntas`,
    empty: "Nenhuma pergunta extra. O formulário pede só o nome, o WhatsApp e o e-mail.",
    remove: (label: string): string => `Remover a pergunta ${label === "" ? "sem título" : label}`,
    moveUp: (label: string): string =>
      `Mover a pergunta ${label === "" ? "sem título" : label} para cima`,
    moveDown: (label: string): string =>
      `Mover a pergunta ${label === "" ? "sem título" : label} para baixo`,
    position: (index: number, total: number): string => `Pergunta ${index} de ${total}`,
    removed: (label: string): string => `Pergunta ${label === "" ? "sem título" : label} removida.`,
    // BR-029
    breakingTitleRemove: (label: string): string => `Remover a pergunta "${label}"?`,
    breakingTitleType: (label: string): string => `Trocar o tipo da pergunta "${label}"?`,
    schemaConfirmTitle: "Confirmar a mudança no formulário?",
    breakingBody:
      "Este campo já tem respostas. As respostas existentes serão mantidas com o rótulo atual. Confirmar?",
    breakingRemove: "Remover pergunta",
    breakingType: "Trocar o tipo",
    typeKept: "O tipo da pergunta foi mantido.",
    schemaInvalid: "Confira as perguntas do formulário.",
  },

  draft: {
    found: "Encontramos um rascunho não salvo neste navegador. Deseja restaurar?",
    restore: "Restaurar",
    discard: "Descartar",
    savedAt: (time: string): string => `Rascunho guardado neste navegador às ${time}`,
    note: "O rascunho fica guardado só neste navegador enquanto você edita (a imagem de capa não entra). Nada vai para o site antes de você publicar.",
  },
} as const;
