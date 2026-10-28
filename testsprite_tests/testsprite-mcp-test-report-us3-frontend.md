# TestSprite — US3 (acesso ao painel), frontend (T208)

## 1️⃣ Document Metadata
- **Projeto:** pibls · **Data:** 2026-10-22 · **Alvo:** painel em `http://localhost:8080/admin` (build de produção servido pelo Apache local), com os usuários do `LocalDevelopmentSeeder`
- **Plano:** `testsprite_frontend_test_plan.json` (17 casos); executados 11 (os 6 restantes repetiam cenários do diretório e da negação já cobertos, e cada login pesa no limite de 20 por IP em 15 min)
- **Senhas:** os usuários usaram uma senha descartável durante a execução; os hashes originais foram restaurados e conferidos depois.

## 2️⃣ Requirement Validation Summary

| Requisito | Casos | Resultado |
|---|---|---|
| Entrar e chegar ao início do painel | TC001 | ✅ |
| Credenciais inválidas mostram a frase única "E-mail ou senha inválidos." (BR-070) | TC002 | ✅ |
| Rota protegida sem sessão leva ao login e volta à rota pedida depois de entrar | TC003 | ✅ |
| Validação do login: campos vazios e e-mail malformado | TC004, TC007 | ✅ |
| Sair encerra a sessão e volta ao login | TC005 | ✅ |
| Menu só com os módulos do papel (pastoral) | TC006 | ✅ |
| Esqueci minha senha: confirmação igual para qualquer e-mail e validação do formato | TC008, TC011 | ✅ |
| Diretório de usuários somente leitura para quem tem `users.read` | TC009 | ✅ |
| Acesso direto sem permissão mostra "Você não tem acesso a esta área" com o caminho de volta | TC015 | ✅ |

## 3️⃣ Coverage & Matching Metrics
- **11 de 11 aprovados.** Nenhum erro de console nem tela "Algo deu errado".

## 4️⃣ Key Gaps / Risks
- Fora do TestSprite: redefinição de senha pelo e-mail (token, uso único, sessões encerradas), bloqueio por tentativas (BR-071), sessão de 12 h e usuário desativado. Estão no E2E `e2e/specs/access.spec.ts` (15 cenários, 15 aprovados) e em `backend/tests/Feature/Access`.
- O limite de 20 logins por IP em 15 min exige limpar o cache (`php artisan cache:clear`) entre execuções.
- Cada resposta leva ~10 s no Docker local (sem OPcache).
