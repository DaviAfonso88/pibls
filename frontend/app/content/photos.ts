/**
 * Fotos do site (conteúdo versionado, como `institution.ts`). Cada `name` é o prefixo dos arquivos que
 * `scripts/optimize-images.py` gera em `public/images/` (`<name>-480|800|1200|1600.webp`, sempre 3:2); `alt` descreve a
 * cena sem identificar ninguém. Foto nova: coloque o original em `assets-src/images/`, registre-o no script e aqui.
 */
export interface SitePhoto {
  readonly name: string;
  readonly alt: string;
}

/** Retrato quadrado e redondo de uma pessoa: `<name>-{160,320,480}.webp`, gerado por `scripts/optimize-images.py`. */
export interface SitePortrait {
  readonly name: string;
  readonly alt: string;
}

/**
 * Retratos. O do pastor titular fica `null` até existir a foto: ponha o original em `assets-src/images/pastor.jpg`, rode
 * `python -I frontend/scripts/optimize-images.py` e troque o `null` por `{ name: "pastor", alt: "..." }`. Enquanto isso, a
 * página mostra as iniciais dele no lugar da foto.
 */
export const portraits: { readonly pastor: SitePortrait | null } = {
  pastor: {
    name: "pastor",
    alt: "O Pr. Alan Taques sorrindo, de óculos e paletó azul, com um microfone na mão.",
  },
};

export const photos = {
  /** Início, na faixa de boas-vindas. */
  welcome: {
    name: "congregacao-acolhida",
    alt: "Membros da igreja se cumprimentando e sorrindo entre os bancos do templo.",
  },
  /** Início, no cartão de transmissões. */
  worship: {
    name: "louvor",
    alt: "A congregação em pé, cantando durante o culto.",
  },
  /** Ministérios, na abertura. */
  ministries: {
    name: "ministerios",
    alt: "Dois homens em pé junto ao púlpito, um deles de microfone na mão, e três pessoas à frente, de olhos fechados e cabeça baixa, em oração.",
  },
  /** Quem somos, na abertura. */
  about: {
    name: "igreja-em-oracao",
    alt: "Um homem de costas, de paletó e mãos erguidas, ora diante da congregação, que também ora em pé entre os bancos do templo.",
  },
  /** Início, na seção da Juventude Salt. */
  salt: {
    name: "juventude-salt",
    alt: "Um grupo de adolescentes e jovens sorrindo e fazendo sinal de positivo diante de um palco iluminado, num encontro de juventude.",
  },
  /** Sou visitante e, na Início, o convite para a Ficha de Visitante. */
  visitor: {
    name: "visitante-acolhido",
    alt: "Um homem sorrindo, sentado em um banco do templo, com a congregação ao fundo.",
  },
  /** Como chegar, no convite para a primeira visita. */
  firstVisit: {
    name: "oracao",
    alt: "A congregação em pé, de cabeça baixa, orando durante o culto.",
  },
  /** Pedido de oração. */
  prayer: {
    name: "adoracao-jovens",
    alt: "Dois jovens em pé, de rosto erguido, em adoração durante o culto, com a congregação ao fundo.",
  },
  /** Quero ser membro (a Ceia e a membresia andam juntas no Guia Institucional). */
  supper: {
    name: "ceia",
    alt: "Mãos segurando o copinho com suco e o pão da Ceia do Senhor.",
  },
} as const satisfies Record<string, SitePhoto>;
