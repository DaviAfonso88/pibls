import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// No desenvolvimento a SPA roda no Vite (5173) e fala com o Apache + PHP do Docker (8080). Em produção os dois estão na
// mesma origem, então o código usa sempre caminhos relativos (cookies de sessão e CSRF funcionam sem CORS).
const backend = process.env.VITE_DEV_BACKEND ?? "http://localhost:8080";

export default defineConfig({
  // O plugin do Tailwind vem antes do React Router (ADR-018)
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": backend,
      "/sanctum": backend,
      "/data": backend,
      "/uploads": backend,
    },
  },
});
