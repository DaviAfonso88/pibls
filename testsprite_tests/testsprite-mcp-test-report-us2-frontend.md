# TestSprite — US2 (formulários públicos), frontend (T207)

## 1️⃣ Document Metadata
- **Projeto:** pibls · **Data:** 2026-10-22 · **Alvo:** site público servido pelo Apache local (build de produção, `npm run build && npm run deploy:local`), com dados fictícios e a API de verdade
- **Plano:** `testsprite_frontend_test_plan.json` (22 casos); executados 14 (os 8 restantes repetiam cenários já cobertos e gastariam envios do limite de 10 por IP em 10 min)

## 2️⃣ Requirement Validation Summary

| Requisito | Casos | Resultado |
|---|---|---|
| Ficha de Visitante envia e confirma ("Recebemos seu contato!") | TC001 | ✅ |
| Ficha de Visitante com grupo pré-selecionado por `?grupo=` (por URL e pelo cartão "Quero participar" de /grupos) | TC005, TC015 | ✅ |
| Quero ser membro, com e-mail e mensagem opcionais | TC004 | ✅ |
| Pedido de oração anônimo e identificado | TC002, TC010 | ✅ |
| Fale conosco e contato com ministério (`?ministerio=` e pelo link "Falar com este ministério") | TC003, TC007, TC011 | ✅ |
| Validação no navegador: campos vazios (visitante, membro), telefone ou e-mail obrigatório, pedido curto, consentimento | TC008, TC013, TC014, TC016 | ✅ |
| Política de Privacidade acessível | TC019 | ✅ |

## 3️⃣ Coverage & Matching Metrics
- **14 de 14 aprovados.** Nenhum erro de console nem tela "Algo deu errado".

## 4️⃣ Key Gaps / Risks
- O 422 do servidor no campo e o 429 com "Tentar novamente" e WhatsApp não são provocados pelo TestSprite (exigem o servidor recusando de propósito); estão nos testes de componente (`features/leads/__tests__/forms.test.tsx`) e no E2E (`e2e/specs/leads-submit.spec.ts`).
- O limite de 10 envios por IP em 10 min obriga a limpar o cache (`php artisan cache:clear`) entre execuções.
- Cada resposta leva ~10 s no Docker local (sem OPcache); as instruções mandaram esperar até 60 s pela confirmação.
