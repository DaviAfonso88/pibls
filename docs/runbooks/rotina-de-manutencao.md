# Rotina de manutenção

> Origem: `architecture.md` → DevOps → Rotina de manutenção (T202), na **versão enxuta da ADR-021**. Uma pessoa só cuida do portal: a rotina é curta e **lembrada pelo sistema**, e não pela memória de quem a executa.

## 1. Calendário

| Quando | O que | Como é lembrado | Checklist |
|---|---|---|---|
| A qualquer hora | Atender os **alertas** (UptimeRobot e Healthchecks): site fora do ar ou cópia externa falhando | E-mail e push dos serviços | `site-fora-do-ar.md`, `operacao-enxuta.md` (Se der errado) |
| Semanal (automático) | PRs do Dependabot | GitHub | Mesclar os de patch e minor com o CI verde |
| **Mensal** (~15 min) | Os alertas do mês foram resolvidos? A cópia de ontem está no B2? Disco e inodes, contatos parados, Dependabot | Issue no dia 1 (`lembretes.yml`) | `deploy/lembretes/mensal.md` |
| **Anual (fevereiro)** | **Teste de restauração**, teste de rollback, kit de contingência, acessos, atualização (Laravel, PHP, dependências), rotação de segredos, revisão da Política de Privacidade | Issue em fevereiro | `deploy/lembretes/anual.md` e `atualizacao-anual.md` |
| Sob demanda | Teste de restauração depois de mudar o backup ou a chave; teste de rollback depois de mudar o deploy | Você | `restaurar-backup.md`, `rollback.md` |

O workflow `.github/workflows/lembretes.yml` roda **todo dia 1, às 08:00 de São Paulo**, e abre uma issue com o checklist (a lógica está em `deploy/ci/abrir-lembretes.sh`, com teste). Rodar de novo não duplica. Para abrir um lembrete na hora: GitHub → **Actions → Lembretes de manutenção → Run workflow** e informe o tipo (`mensal` ou `anual`).

Se a igreja passar a depender mais do portal e quiser o roteiro completo (testes trimestrais, todos os checks, Sentry), religue como a ADR-021 explica.

## 2. A conferência do LCP de campo (SC-002), quando houver tráfego

O LCP de laboratório (Lighthouse em perfil móvel, 4G simulado) é medido no go-live (T164). Depois, de vez em quando (a sugestão é a janela de fevereiro, ou se o site parecer lento), veja o **de campo**, o que as pessoas vivem de verdade:

1. **Search Console** → *Experiência* → **Core Web Vitals** → Dispositivos móveis. Sem tráfego suficiente, o painel diz que não há dados: tudo bem.
2. Alternativa: `https://pagespeed.web.dev/` com a URL de produção; a seção de usuários reais traz o CrUX.
3. **Meta: LCP ≤ 2,5 s** no percentil 75. Passou da meta: abra uma issue de desempenho (imagens grandes, JS acima do orçamento de 160 KB, snapshot lento).

## 3. Registro das execuções

Anote aqui (ou na própria issue do lembrete, antes de fechá-la) o que foi feito e o que se achou. Nenhum dado pessoal.

| Data | Lembrete | Executado por | LCP de campo (p75), se medido | Observações / problemas |
|---|---|---|---|---|
| | | | | |

## 4. Responsável e substituto

O **responsável técnico** executa tudo. Se ele ficar indisponível por mais de uma semana, a liderança usa o **kit de contingência** (`kit-de-contingencia.md`) para dar acesso a outra pessoa de confiança, e o primeiro passo dela é o `site-fora-do-ar.md` e o `rollback.md`.
