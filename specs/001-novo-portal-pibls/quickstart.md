# Quickstart: Novo Portal PIBLS

**Fase 1 do `/speckit.plan`** · 2026-10-20

> Como subir o ambiente local e validar cada história de ponta a ponta. Os comandos valem **depois** das tarefas F0-01 (monorepo), F0-04 (Docker Compose), F0-06 (schema) e F0-08 (base do frontend). Origem: `architecture.md` → Infrastructure (Local), Testing Strategy e Documentation Strategy.

## 1. Pré-requisitos (só na máquina de desenvolvimento)

| Ferramenta | Versão |
|---|---|
| Docker + Docker Compose | Atual |
| Node.js | 24 LTS (só local e CI; **não existe no servidor**) |
| Composer | 2.x |
| Git | Atual |

O servidor de produção não roda nada disso. Build, pré-renderização e Tailwind acontecem no CI (Constituição, Princípio II).

## 2. Subir o ambiente

```bash
git clone <repo-privado> pibls && cd pibls

# Serviços: Apache + PHP 8.4 SEM OPcache (igual à HostGator), MySQL 8.0 e Mailpit
docker compose up -d
# MySQL 5.7, para reproduzir a outra versão possível do servidor (TBD-01)
docker compose --profile mysql57 up -d

# Backend
cp backend/.env.example backend/.env       # inclui TEST_USERS_PASSWORD e PIX_ALERT_RECIPIENTS de teste
docker compose exec app composer install
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed   # schema + catálogo + conteúdo inicial + dados falsos (pt_BR)
docker compose exec app php artisan pibls:doctor     # confere extensões, limites e permissões

# Frontend
cd frontend && npm ci
npm run dev            # Vite com proxy de /api, /sanctum, /data e /uploads para o Apache local
```

| Endereço | O quê |
|---|---|
| `http://localhost:5173` | SPA em desenvolvimento |
| `http://localhost:8080` | Build servido pelo Apache com o `.htaccess` real (`npm run build && npm run deploy:local`) |
| `http://localhost:8025` | Mailpit (todos os e-mails locais) |

**Usuários de teste**: um por papel de referência. A senha é a do `TEST_USERS_PASSWORD` do `.env` local.

| E-mail | Papel |
|---|---|
| `comunicacao@pibls.test` | COMUNICACAO |
| `secretaria@pibls.test` | SECRETARIA |
| `tesouraria@pibls.test` | TESOURARIA |
| `oracao@pibls.test` | ORACAO |
| `pastoral@pibls.test` | PASTORAL |
| `lider@pibls.test` | LIDER_MINISTERIO, ligado a um ministério |
| `admin@pibls.test` | ADMIN_TECNICO |

Esses usuários vêm só do seeder local. **Usuários reais nunca entram por migration**: são criados pelo runbook `provisionar-usuario.md`, no phpMyAdmin.

## 3. Rodar os testes

```bash
# Backend: unit + feature (MySQL real) + arquitetura, com cobertura
docker compose exec app ./vendor/bin/pest --coverage --min=80
docker compose exec app ./vendor/bin/pint --test
docker compose exec app ./vendor/bin/phpstan analyse        # Larastan nível 6

# Frontend
cd frontend
npm run typecheck && npm run lint && npm run format:check
npm run test -- --coverage                                  # Vitest, ≥ 70% em features/ e shared/
npm run api:types && git diff --exit-code app/shared/api-types.ts   # contrato OpenAPI sem diferença
npm run build && npm run bundle:check                       # JS público ≤ 160 KB gzip (ADR-023), CSS ≤ 40 KB

# E2E + acessibilidade (contra http://localhost:8080)
cd ../e2e && npx playwright test                            # inclui axe: 0 violações serious/critical
```

Convenção: **todo teste de BR leva o id no nome**, por exemplo `it('BR-021 recusa inscrição quando as vagas acabaram')`. Para ver a cobertura de uma regra: `pest --filter=BR-021`.

## 4. Validação ponta a ponta por história

Cada roteiro abaixo corresponde aos *Independent Tests* da spec e vira um cenário Playwright (fumaça ou completo).

### História 1 — Visitante conhece a igreja

1. Abrir `http://localhost:8080/` em viewport de 360 px e conferir:
   - os horários do Apêndice A do PRD;
   - os avisos da campanha e da Ceia;
   - os botões do YouTube e do WhatsApp.
2. No painel, como `secretaria@`, mudar um horário em **Configurações**. Recarregar `/` e ver a mudança em até 1 minuto, sem novo build.
3. Abrir `/como-chegar`: o mapa só carrega depois do toque; os links do Maps e do Waze funcionam.
4. Abrir `/grupos`, filtrar Células de CL por bairro e conferir que nenhum endereço residencial aparece no HTML nem em `/data/ministries.json` (BR-048).
5. Em "Quero participar", conferir que `/sou-visitante?grupo=<id>` vem pré-selecionado.
6. Remover `public_html/data/settings.json` e derrubar o PHP. A página mostra o snapshot do build com o aviso "Algumas informações podem estar desatualizadas.".

### História 2 — Envio de contato

1. Enviar um contato de cada um dos 5 tipos. A resposta é sempre "Recebemos seu contato! …".
2. No Mailpit, depois de `php artisan schedule:run` (ou após 5 min), conferir os avisos. O de oração vem **sem o texto**.
3. Enviar com o honeypot preenchido (devtools): a resposta é de sucesso e nada é gravado.
4. Enviar 4 contatos com o mesmo telefone em 10 min: o 4º é recusado com "Muitas tentativas…".
5. Parar o Mailpit e enviar um contato: o contato fica gravado e o job volta para a fila.

### História 3 — Acesso ao painel

1. Entrar com cada usuário de teste e conferir o menu: cada papel vê só os seus módulos.
2. Errar a senha 5 vezes e conferir o bloqueio de 15 min.
3. Em "Esqueci minha senha", o link chega pelo Mailpit e vale uma vez só. Uma senha de 11 caracteres é recusada.
4. Desativar um usuário no banco (`is_active = 0`): a próxima ação dele volta ao login.
5. Acessar `/admin/pix` como `secretaria@`: aparece "Você não tem acesso a esta área", e a API responde 403.

### História 4 — Atendimento

1. Como `secretaria@`, atender um contato: Novo → Em atendimento (com responsável) → Concluído. Conferir o histórico.
2. Tentar Concluído → Novo: "Mudança de status não permitida.".
3. Como `secretaria@`, abrir `/admin/oracao/<id>` de um pedido: "Contato não encontrado." (BR-007).
4. Excluir a pedido do titular: o contato some, e `audit_logs` registra `lead.erased` sem dados pessoais.

### História 5 — Boletins e Palavra Viva

1. Como `comunicacao@`, cadastrar um boletim com PDF de 10 MB e outro com data futura. O futuro não aparece em `/boletins` até a data.
2. Enviar um `.pdf` falso (texto renomeado): "O arquivo precisa ser um PDF.".
3. Em `/boletins`, "Ler boletim" abre o PDF numa nova aba e "Baixar PDF" faz o download.
4. Criar uma mensagem com `<script>` colado no editor: a formatação é removida e o aviso aparece.
5. Deixar a sessão expirar (`SESSION_LIFETIME=1` no `.env` local) com uma mensagem em edição. Entrar de novo: aparece "Encontramos um rascunho não salvo. Deseja restaurar?" (FR-077).
6. `curl -s http://localhost:8080/palavra-viva/<slug> | grep og:title` mostra a meta injetada.

### História 6 — PIX

1. Em `/contribua`, "Copiar Chave PIX" mostra "Chave copiada!". Num contexto sem Clipboard API (HTTP), a chave fica selecionável.
2. Como `tesouraria@`, alterar a chave com a senha errada: nada muda.
3. Com a senha certa: auditoria `pix.updated` com o valor anterior e o novo, alerta no Mailpit e `/contribua` atualizada.
4. Remover `PIX_ALERT_RECIPIENTS` do `.env`: a alteração é bloqueada (BR-063).

### História 7 — Dados institucionais

1. Cadastrar uma célula sem bairro: "Informe o bairro.".
2. Tentar excluir um ministério com contatos: "Este item está vinculado…" (BR-047).
3. Informar 11 destinatários num tipo: "Informe até 10 e-mails válidos.".

### História 12 — Operação

1. `php artisan pibls:backup:db`: o dump cifrado aparece em `backups/`. Seguir `restaurar-backup.md` num banco vazio.
2. `php artisan pibls:retention:purge` com relógio simulado (`--now=2028-01-01`): os contatos vencidos somem, e só as quantidades vão para `audit_logs`.
3. `php artisan pibls:daily-report`: o resumo chega no Mailpit.
4. Em homologação: ensaiar 3 deploys e 3 rollbacks com `deploy.yml` e `rollback.yml`. O rollback leva ≤ 10 min.

### Histórias 9 a 11 — Eventos (R2, com `FEATURE_EVENTS=true`)

1. Como `lider@`, criar um evento do próprio ministério com 3 campos personalizados e publicar. Um evento de outro ministério aparece como "Evento não encontrado.".
2. Inscrever-se duas vezes com o mesmo nome e telefone: a 2ª é recusada. Com outro nome e o mesmo telefone, é aceita.
3. Rodar `k6 run load/registration-burst.js` contra um evento com 250 vagas: **exatamente 250** inscrições aceitas.
4. Exportar o CSV (abrir no Excel em pt-BR) e o PDF de 500 inscritos (≤ 10 s).
5. Cancelar uma inscrição: a vaga volta.

## 5. Problemas comuns

| Sintoma | Causa provável | Ação |
|---|---|---|
| 419 em todo POST | Cookie de CSRF ausente (proxy do Vite sem `/sanctum`) | Conferir o proxy em `vite.config.ts` |
| E-mails não chegam no Mailpit | Worker não rodou | `php artisan schedule:run` ou `queue:work --stop-when-empty` |
| Página pública sem estilo | Navegador abaixo do piso do Tailwind 4 | Usar um navegador suportado; o aviso de navegador desatualizado deve aparecer |
| Teste falha só no MySQL 5.7 | Recurso exclusivo do 8.0 (CTE, *window function*) | Reescrever a consulta (ADR-007) |
