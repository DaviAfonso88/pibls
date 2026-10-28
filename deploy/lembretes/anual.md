Lembrete **anual** (fevereiro) do portal da PIBLS: janela de atualização e conferência (operação enxuta, ADR-021). Origem: `docs/runbooks/rotina-de-manutencao.md` e `docs/runbooks/atualizacao-anual.md`.

Toda mudança de versão **major** da stack precisa de uma **ADR** no mesmo PR (`docs/adr/`). Trabalhe em homologação, publique em produção de segunda a quarta, das 9h às 18h, e nunca perto de datas de pico da igreja.

- [ ] **Teste de restauração** do backup do B2 num banco local, com a chave privada do kit: siga `docs/runbooks/restaurar-backup.md`, anote o tempo na tabela do runbook. (Constituição VII: backup só vale se foi restaurado.)
- [ ] **Teste de rollback** em homologação (`docs/runbooks/rollback.md`, ≤ 10 min).
- [ ] **Kit de contingência**: o cofre abre? Cada entrada está atual? A pessoa de confiança ainda tem a cópia? (`docs/runbooks/kit-de-contingencia.md`)
- [ ] **Acessos**: usuários ativos do painel × pessoas na equipe (`docs/runbooks/provisionar-usuario.md`), colaboradores do GitHub, contas do cPanel e do FTP. Desativar quem saiu.
- [ ] Nova **major do Laravel** e do **PHP** que a HostGator oferece, dependências do frontend: avaliar, atualizar em homologação primeiro, ADR por major (`atualizacao-anual.md`).
- [ ] `composer audit` e `npm audit` sem pendência alta; `npm run bundle:check` sem piorar.
- [ ] **Rotação de segredos**: `APP_KEY` (com `APP_PREVIOUS_KEYS`), senha do banco e do migrador, FTP de deploy, SMTP, chave do B2 (e as chaves dos serviços que você ligou).
- [ ] Revisar a **Política de Privacidade** e os **prazos de retenção** com a liderança; se mudar, subir `PRIVACY_POLICY_VERSION`.
- [ ] Registrar a execução em `docs/runbooks/rotina-de-manutencao.md`.
