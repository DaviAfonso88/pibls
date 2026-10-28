// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

const features = ["access", "ministries", "content", "leads", "events"];

/** As únicas features com formulário de conteúdo público, que podem guardar rascunho local (FR-077). */
const draftFeatures = ["content", "events"];

/** Bibliotecas de UI e de CSS-in-JS proibidas em todo o frontend (ADR-018). */
const forbiddenUiLibraries = {
  group: [
    "@mui/*",
    "@emotion/*",
    "@chakra-ui/*",
    "@mantine/*",
    "@radix-ui/*",
    "@headlessui/*",
    "@heroui/*",
    "@nextui-org/*",
    "@ark-ui/*",
    "@fluentui/*",
    "@stitches/*",
    "antd",
    "react-bootstrap",
    "bootstrap",
    "primereact",
    "semantic-ui-react",
    "styled-components",
    "styled-jsx",
  ],
  message:
    "UI só com Tailwind 4 e os componentes de ~/shared/ui (shadcn/ui). Outras bibliotecas de UI ou de CSS-in-JS são proibidas (ADR-018).",
};

/** Base UI só pode ser importada dentro de app/shared/ui. */
const baseUiOutsideSharedUi = {
  group: ["@base-ui/*", "@base-ui-components/*"],
  message: "Base UI só em ~/shared/ui. Use o componente de ~/shared/ui (ADR-018).",
};

export default defineConfig([
  globalIgnores([
    "build/",
    ".react-router/",
    "coverage/",
    "node_modules/",
    "app/shared/api-types.ts",
    ".lighthouseci/",
    "app/content/snapshots/",
  ]),

  {
    files: ["**/*.{js,mjs}"],
    extends: [js.configs.recommended],
    // Scripts de build rodam no Node
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
      },
    },
  },

  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.strict, jsxA11y.flatConfigs.strict],
    plugins: { import: importPlugin },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json", alwaysTryTypes: true },
      },
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // features ↛ features (cada feature só enxerga a si mesma e o shared)
            ...features.map((feature) => ({
              target: `./app/features/${feature}`,
              from: "./app/features",
              except: [`./${feature}`],
              message:
                "Uma feature não importa de outra feature. Suba o código comum para ~/shared.",
            })),
            // Rascunho local (FR-077): só features/content e features/events importam ~/shared/drafts. Atendimento, anotações,
            // inscrições e PIX nunca guardam nada no navegador; as rotas também ficam de fora.
            ...features
              .filter((feature) => !draftFeatures.includes(feature))
              .map((feature) => ({
                target: `./app/features/${feature}`,
                from: "./app/shared/drafts",
                message:
                  "~/shared/drafts (rascunho local, FR-077) só em features/content e features/events. Dado pessoal nunca vai para o navegador.",
              })),
            {
              target: "./app/routes",
              from: "./app/shared/drafts",
              message:
                "~/shared/drafts só em features/content e features/events; as rotas usam os componentes dessas features.",
            },
            // public ↛ admin
            {
              target: "./app/routes/public",
              from: "./app/routes/admin",
              message:
                "As rotas públicas não importam do painel (o painel entra no bundle só por lazy()).",
            },
            // shared ↛ features
            {
              target: "./app/shared",
              from: "./app/features",
              message: "~/shared não importa de ~/features.",
            },
          ],
        },
      ],
      "no-restricted-imports": [
        "error",
        { patterns: [forbiddenUiLibraries, baseUiOutsideSharedUi] },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            "dangerouslySetInnerHTML só no componente de HTML sanitizado (~/shared/ui/sanitized-html.tsx), para campos SanitizedHtml.",
        },
      ],
    },
  },

  // Dentro de shared/ui a Base UI é permitida; as demais bibliotecas continuam proibidas.
  {
    files: ["app/shared/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [forbiddenUiLibraries] }],
    },
  },

  // Único lugar onde dangerouslySetInnerHTML é aceito.
  {
    files: ["app/shared/ui/sanitized-html.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
]);
