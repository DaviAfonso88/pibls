# Atualização anual

> Origem: `architecture.md` → DevOps → Rotina de manutenção ("Anual, fevereiro–março: nova major do Laravel, versão do PHP, dependências, rotação de segredos") e a regra do projeto: **a versão da stack só muda com ADR**. É a janela para pagar a dívida de versões com calma, fora de datas de pico da igreja (Páscoa, Natal, retiros).

**Quando:** fevereiro e março. **Quem:** o responsável técnico. **Duração:** reserve duas semanas, com o trabalho todo em homologação antes de tocar a produção.

## 1. Antes de começar (1 dia)

1. Faça um **teste de restauração** do backup (`restaurar-backup.md`): é o seu paraquedas.
2. Anote as versões atuais (`composer.lock`, `package-lock.json`, PHP da conta) e o resultado do CI.
3. Leia as notas de versão e os guias de atualização: **Laravel** (a major nova, e o que mudou nas dependências que usamos: Sanctum, Pest, Larastan), **PHP** (a versão que a HostGator já oferece no MultiPHP Manager), **React**, **React Router**, **Tailwind**, **Vite**, **TipTap**. Use o Context7 para a documentação da versão exata.
4. Abra uma issue "Atualização AAAA" com o checklist abaixo. Cada mudança de **versão major** vira uma **ADR** (`docs/adr/`, número seguinte) no mesmo PR.

## 2. Dependências (3 a 5 dias)

| Frente | Como |
|---|---|
| Patches e minors | Os PRs do Dependabot da semana: `composer update` e `npm update` dentro dos limites, CI verde, deploy em homologação. |
| Major do Laravel | Ramo próprio. `composer.json`: a versão nova; rode `./vendor/bin/pest`, `pint`, `phpstan`. Corrija o que quebrou pelo guia oficial; **não** misture com funcionalidade nova. |
| PHP | Só para uma versão que a conta oferece. Mude **primeiro a homologação** (MultiPHP Manager), rode `php artisan pibls:doctor` e o E2E. `composer.json` (`config.platform.php`) e `engines` acompanham. |
| Frontend | `npm outdated`; suba por grupos (React, router, Tailwind/shadcn, TipTap). Rode `npm run typecheck && npm run lint && npm run test && npm run build && npm run bundle:check`: o orçamento de 150 KB não pode piorar. |
| Vulnerabilidades | `composer audit` e `npm audit` sem pendência alta; Semgrep do CI sem alertas novos. |

## 3. Rotação de segredos (1 dia)

Faça por último, em homologação e depois em produção, **um segredo por vez**, conferindo o site entre eles.

| Segredo | Como trocar | Cuidado |
|---|---|---|
| `APP_KEY` | `php artisan key:generate --show` local; no `.env`: a antiga em `APP_PREVIOUS_KEYS`, a nova em `APP_KEY` | **Nunca perca a antiga antes de a nova ter regravado os dados**; guarde as duas no KeePassXC |
| Senha do banco (e do migrador) | cPanel e `.env` ao mesmo tempo | O ativador usa o migrador: teste um deploy depois |
| Senha do FTP de deploy | cPanel e os segredos do Environment no GitHub | |
| `MAIL_PASSWORD` | Conta de e-mail e `.env` | Mande um e-mail de teste (redefinição de senha) |
| Chave do B2 | Crie a nova (sem exclusão), troque no `.env`, rode `pibls:backup:offsite` e só então apague a antiga | |
| URLs do Healthchecks, DSN do Sentry, chave do UptimeRobot | Painéis dos serviços e `.env` | |
| Par de chaves dos backups | Só se a privada foi exposta (`conta-comprometida.md`, item 5) | Guarde a privada antiga enquanto houver backup cifrado com ela |
| Senhas de quem usa o painel | Cada pessoa troca a sua (**Esqueci minha senha**) | Peça a quem não entra há meses para confirmar se ainda precisa do acesso |

## 4. Revisão de acessos e kit (meio dia)

1. **Usuários ativos × pessoas na equipe** (`provisionar-usuario.md`): desative quem saiu.
2. Colaboradores do GitHub e do cPanel; 2FA ligado em todos.
3. Confira que o kit de contingência está completo e atualizado com as chaves novas (`kit-de-contingencia.md`).
4. Revise os prazos de retenção e a Política de Privacidade com a liderança (mudou algo? sobe a `PRIVACY_POLICY_VERSION`).

## 5. Publicação

1. Homologação com tudo atualizado: E2E, a11y (axe), k6 e Lighthouse sem piora. Fique com ela **pelo menos uma semana** observando o resumo diário.
2. Produção: de **segunda a quarta, das 9h às 18h**, nunca perto de culto. Um bloco por vez (PHP, depois framework, depois frontend), cada um com seu deploy e sua conferência.
3. Depois de cada deploy: `GET /api/health`, início, `/contato`, `/contribua`, `/admin/entrar`, o resumo das 07:00 do dia seguinte.
4. Se algo quebrar: **rollback** (`rollback.md`) e volte para a homologação. Rollback não desfaz o banco; as migrations são *expand/contract* por isso.

## 6. Fechamento

- Atualize `CLAUDE.md`, `architecture.md` (Technology Stack) e o `docs/to-be-determined.md`, se mudaram.
- Registre a data e o que foi feito em `rotina-de-manutencao.md` (tabela de execuções).
- Marque a revisão de 6 meses (T200) se ela cair na mesma janela.
