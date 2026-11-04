import { institution } from "~/content/institution";
import { yearsSince } from "~/shared/format";

/**
 * Conteúdo fixo de "Quem somos" (C-05): fonte `docs/conteudo-institucional.md` (site atual e Guia Institucional). O que
 * as fontes não trazem (anos do terreno, períodos dos pastores, fotos) fica de fora em vez de inventado; a Secretaria
 * confere cada texto antes do go-live (TBD-11).
 */

/** A fundação é 13/01/1985; meio-dia em UTC mantém o dia 13 no fuso de Brasília. */
const FOUNDED_AT = new Date(`${institution.foundedOn}T12:00:00Z`);

/** Anos completos de fé e serviço, sempre contados a partir de 13/01/1985 (C-05; US1 cenário 4). */
export function churchAge(now: Date = new Date()): number {
  return yearsSince(FOUNDED_AT, now);
}

export interface Milestone {
  year: string;
  title: string;
  text: string;
}

/** Marcos da linha do tempo. As fontes só datam a fundação, a liderança atual e o desabamento. */
export const timeline: readonly Milestone[] = [
  {
    year: "1985",
    title: "A fundação",
    text: "Em 13 de janeiro, a igreja nasce no bairro Promissão, em Lagoa Santa.",
  },
  {
    year: "Mais tarde",
    title: "O terreno",
    text: "Com o apoio dos batistas norte-americanos, a igreja adquire o terreno atual e constrói o antigo templo.",
  },
  {
    year: "2012",
    title: "A liderança do Pr. Joselito",
    text: "Em fevereiro, o Pr. Joselito F. Sena assume o pastorado.",
  },
  {
    year: "2018",
    title: "O desabamento",
    text: "Um acidente leva ao desabamento do templo, e começa a campanha Estamos Construindo.",
  },
  {
    year: "2026",
    title: "O novo pastor",
    text: "Em outubro, o Pr. Alan Gefferson de Assunção Taques assume o pastorado da igreja.",
  },
  {
    year: "Hoje",
    title: "A reconstrução",
    text: "A reconstrução segue em curso, com a contribuição de membros e amigos.",
  },
];

/** Os pastores que serviram a igreja, na ordem do Guia Institucional (as fontes não trazem os períodos). */
export const formerPastors: readonly string[] = [
  "Vanduídes Cristovam dos Santos",
  "José Pinto de Resende",
  "Sinésio Vilaça da Silva",
  "Sebastião Oliveira de Souza",
  "Adilson Cleuber Lourenço",
  "Ozimar Machado Leite",
  "Buglêr Silva Meira",
  "Luiz Carlos",
  "Joselito F. Sena",
];

/** O Pr. Sebastião Oliveira de Souza pastoreou a igreja em duas ocasiões. */
export const pastorWithTwoTerms = "Sebastião Oliveira de Souza";

export const titularPastor = {
  name: "Pr. Alan Gefferson de Assunção Taques",
  since: "outubro de 2026",
  // Texto enviado pela liderança em 2026-10-30. O parágrafo da formação ("É graduado em Teologia, Psicologia e
  // Licenciatura em Matemática, possui pós-graduação em Terapia Familiar Sistêmica, Geografia e Arqueologia Bíblica,
  // além de formação em Liderança Avançada pelo Instituto Haggai.") aparece como a lista `education`, não como parágrafo
  biography: [
    "Há mais de 26 anos, o Pr. Alan Taques dedica sua vida ao ministério pastoral, servindo a Deus e cuidando de pessoas por meio da pregação da Palavra, do discipulado e do ensino das Escrituras.",
    "Iniciou seu ministério em Montes Claros (MG), onde pastoreou a Igreja Batista do bairro Independência e, posteriormente, a Primeira Igreja Batista de Montes Claros por mais de duas décadas. Também pastoreou a Primeira Igreja Batista em Ponte Nova e, atualmente, serve como pastor titular da Primeira Igreja Batista em Lagoa Santa.",
    "Casado com Sara Soares Taques, é pai de Lucas Henrique, casado com Julia Monique, e de Lisa Esther. Sua caminhada ministerial é marcada pelo compromisso com a Bíblia, pelo cuidado com as famílias, pela formação de discípulos e pela paixão pela obra missionária.",
    "Seu desejo é servir a Deus com fidelidade, cuidar de pessoas com amor e conduzir a Igreja a viver e anunciar o Evangelho de Jesus Cristo, para a glória de Deus.",
  ],
  // As instituições de Teologia e Psicologia vêm do texto anterior da liderança; o novo não as cita
  education: [
    {
      title: "Graduado em Teologia",
      institution: "Seminário Teológico do Norte de Minas (convalidado pela UNICESUMAR)",
    },
    { title: "Graduado em Psicologia", institution: "Centro Universitário FIPMOC" },
    { title: "Licenciado em Matemática", institution: null },
    { title: "Pós-graduado em Terapia Familiar Sistêmica", institution: null },
    { title: "Pós-graduado em Geografia", institution: null },
    { title: "Pós-graduado em Arqueologia Bíblica", institution: null },
    { title: "Formação em Liderança Avançada", institution: "Instituto Haggai" },
  ],
} as const;

export interface Pillar {
  key: "biblia" | "amor" | "missao";
  title: string;
  text: string;
}

/**
 * "Como somos": o jeito da igreja, em texto enviado pela liderança ("Temos a Bíblia como nossa norma de fé e prática,
 * cultivamos o amor entre os irmãos, e cumprimos a missão ordenada por Jesus de fazer discípulos: as pessoas, de fato,
 * importam para nós!"). Os três pilares são as três partes da frase, com as mesmas palavras.
 */
export const howWeAre: { readonly pillars: readonly Pillar[]; readonly highlight: string } = {
  pillars: [
    { key: "biblia", title: "A Bíblia", text: "Temos a Bíblia como nossa norma de fé e prática." },
    { key: "amor", title: "O amor", text: "Cultivamos o amor entre os irmãos." },
    {
      key: "missao",
      title: "A missão",
      text: "Cumprimos a missão ordenada por Jesus de fazer discípulos.",
    },
  ],
  highlight: "As pessoas, de fato, importam para nós!",
};

/** Ceia do Senhor: quando acontece e quem pode participar. */
export const lordsSupper = {
  title: "Ceia do Senhor",
  text: "Na PIBLS, a ceia é realizada todo primeiro domingo do mês, e todos os membros da igreja, bem como membros de outras igrejas da mesma denominação, são bem-vindos a participar deste momento de comunhão.",
} as const;

/** Declaração de Fé da Convenção Batista Brasileira: é um link, não um PDF nosso (Q-07 resolvida). */
export const creedUrl = "https://convencaobatista.com.br/site/pagina.php?MEN_ID=22";
