/**
 * Textos das regras de negócio que o formulário valida no navegador, antes de enviar. A chave é o id da BR e o valor,
 * a frase exata do architecture.md. O servidor é a validação final e devolve os mesmos textos. Ficam fora de
 * `~/shared/messages` porque só os esquemas Zod (carregados sob demanda) os usam: no `messages` entrariam no JS de toda
 * página pública (orçamento de bundle, RNF-05).
 */
export const ruleMessages = {
  consent: "Para enviar, você precisa concordar com a Política de Privacidade.", // BR-001
  name: "Informe seu nome.", // BR-004
  phone: "Informe um telefone válido com DDD.", // BR-004
  email: "Informe um e-mail válido.", // BR-004
  message: "Escreva sua mensagem (mínimo de 5 caracteres).", // BR-004
  phoneOrEmail: "Informe um telefone ou um e-mail para retorno.", // BR-005
  invalidMinistry: "Ministério inválido.", // BR-006
  invalidGroup: "Grupo inválido.", // BR-006
  note: "A anotação pode ter no máximo 1.000 caracteres.", // BR-013
  required: "Este campo é obrigatório.", // BR-024
  pickOption: "Escolha uma das opções.", // BR-024
  guardian: "Informe os dados do responsável legal e marque a autorização.", // BR-023
  healthConsent: "Para continuar, autorize o uso das informações de saúde.", // BR-083
  youtube: "Informe um link do YouTube.", // BR-044
  formatRemoved: "Parte da formatação não é permitida e foi removida.", // BR-046
  pdfType: "O arquivo precisa ser um PDF.", // BR-041
  pdfSize: "O PDF pode ter no máximo 10 MB.", // BR-041
  qrImage: "O QR Code precisa ser PNG ou JPEG, com até 1 MB.", // BR-045
  pixPassword: "Senha incorreta. Os dados PIX não foram alterados.", // BR-060
  // BR-063
  pixAlertBlocked:
    "Alteração bloqueada: os destinatários do alerta de PIX não estão configurados no servidor. Fale com o administrador técnico.",
  scheduleRequired: "Informe dia e horário.", // BR-049
  neighborhoodRequired: "Informe o bairro.", // BR-049
  recipients: "Informe até 10 e-mails válidos.", // BR-051
  cnpj: "Informe um CNPJ válido.", // BR-061
  pixCode: "O código Pix Copia e Cola é inválido. Copie-o novamente do aplicativo do banco.", // BR-062
  passwordMin: "A senha precisa ter pelo menos 12 caracteres.", // BR-073
  passwordMax: "A senha é longa demais.", // BR-073
} as const;
