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
  biography: [
    "Pastor batista desde 25 de março de 2000, o Pr. Alan Taques atuou por mais de duas décadas na Primeira Igreja Batista de Montes Claros, e atualmente pastoreia a Primeira Igreja Batista em Lagoa Santa com dedicação, simplicidade e zelo pela Palavra de Deus.",
    "Casado com Sara Soares Taques, pai de Lucas Henrique e Lisa Esther, entende que sua vocação pastoral está diretamente ligada ao cuidado das pessoas, ao ensino das Escrituras e ao fortalecimento da Igreja local como testemunha viva do Evangelho.",
    "Seu ministério é marcado por pregação bíblica, discipulado intencional e paixão por missões, com a firme convicção de que a Igreja deve viver para a glória de Deus e ser um instrumento de transformação em sua geração.",
  ],
  education: [
    {
      title: "Graduado em Teologia",
      institution: "Seminário Teológico do Norte de Minas (convalidado pela UNICESUMAR)",
    },
    { title: "Graduado em Psicologia", institution: "Centro Universitário FIPMOC" },
    { title: "Pós-graduado em Terapia Familiar Sistêmica", institution: null },
    { title: "Formação em Liderança Avançada", institution: "Instituto Haggai" },
  ],
} as const;

/** "Como somos": o jeito da igreja, em texto enviado pela liderança. */
export const howWeAre = {
  intro:
    "Temos a Bíblia como nossa norma de fé e prática, cultivamos o amor entre os irmãos, e cumprimos a missão ordenada por Jesus de fazer discípulos:",
  highlight: "As pessoas, de fato, importam para nós!",
} as const;

/** Ceia do Senhor: quando acontece e quem pode participar. */
export const lordsSupper = {
  title: "Ceia do Senhor",
  text: "Na PIBLS, a ceia é realizada todo primeiro domingo do mês, e todos os membros da igreja, bem como membros de outras igrejas da mesma denominação, são bem-vindos a participar deste momento de comunhão.",
} as const;

/** Declaração de Fé da Convenção Batista Brasileira: é um link, não um PDF nosso (Q-07 resolvida). */
export const creedUrl = "https://convencaobatista.com.br/site/pagina.php?MEN_ID=22";
