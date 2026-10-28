# Checklist OWASP ASVS 4.0.3, nível 1

> Origem: T160 e QA-01. Cada linha cita o controle e **onde ele está provado** (arquivo ou teste); nada aqui é "achamos que sim". Estados: ✅ atendido e testado · 🟡 atendido no código, **a confirmar em homologação** (o ZAP semanal ou a conferência manual do §3) · ⚪ não se aplica ao portal (sem o recurso). Revisado em 2026-10-23, sobre o código local. **A T160 só fecha com a primeira execução do ZAP em homologação e a conferência do §3.**

## 1. Resultado

- **Achado alto aberto: nenhum conhecido.**
- **Achado médio aceito:** CSP com `'unsafe-inline'` em `script-src` e `style-src` (§2, V14.4). Registrado como débito técnico aceito na arquitetura. Caminho para fechar: hashes SHA-256 dos scripts inline de hidratação, gerados no build e escritos no `.htaccess`.
- **Pendências de confirmação:** as linhas 🟡.

## 2. Controles por capítulo

### V1 Arquitetura, projeto e modelagem de ameaças
| Controle | Estado | Evidência |
|---|---|---|
| Componentes e dados sensíveis identificados; modelo de ameaças | ✅ | `architecture.md` → Security (Threat model, Data Privacy Strategy) |
| Autenticação, controle de acesso, validação e log têm um ponto único e conhecido | ✅ | Actions + Policies + `UploadStore` + `AuditLogger`; teste de arquitetura (`tests/Arch`) |

### V2 Autenticação
| Controle | Estado | Evidência |
|---|---|---|
| Senha com no mínimo 12 caracteres e até 72 bytes; sem regras de composição absurdas | ✅ | BR-073; `PasswordResetTest`, `HashPasswordCommandTest` |
| Senha contra a lista de vazadas (HIBP) | ✅ | BR-073, I-05; falha aberta com `warning` no log |
| Armazenamento com hash adaptativo (bcrypt, custo 12) | ✅ | `Login.php`, `pibls:hash-password`; `BCRYPT_ROUNDS` |
| Mensagem única para e-mail inexistente e senha errada, sem diferença de tempo | ✅ | BR-070; `Login.php` (hash falso); E2E `access.spec.ts` |
| Limite de tentativas por e-mail e por IP, com bloqueio temporário | ✅ | BR-071 (`LoginThrottle`); `RateLimitersTest` |
| Redefinição por link de uso único, com prazo (60 min), que encerra as outras sessões | ✅ | `config/auth.php`; E2E "redefinição de senha pelo e-mail" |
| Resposta genérica no "esqueci minha senha" (não revela se o e-mail existe) | ✅ | BR-072; `PasswordResetTest` |
| Sem senha padrão nem credencial no código | ✅ | `.env` fora do git; usuários só por `provisionar-usuario.md` (BR-077); CI barra segredo |
| Autenticação multifator | ⚪ | Fora do nível 1 |

### V3 Sessão
| Controle | Estado | Evidência |
|---|---|---|
| Id de sessão novo no login; invalidado no logout | ✅ | E2E "o cookie de sessão é HttpOnly… e o id muda no login" |
| Cookie `HttpOnly`, `Secure` (produção) e `SameSite=Strict` | ✅ | `config/session.php`; E2E de cookies |
| Expiração por inatividade (60 min) e limite de sessões | ✅ | `SESSION_LIFETIME=60`; middleware `session.limits` |
| Sessão guardada no servidor (banco), id não previsível | ✅ | `SESSION_DRIVER=database` |
| Proteção contra CSRF em toda ação que muda estado | ✅ | Sanctum + `X-XSRF-TOKEN`; `SubmitLeadTest` e `ErrorEnvelopeTest` (419 sem token) |

### V4 Controle de acesso
| Controle | Estado | Evidência |
|---|---|---|
| Autorização no servidor, por permissão, em toda rota administrativa | ✅ | BR-076; `AuthorizationMatrixTest` (papel × rota) |
| Menor privilégio: o que o papel não pode, não vê e a API recusa | ✅ | E2E `full/painel-por-papel.spec.ts` (7 papéis × 9 telas) |
| Recurso fora do escopo responde 404, sem revelar que existe | ✅ | BR-030; `AuthorizationMatrixTest`, E2E `access.spec.ts` |
| Sem referência direta insegura a objetos (IDs de outro escopo) | ✅ | Policies por escopo (`.own`); `AuthorizationMatrixTest` |
| A aplicação nunca altera usuários e permissões | ✅ | BR-077, teste de arquitetura |

### V5 Validação, sanitização e codificação
| Controle | Estado | Evidência |
|---|---|---|
| Validação de entrada no servidor, por lista de permissão | ✅ | Form Requests; `value objects` (`PhoneNumber`, `PersonName`) |
| Consultas parametrizadas (sem concatenar SQL) | ✅ | Eloquent e query builder; PHPStan nível 6; Semgrep no CI |
| Saída codificada contra XSS; HTML só onde sanitizado | ✅ | React escapa; `dangerouslySetInnerHTML` só em `SanitizedHtml`; HTMLPurifier (BR-046); E2E "mensagem com `<script>`" |
| Sem injeção de comando, de template ou de caminho | ✅ | Sem `exec` de entrada do usuário; `UploadStore` gera o nome; `ImportLegacyCommand` recusa `..` |
| Redirecionamento aberto | ✅ | `safeReturnPath` (volta só para rota interna); E2E "depois do login volta à rota que a pessoa pediu" |
| Desserialização insegura | ⚪ | Sem desserializar dado do usuário |

### V6 Criptografia armazenada
| Controle | Estado | Evidência |
|---|---|---|
| Dados sensíveis cifrados em repouso (campos 🔒) | ✅ | ADR-016; `EncryptedFieldsTest` |
| Algoritmos aprovados e chaves fora do código | ✅ | AES-256-CBC + HMAC; `APP_KEY` no `.env` (permissão 600); backups com libsodium (ADR-011, `BackupTest`) |
| Aleatoriedade segura para tokens e nomes de arquivo | ✅ | `random_bytes`/CSPRNG do Laravel |

### V7 Tratamento de erros e log
| Controle | Estado | Evidência |
|---|---|---|
| Erros genéricos ao cliente, sem pilha nem detalhes internos | ✅ | Envelope `{error:{code,message,details,traceId}}`; `ErrorEnvelopeTest`; `APP_DEBUG=false` no `env.example` (`TemplatesTest`) |
| Log sem dado pessoal, senha, token ou corpo de requisição | ✅ | `PiiScrubber`; `AccessLogTest`; Sentry com `before_send` |
| Auditoria de ações sensíveis, só inclusão | ✅ | `AuditLogger`; `audit_logs` (24 meses) |
| Falha de segurança deixa rastro e alerta | ✅ | `auth.login_failed` na auditoria; Healthchecks e UptimeRobot (ADR-021) |

### V8 Proteção de dados
| Controle | Estado | Evidência |
|---|---|---|
| Dado sensível não vai ao cliente além do necessário | ✅ | BR-048, BR-050; `PublicSettingsTest`, E2E "nunca traz o endereço residencial" |
| Dado sensível fora de URL, cache e `localStorage` | ✅ | `shared/drafts` só em conteúdo, nunca dado pessoal (regra do projeto) |
| Retenção e exclusão (LGPD) | ✅ | BR-080, BR-081; `RetentionPurgeTest` |
| Respostas autenticadas da API sem cache compartilhado | 🟡 | Conferir `Cache-Control: no-store`/`private` nas rotas `/api/admin` e `/api/auth/me` (§3) |

### V9 Comunicação
| Controle | Estado | Evidência |
|---|---|---|
| TLS em todo o tráfego; HSTS | ✅ | AutoSSL; `Strict-Transport-Security: max-age=31536000` (`TemplatesTest`) |
| Conexões do servidor a terceiros por TLS | ✅ | SMTP 465, B2, Sentry, Healthchecks, HIBP por HTTPS |

### V10 Código malicioso
| Controle | Estado | Evidência |
|---|---|---|
| Dependências sem vulnerabilidade conhecida alta | ✅ | `composer audit`, `npm audit`, Dependabot e Semgrep no CI |
| Sem código que chame de volta ou carregue script de terceiro | ✅ | CSP `default-src 'self'`; sem CDN (regra do projeto); medição sem cookies (FR-076) |
| Integridade do que vai ao servidor | ✅ | SHA-256 do pacote conferido pelo ativador (`FinalizeTest`) |

### V11 Lógica de negócio
| Controle | Estado | Evidência |
|---|---|---|
| Limite contra abuso e automação nos formulários públicos | ✅ | Honeypot, limite por IP e por telefone (BR-002, BR-003); E2E "4º envio recusado" |
| Fluxos em ordem, sem pular etapas (status do contato) | ✅ | BR-008 (`INVALID_STATUS_TRANSITION`) |
| Concorrência sem corrida (vagas) | ⚪ | Eventos são da R2 (T180 e T194) |

### V12 Arquivos e recursos
| Controle | Estado | Evidência |
|---|---|---|
| Upload só do tipo esperado, validado pelo conteúdo, com limite | ✅ | `UploadStore` (finfo + assinatura, 10 MB); `UploadStoreTest`, E2E "PDF falso é recusado" |
| Nome do arquivo gerado, caminho fora do controle do usuário | ✅ | `uploads/<tipo>/AAAA/<32 hex>.<ext>` |
| Arquivo enviado não executa no servidor | ✅ | `uploads/.htaccess` nega execução (`TemplatesTest`); imagens reencodadas |
| Sem listagem de diretório | ✅ | `Options -Indexes` (RNF-04) |

### V13 API
| Controle | Estado | Evidência |
|---|---|---|
| Métodos HTTP restritos; resposta 404/405 correta | ✅ | `routes` por módulo; E2E "rota desconhecida" |
| Entrada JSON validada; tipos de conteúdo corretos | ✅ | Form Requests; `X-Content-Type-Options: nosniff` |
| Sem CORS aberto | ✅ | Mesma origem; sem `Access-Control-Allow-Origin` |

### V14 Configuração
| Controle | Estado | Evidência |
|---|---|---|
| Cabeçalhos: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` | ✅ | `public_html.htaccess` (`TemplatesTest`, E2E "cabeçalhos de segurança") |
| **CSP presente** | 🟡 | Presente e restritiva (`default-src 'self'`, sem terceiros além do YouTube sem cookies e do Google Maps), **mas com `'unsafe-inline'`** em `script-src` e `style-src`: débito técnico aceito; o ZAP vai listá-lo como aviso (regra 10055, mantida em `WARN` em `deploy/zap/rules.tsv`) |
| Ambiente de produção sem debug, sem documentação da API | ✅ | `APP_DEBUG=false`; `API_DOCS_ENABLED=false` (as rotas nem são registradas) |
| Build reproduzível, com lockfiles; sem componente desatualizado conhecido | ✅ | `composer.lock`, `package-lock.json`; Dependabot |
| `.env`, `.git` e arquivos de backup fora do docroot | ✅ | Pastas `private/`; `docs/runbooks/setup-hospedagem.md` §2.3 |

## 3. Conferência manual em homologação (junto da primeira execução do ZAP)

1. `curl -sI https://homolog.pibls.com/api/auth/me` e uma rota `/api/admin/*` com sessão: o cabeçalho de cache impede cache compartilhado (`private`/`no-store`)? Se não, corrigir no middleware da API e acrescentar um teste.
2. `curl -sI https://homolog.pibls.com/.env`, `/.git/config`, `/uploads/`, `/storage/`, `/vendor/`: todos 403 ou 404, sem listagem.
3. Erro provocado (rota `/api/admin/xyz` sem sessão e com sessão): o corpo é o envelope padrão e não traz pilha.
4. Abrir o relatório do ZAP (artefato do workflow `OWASP ZAP baseline`): nenhum alerta **alto**; os médios explicados aqui ou corrigidos.
5. Registrar a data e o resultado aqui:

| Data | Quem | Resultado do ZAP | Itens corrigidos / aceitos |
|---|---|---|---|
| | | | |
