/**
 * Textos da tela do PIX no painel (design: AdminPix). Fora de `~/shared/messages` porque só o painel os usa
 * (orçamento de bundle, RNF-05).
 */
export const pixAdminMessages = {
  title: "Chave PIX",
  intro: "A igreja tem uma única chave, mostrada na página Contribua.",
  notice:
    "Para mudar a chave, você confirma sua senha. Toda mudança gera um aviso por e-mail para os responsáveis definidos no servidor, com quem alterou e quando.",
  saved: "Chave PIX atualizada.",
  savedAlert: "O aviso para os responsáveis entrou na fila de envio.",
  formLabel: "Dados da chave PIX",
  formHeading: "Dados da chave",
  keyType: "Tipo de chave",
  keyTypeValue: "CNPJ",
  key: "Chave",
  keyHint: "O CNPJ da igreja, com os dígitos verificadores corretos.",
  keyInvalid: "Informe um CNPJ válido.",
  beneficiary: "Nome do favorecido",
  beneficiaryHint: "Igual ao que o banco mostra na hora de pagar, para a pessoa conferir.",
  beneficiaryRequired: "Informe o nome do favorecido.",
  beneficiaryLength: "O nome pode ter no máximo 120 caracteres.",
  qr: "QR Code",
  qrCurrent: "QR atual",
  qrNone: "Nenhum QR Code enviado",
  qrFile: "Novo QR Code (PNG ou JPEG)",
  qrHint:
    "Imagem gerada pelo aplicativo do banco, de até 1 MB. Deixe em branco para manter o atual.",
  qrRequired: "Envie o QR Code do PIX.",
  code: "Pix Copia e Cola",
  codeHint: "Opcional. Copie o código no aplicativo do banco; ele é conferido antes de salvar.",
  codeLength: "O código pode ter no máximo 512 caracteres.",
  save: "Salvar alteração",
  saving: "Salvando…",

  confirmTitle: "Confirme sua senha",
  confirmBody:
    "A chave PIX aparece para quem vai contribuir. Por segurança, digite sua senha para salvar.",
  password: "Senha",
  confirm: "Confirmar e salvar",
  cancel: "Cancelar",
  tooManyAttempts: "Muitas tentativas de senha. Aguarde alguns minutos e tente de novo.",

  siteNow: "No site agora",
  siteKey: "Chave CNPJ",
  seeContribua: "Ver a página Contribua",
  history: "Alterações",
  historyEmpty: "Nenhuma alteração registrada ainda.",
  historyItem: (actor: string | null, fields: readonly string[]): string =>
    `${fields.length === 0 ? "Dados alterados" : `Alterou ${joinFields(fields)}`} por ${actor ?? "usuário removido"}`,
  loadError: "Não foi possível carregar os dados PIX.",
} as const;

const FIELD_LABELS: Record<string, string> = {
  pix_key: "a chave",
  beneficiary_name: "o favorecido",
  qr_image: "o QR Code",
  copy_paste_code: "o Copia e Cola",
};

function joinFields(fields: readonly string[]): string {
  const labels = fields.map((field) => FIELD_LABELS[field] ?? field);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}
