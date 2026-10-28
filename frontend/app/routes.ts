import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

/**
 * Tabela de rotas (Frontend Architecture → Tabela de rotas). Cada rota entra junto com a história de usuário que cria a
 * tela; as que ainda não existem caem no 404 do site (público) ou do painel, que têm os atalhos para o que as pessoas procuram.
 *
 * /palavra-viva/:slug não é pré-renderizada: o PHP injeta a meta (ADR-004).
 * /eventos/:slug também não é pré-renderizada, pelo mesmo motivo (ADR-004). Eventos (R2): atrás da flag `features.events`.
 *
 * O painel (/admin/*) é uma única rota, num chunk à parte, fora do layout público e sem pré-renderização (ADR-013). As
 * telas dele são rotas de dentro desse chunk (`routes/admin/app.tsx`), para o manifesto de rotas do JS inicial público não
 * crescer a cada tela de painel.
 */
export default [
  layout("routes/public/layout.tsx", [
    index("routes/public/home.tsx"),
    route("quem-somos", "routes/public/quem-somos.tsx"),
    route("ministerios", "routes/public/ministerios.tsx"),
    route("grupos", "routes/public/grupos.tsx"),
    route("boletins", "routes/public/boletins.tsx"),
    route("palavra-viva", "routes/public/palavra-viva.tsx"),
    route("palavra-viva/:slug", "routes/public/palavra-viva-mensagem.tsx"),
    route("eventos", "routes/public/eventos.tsx"),
    route("eventos/:slug", "routes/public/evento.tsx"),
    route("contribua", "routes/public/contribua.tsx"),
    route("como-chegar", "routes/public/como-chegar.tsx"),
    route("sou-visitante", "routes/public/sou-visitante.tsx"),
    route("quero-ser-membro", "routes/public/quero-ser-membro.tsx"),
    route("pedido-de-oracao", "routes/public/pedido-de-oracao.tsx"),
    route("contato", "routes/public/contato.tsx"),
    route("privacidade", "routes/public/privacidade.tsx"),
    route("*", "routes/public/not-found.tsx"),
  ]),

  // O painel inteiro é UMA rota; o roteamento de dentro dela está em routes/admin/app.tsx (ver o porquê lá)
  route("admin/*", "routes/admin/app.tsx"),
] satisfies RouteConfig;
