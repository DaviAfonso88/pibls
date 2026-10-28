import type { MinistryCategory } from "./admin-api";

/**
 * Textos da tela de ministérios, grupos e células no painel (design: AdminMinisterios; CAP-16). Fora de
 * `~/shared/messages` porque só o painel os usa (orçamento de bundle, RNF-05).
 */
export const ministriesAdminMessages = {
  title: "Ministérios e grupos",
  intro: "O que está ativo aparece no site, na ordem desta lista.",
  loadError: "Não foi possível carregar o catálogo.",
  tabsLabel: "Tipo",
  listLabel: "Lista",
  order: "Ordem",
  name: "Nome",
  active: "Ativo",
  hiddenOnSite: "Oculto no site",
  empty: "Nada cadastrado nesta aba ainda.",
  tabs: {
    MINISTERIO: "Ministérios",
    GRUPO: "Grupos",
    CELULA: "Células",
  } satisfies Record<MinistryCategory, string>,
  newLabel: {
    MINISTERIO: "Novo ministério",
    GRUPO: "Novo grupo",
    CELULA: "Nova célula",
  } satisfies Record<MinistryCategory, string>,
  moveUp: (name: string): string => `Subir ${name}`,
  moveDown: (name: string): string => `Descer ${name}`,
  toggle: (name: string): string => `Mostrar ${name} no site`,
  moveError: "Não foi possível mudar a ordem. Tente de novo.",
  toggleError: "Não foi possível mudar a visibilidade. Tente de novo.",

  form: {
    editTitle: (name: string): string => `Editar ${name}`,
    name: "Nome",
    description: "Descrição no site",
    neighborhood: "Bairro",
    schedule: "Dia e hora",
    schedulePlaceholder: "Ex.: Quartas, 20h…",
    leaders: "Liderança exibida",
    leadersPlaceholder: "Ex.: Coordenador: Ana…",
    phone: "Telefone de contato (aparece no site)",
    staffOnly: "Só para a equipe",
    address: "Endereço da reunião",
    addressHint: "Não aparece no site. A equipe passa para quem pedir para participar.",
    email: "E-mail interno",
    emailHint: "Não aparece no site. Recebe o aviso dos contatos enviados para cá.",
    save: "Salvar",
    saving: "Salvando…",
    saved: "Salvo.",
    created: "Criado.",
    delete: "Excluir",
    deleteTitle: (name: string): string => `Excluir ${name}?`,
    deleteBody:
      "O item some da lista e do site. Se ele já foi usado em contatos, eventos ou contas, não dá para excluir: desative-o.",
    deleteConfirm: "Excluir",
    deleted: "Item excluído.",
    nameLength: "O nome precisa ter de 2 a 120 caracteres.",
    leadersLength: "A liderança pode ter no máximo 500 caracteres.",
    scheduleLength: "O texto pode ter no máximo 120 caracteres.",
    neighborhoodLength: "O bairro precisa ter de 2 a 80 caracteres.",
    addressLength: "O endereço pode ter no máximo 300 caracteres.",
    descriptionLength: "A descrição pode ter no máximo 5.000 caracteres.",
    loadingEditor: "Carregando o editor de texto…",
    notFound: "Este item não existe mais.",
    backToList: "Voltar para a lista",
  },
} as const;
