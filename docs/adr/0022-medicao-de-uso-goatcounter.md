# ADR-022 — Medição de uso do site com GoatCounter

- **Status:** Aceita
- **Data:** 2026-10-23 (decisão do responsável)
- **Resolve:** TBD-09 (FR-076)

## Contexto

A spec 001 exige medição agregada de uso, **sem cookies, sem identificar a pessoa e, portanto, sem banner de consentimento** (FR-076). O site também não pode carregar rastreador de terceiros. A ferramenta ficou em aberto (TBD-09) até o go-live.

## Decisão

Usar o **GoatCounter** (software livre, sem cookies, sem `localStorage`, sem impressão digital do aparelho, IP não guardado). O plano gratuito atende o uso não comercial de uma igreja local.

- **Configuração no build**, nunca no código: `VITE_ANALYTICS_SRC` (o `count.js`) e `VITE_ANALYTICS_ENDPOINT` (`https://<código>.goatcounter.com/count`). Vazias, não há script nenhum (é o estado de desenvolvimento, de testes e de qualquer ambiente sem a medição). O workflow de deploy lê as duas de variáveis do repositório (`vars`), como já faz com o DSN do Sentry.
- **Um único script**, injetado por `shared/observability/analytics.tsx` depois da hidratação, e **nunca em `/admin*`**: a equipe não é público a medir e o painel mostra dado pessoal.
- **Só o caminho é contado** (`/boletins`), nunca a query string nem o hash (`?grupo=23`, `?q=nome`). Cada navegação do React Router vira um pageview, com `no_onload` para que o primeiro também passe por esse filtro.
- **CSP** (`deploy/htaccess/public_html.htaccess`, no mesmo PR): `script-src … https://gc.zgo.at` e `connect-src … https://*.goatcounter.com`. O curinga existe porque o código do site só é conhecido na criação da conta; quem quiser fechar troca pelo endereço exato. O GoatCounter envia por `navigator.sendBeacon`, então `img-src` não muda.
- **Política de Privacidade** ganha uma frase em "Cookies e terceiros" dizendo que o uso é medido de forma agregada, sem cookies. **O texto foi aprovado pela liderança: a frase nova precisa da mesma aprovação antes do go-live.**

## Alternativas consideradas

- **Plausible / Umami:** também sem cookies, mas o plano gratuito deixa de existir (Plausible) ou exige hospedar um servidor com banco, o que o servidor desta hospedagem (sem Node.js, sem SSH) não permite.
- **Google Analytics:** usa cookies e exige banner; contraria FR-076.
- **Contador próprio no Laravel:** controle total, mas é código a manter para quem opera sozinho; o GoatCounter já filtra robôs e faz o agregado.
- **Hospedar o `count.js` no próprio domínio** (`VITE_ANALYTICS_SRC=/count.js`): tira o terceiro do `script-src`. Fica possível sem mudar código; só não foi adotado de saída porque cria um arquivo de terceiro para atualizar à mão.

## Consequências

- Uma conta no GoatCounter precisa ser criada (responsável) e o `<código>` entra nas duas variáveis do GitHub.
- O visitante faz mais uma conexão (ao `gc.zgo.at`, uma vez, e ao `goatcounter.com`, a cada página); nenhuma carrega cookie.
- Quem bloqueia rastreadores não é contado: o número é uma estimativa, não um censo. Serve para ver quais páginas a igreja usa.
- Revisão: se o plano gratuito mudar (TBD-07), trocar a ferramenta é mudar duas variáveis, uma linha da CSP e um componente.
