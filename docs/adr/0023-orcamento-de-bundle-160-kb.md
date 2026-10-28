# ADR-023 — Orçamento de JS do site público sobe de 150 KB para 160 KB (gzip)

- **Status:** Aceita
- **Data:** 2026-10-23 (decisão do responsável)
- **Altera:** a linha "JS inicial das rotas públicas ≤ 150 KB gzip" de `architecture.md` → Performance. Complementa a ADR-019.

## Contexto

O orçamento de 150 KB de JS inicial por rota pública (gzip, sem o painel) foi fixado antes da implementação. A ADR-019 já avisava que ele seria apertado: React 19 com `react-dom` (~65 KB), React Router 7 (~40 KB), TanStack Query (~12 KB) e `tailwind-merge` (~9 KB) somam ~125 KB antes de qualquer tela, e uma SPA sem servidor Node não descobre rotas sob demanda (o *manifest* leva todas as rotas públicas).

O `bundle:check` ficou vermelho na Fase 5 e piorou com cada história pública: 149,7 KB (Fase 4), 151,5 (Fase 5), 153,8 (Fase 7) e **155,7 KB** na pior rota (`palavra-viva-mensagem`) em 2026-10-23, depois das fotos, do destaque do YouTube e da medição de uso. As medidas estruturais já foram tomadas (painel em uma rota só, formulários e TipTap em `lazy`, páginas públicas sem zod, RHF nem Base UI, `Photo` e `BrandSymbol` sem `cn`); o que sobra é cortar conteúdo ou funcionalidade da própria página.

## Decisão

- O limite de **JS inicial por rota pública passa a 160 KB gzip**, a pior rota. O de CSS continua em **40 KB**.
- `frontend/scripts/bundle-budget.mjs` (`BUDGETS.jsGzipBytes`) e os textos que citam o número mudam no mesmo PR. O `bundle:check` continua **bloqueante no CI**.
- O número é um teto, não uma meta: a folga de ~4 KB serve a pequenas evoluções, não a dependências novas. Antes de somar uma biblioteca ao JS público, vale a regra de sempre: `lazy`, módulo próprio sem Base UI, ou texto fora de `~/shared/messages`.
- **O critério que de fato importa continua sendo o RNF-05:** LCP ≤ 2,5 s (p75, celular em 4G), medido no Lighthouse CI e no CrUX. Se o LCP sair da meta por causa do JS, o orçamento volta a ser revisto, e não esticado de novo.

## Alternativas consideradas

- **Dividir mais as rotas:** o painel já é uma rota só e os formulários já são `lazy`; o que resta no piso (~125 KB) é framework. O ganho estimado é de décimos de KB por rota, não os ~6 KB necessários para voltar a 150.
- **Trocar bibliotecas** (por exemplo TanStack Query por `fetch` puro, `react-router` por um roteador menor): dezenas de horas de retrabalho e perda de recursos já testados, para economizar uma fração do que 10 KB gzip custam em 4G (~60 ms a 1,3 Mbit/s).
- **Manter 150 KB e deixar o CI vermelho:** bloqueia todo PR e o go-live por um número sem efeito medido no usuário.
- **Subir para um valor maior (170, 200 KB):** tira a pressão que mantém o JS pequeno. 160 KB cobre o estado atual com folga curta.

## Consequências

- O CI volta a verde com a pior rota em 155,7 KB (4,3 KB de folga). Rota pública nova precisa de medição antes do PR.
- Cada KB a mais custa ~6 ms de transferência em 4G de gama média; a conta cabe no orçamento de LCP, mas deve ser verificada no Lighthouse da homologação (T164).
- Se a folga acabar, o próximo passo é revisar o LCP medido e, só então, outra ADR; não subir o teto de novo por padrão.
