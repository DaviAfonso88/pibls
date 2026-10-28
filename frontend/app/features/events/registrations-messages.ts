/**
 * Textos da tela de inscritos do painel (design: AdminInscritos; CAP-15, R2). Ficam fora de `~/shared/messages` porque só
 * o painel os usa (orçamento de bundle, RNF-05). As frases de confirmação são as do architecture.md (BR-034, BR-081).
 */
export const registrationsAdminMessages = {
  title: "Inscritos",
  backTo: (eventTitle: string): string => `Voltar ao evento ${eventTitle}`,
  viewRegistrations: "Ver inscritos",
  viewRegistrationsOf: (eventTitle: string): string => `Ver os inscritos de ${eventTitle}`,
  spotsFilled: (filled: number, total: number | null): string =>
    total === null
      ? `${filled} ${filled === 1 ? "inscrito" : "inscritos"}`
      : `${filled} de ${total} vagas preenchidas`,
  progressLabel: "Vagas preenchidas",
  exportCsv: "Exportar CSV",
  exportPdf: "Exportar PDF",
  generatingPdf: "Gerando o PDF…",
  csvFailed: "Não foi possível exportar o CSV.",
  pdfFailed: "Não foi possível gerar o PDF.",
  csvDone: "CSV baixado.",
  pdfDone: "PDF baixado.",
  privacyNote:
    "O arquivo exportado tem dados pessoais. Guarde só enquanto precisar e não repasse em grupos.",

  listTitle: "Lista de inscrições",
  search: "Buscar",
  searchHint: "Nome ou telefone",
  empty: "Ninguém se inscreveu ainda.",
  emptyHint: "As inscrições feitas no site aparecem aqui.",
  emptySearch: "Nenhuma inscrição encontrada para essa busca.",
  loadError: "Não foi possível carregar as inscrições.",
  eventLoadError: "Não foi possível carregar o evento.",
  eventNotFound: "Não encontramos este evento.",
  pagesLabel: "Páginas",
  previous: "Anterior",
  next: "Próxima",
  page: (number: number): string => `Página ${number}`,
  showing: (from: number, to: number, total: number): string =>
    `Mostrando ${from}–${to} de ${total}`,
  actions: "Ações",

  cancel: "Cancelar",
  cancelOf: (name: string): string => `Cancelar a inscrição de ${name}`,
  cancelTitle: (name: string): string => `Cancelar a inscrição de ${name}?`,
  /** BR-034. */
  cancelDescription: (name: string): string =>
    `A inscrição de ${name} será excluída definitivamente e a vaga liberada. Confirmar?`,
  /** Do design (AdminInscritos): o que fazer depois de cancelar. A frase de BR-034 acima segue como está (architecture.md). */
  cancelHint:
    "A vaga volta a ficar disponível no site. Avise a pessoa pelo WhatsApp, se for o caso.",
  reasonLegend: "Motivo",
  reasonCancelled: "A pessoa desistiu ou pediu para cancelar",
  reasonDataSubject: "A pessoa pediu a exclusão dos próprios dados (LGPD)",
  /** BR-081. */
  dataSubjectWarning: "Esta exclusão é definitiva e não pode ser desfeita. Confirmar?",
  confirmCancel: "Cancelar inscrição",
  keepRegistration: "Manter inscrição",
  cancelled: "Inscrição cancelada. A vaga voltou a ficar disponível.",
  cancelledUnlimited: "Inscrição cancelada.",
  erased: "Inscrição excluída a pedido do titular.",
  cancelFailed: "Não foi possível cancelar a inscrição.",
} as const;
