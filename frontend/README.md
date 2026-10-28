# Frontend

React 19 + React Router 7 em _framework mode_ (`ssr: false`), TypeScript `strict`. Node.js 24 só aqui e no CI; o servidor de produção recebe apenas o build estático. Contexto geral e versões fixadas: [`README`](../README.md) da raiz.

## Scripts

```bash
npm ci
npm run dev            # Vite em http://localhost:5173
npm run typecheck      # react-router typegen && tsc
npm run lint           # ESLint 9 (flat config)
npm run format:check   # Prettier (use `npm run format` para corrigir)
npm run test           # Vitest; `-- --coverage` aplica o piso de 70% de linhas
npm run build          # gera build/client (index.html no modo SPA)
```

## Estrutura

```text
app/
  root.tsx  routes.ts
  routes/public/        páginas públicas (pré-renderizadas)
  routes/admin/         painel (lazy, não pré-renderizado)
  features/<f>/         access, ministries, content, leads, events
  shared/               ui/, lib/, http/, format/, drafts/, messages.ts
  content/              conteúdo fixo em código
test/                   setup do Vitest (jest-dom e MSW 2)
```

O alias `~` aponta para `app/` (`tsconfig.json`, `vite.config.ts` e `vitest.config.ts`).

## Regras aplicadas pelo ESLint

- `features/X` não importa de `features/Y`, `routes/public` não importa de `routes/admin` e `shared/` não importa de `features/` (`import/no-restricted-paths`).
- Base UI só dentro de `app/shared/ui`; outras bibliotecas de UI e de CSS-in-JS são proibidas em todo o código (`no-restricted-imports`, ADR-018).
- `dangerouslySetInnerHTML` só em `app/shared/ui/sanitized-html.tsx`.
- `jsx-a11y` em modo `strict` e `typescript-eslint` em modo `strict`.

Estas regras foram verificadas com arquivos que as violam (rejeitados) e, na T119, ganharão a que restringe `shared/drafts`.

## Testes

Os testes ficam ao lado do código, em `__tests__/*.test.ts(x)`. O MSW sobe em `test/setup.ts` com `onUnhandledRequest: "error"`: toda requisição precisa de um handler explícito (`server.use(...)`). A cobertura só conta `app/features/**` e `app/shared/**`.

## Ainda não existe

Tailwind e shadcn/ui (T045), cliente HTTP (T047), bundle check (T052) e o proxy do Vite para `/api`, `/sanctum`, `/data` e `/uploads` previsto no quickstart.
