Lembrete mensal do portal da PIBLS (operação enxuta, ADR-021). Origem: `docs/runbooks/rotina-de-manutencao.md`. Leva uns 15 minutos. Marque cada item e feche a issue.

- [ ] Os **alertas do mês** (UptimeRobot e Healthchecks) foram resolvidos? Algum check ficou vermelho e foi ignorado?
- [ ] Conferir a **cópia no B2**: no painel do B2, existe um arquivo `db/daily/` de ontem ou de hoje?
- [ ] **Disco e inodes** da conta (cPanel → Uso de recursos): longe do limite?
- [ ] Os **contatos** estão sendo atendidos? Olhar a caixa no painel: algum parado há mais de 3 dias.
- [ ] **PRs do Dependabot** abertos há mais de 2 semanas ou alertas de segurança: mesclar os de patch e minor com o CI verde.
- [ ] Se você ligou o resumo diário: ler o do dia 1, que traz as métricas do mês.
