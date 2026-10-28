/**
 * Dados institucionais fixos da igreja (conteúdo versionado, não editável no painel). O que muda — endereço, horários,
 * WhatsApp, redes — vem das configurações públicas (`/data/settings.json`).
 */
export const institution = {
  name: "Primeira Igreja Batista em Lagoa Santa",
  shortName: "PIBLS",
  /** Só dígitos; o rodapé formata. É o mesmo CNPJ da chave PIX da igreja. */
  cnpj: "20969119000184",
  affiliation: "Filiada à Convenção Batista Brasileira",
  /** Endereço canônico do site: base das URLs absolutas do Open Graph (WhatsApp e buscadores exigem URL completa). */
  siteUrl: "https://pibls.com",
  /** Fundação da igreja (ISO 8601): de onde sai a idade de "Quem somos" e o "desde 1985" da página inicial. */
  foundedOn: "1985-01-13",
} as const;
