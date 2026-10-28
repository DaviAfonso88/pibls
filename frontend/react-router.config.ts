import type { Config } from "@react-router/dev/config";

/**
 * Rotas públicas pré-renderizadas no build (ADR-004; contracts/web-routes.md → "Páginas públicas pré-renderizadas").
 * Com "/" na lista, o `index.html` é a página inicial e o resto da SPA cai no `__spa-fallback.html` (painel e 404), que o
 * `.htaccess` serve. Cada rota pública nova entra aqui junto com a tela. `/palavra-viva/:slug` e `/eventos/:slug` ficam de fora de propósito: o PHP injeta a meta de cada um. `/eventos` é pré-renderizada, mas só mostra a lista com `features.events` ligado; desligado, é a página de "não encontrado".
 */
const PRERENDERED_ROUTES = [
  "/",
  "/quem-somos",
  "/ministerios",
  "/grupos",
  "/boletins",
  "/palavra-viva",
  "/eventos",
  "/contribua",
  "/como-chegar",
  "/sou-visitante",
  "/quero-ser-membro",
  "/pedido-de-oracao",
  "/contato",
  "/privacidade",
];

export default {
  ssr: false,
  prerender: PRERENDERED_ROUTES,
} satisfies Config;
