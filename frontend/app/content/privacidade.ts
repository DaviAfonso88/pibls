import { institution } from "~/content/institution";

/**
 * Política de Privacidade (FR-066, C-05): conteúdo fixo, versionado no código e pré-renderizado. Texto aprovado pela
 * liderança da igreja em 2026-10-23 (TBD-06). Mudar o texto muda a versão e exige a aprovação da liderança.
 *
 * `version` precisa ser a mesma de `PRIVACY_POLICY_VERSION` em `backend/config/pibls.php`: é a versão que o servidor grava
 * em `consent_version` quando alguém marca o consentimento (BR-082). Um teste confere os dois.
 */
export const privacyPolicy = {
  version: "1.0",
  /** Data de vigência: preencher no go-live (ex.: "1º de dezembro de 2026"). */
  effectiveSince: null as string | null,

  sections: [
    {
      title: "Quem cuida dos seus dados",
      paragraphs: [
        `A ${institution.name} (CNPJ 20.969.119/0001-84) é a responsável pelos dados enviados neste site.`,
      ],
    },
    {
      title: "O que coletamos",
      paragraphs: [
        "Só o que você escreve nos formulários: nome, telefone ou e-mail, bairro, mensagem e, nos eventos, as respostas da inscrição. Pedidos de oração podem ser anônimos.",
      ],
    },
    {
      title: "Para que usamos",
      paragraphs: [
        "Para responder você, organizar o acolhimento e os eventos. Não vendemos nem compartilhamos seus dados para propaganda.",
      ],
    },
    {
      title: "Quem tem acesso",
      paragraphs: [
        "Só a equipe responsável por cada tipo de contato. Pedidos de oração são vistos apenas pela equipe de oração.",
        "Serviços que nos ajudam a manter o site: a HostGator hospeda o site e o banco de dados; o Backblaze guarda cópias de segurança já cifradas, em servidores na União Europeia; o Sentry registra erros do site, na União Europeia, sem nenhum dado pessoal seu.",
      ],
    },
  ],

  retention: {
    title: "Por quanto tempo guardamos",
    rows: [
      {
        data: "Pedido de oração",
        period: "60 dias depois de concluído (90 dias se não for concluído)",
      },
      { data: "Demais contatos", period: "12 meses depois de concluído" },
      { data: "Inscrições em eventos", period: "3 meses depois do fim do evento" },
    ],
    footnote: "Depois do prazo, os dados são apagados automaticamente.",
  },

  closingSections: [
    {
      title: "Cookies e terceiros",
      paragraphs: [
        "O site não usa cookies de rastreamento. Vídeos do YouTube e o mapa só carregam quando você toca neles.",
        "Contamos quantas pessoas abrem cada página do site com o GoatCounter, só em números agregados: sem cookies e sem identificar você.",
      ],
    },
    {
      title: "Seus direitos",
      paragraphs: [
        "Você pode pedir para ver, corrigir, levar ou apagar os seus dados. Respondemos em até 15 dias.",
        "Canal para pedidos: pibls@pibls.com.",
      ],
    },
  ],
} as const;
