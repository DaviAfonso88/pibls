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
  /** Quem somos. */
  youth: {
    name: "adoracao-jovens",
    alt: "Jovens de olhos fechados e mãos abertas, em adoração durante o culto.",
  },
  /** Sou visitante. */
  visitor: {
    name: "visitante-acolhido",
    alt: "Um homem sorrindo, sentado em um banco do templo, com a congregação ao fundo.",
  },
  /** Pedido de oração. */
  prayer: {
    name: "oracao",
    alt: "A congregação em pé, de cabeça baixa, orando durante o culto.",
  },
  /** Quero ser membro (a Ceia e a membresia andam juntas no Guia Institucional). */
  supper: {
    name: "ceia",
    alt: "Mãos segurando o copinho com suco e o pão da Ceia do Senhor.",
  },
} as const satisfies Record<string, SitePhoto>;
