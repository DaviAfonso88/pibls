# TestSprite — US3 (acesso ao painel), backend (T208)

## 1️⃣ Document Metadata
- **Projeto:** pibls · **Data:** 2026-10-22 · **Alvo:** API local (Apache + PHP 8.4 + MySQL, Docker) com os 7 usuários do `LocalDevelopmentSeeder`
- **Plano:** `testsprite_backend_test_plan.json` (10 casos); executados 9. O TC004 (bloqueio após 5 falhas, BR-071) ficou de fora de propósito: travaria os usuários do seeder por 15 min; ele é coberto pelo Pest (`AuthenticationTest`) e pelo E2E.
- **Senhas:** durante a execução os 7 usuários usaram uma senha descartável (a real não foi enviada ao TestSprite); os hashes originais foram restaurados e conferidos depois.

## 2️⃣ Requirement Validation Summary

| Caso | Requisito | Resultado |
|---|---|---|
| TC001 | `GET /sanctum/csrf-cookie` responde 204 e grava `XSRF-TOKEN` e `pibls_session` | ✅ |
| TC002 | Login válido responde 200 com o usuário, papéis e permissões, e abre a sessão | ✅ |
| TC003 | E-mail inexistente e senha errada respondem o mesmo 422 `INVALID_CREDENTIALS` (BR-070) | ✅ |
| TC005 | `GET /api/auth/me` devolve o usuário da sessão | ✅ |
| TC006 | `POST /api/auth/logout` responde 204 e encerra a sessão | ✅ |
| TC007 | `GET /api/admin/users` responde 200 para quem tem `users.read` (pastoral, administrador técnico) | ✅ |
| TC008 | Os outros cinco papéis recebem 403 `FORBIDDEN` (BR-076) | ✅ |
| TC009 | `forgot-password` responde sempre 200 com a mesma frase e limita a 3 por hora por e-mail | ✅ |
| TC010 | Não há escrita de usuários: POST, PUT, PATCH e DELETE em `/api/admin/users` respondem 404 ou 405 (BR-077) | ✅ |

## 3️⃣ Coverage & Matching Metrics
- **9 de 9 aprovados.**

## 4️⃣ Key Gaps / Risks
- Fora do TestSprite: bloqueio de login (BR-071), sessão de 12 h e de 60 min de inatividade, usuário desativado (BR-074) e o fluxo de redefinição com token (BR-072/073). Estão em `backend/tests/Feature/Access` e no E2E `e2e/specs/access.spec.ts`.
- O limite de 20 logins por IP em 15 min exige limpar o cache (`php artisan cache:clear`) entre execuções.
