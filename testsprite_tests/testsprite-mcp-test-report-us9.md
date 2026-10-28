# TestSprite — US9 (eventos no painel), frontend

Data: 2026-10-23. App local (Docker, Apache em http://localhost:8080), build de produção, dados fictícios, com `FEATURE_EVENTS=true` só durante a execução, como Comunicação (`comunicacao@pibls.test`), líder de ministério (`lider@pibls.test`, ministério Comunicação) e Secretaria. Plano escrito à mão (`testsprite_frontend_test_plan.json`), 12 casos.

## Resultado

12 de 12 passaram (100%).

| Caso | Resultado |
|------|-----------|
| TC001 Comunicação abre a lista de eventos pelo menu | Passou |
| TC002 Criar um evento como rascunho (endereço gerado do nome, redireciona para a edição) | Passou |
| TC003 Formulário vazio mostra os erros dos campos obrigatórios | Passou |
| TC004 Término antes do início e prazo depois do início são recusados (BR-025, BR-026) | Passou |
| TC005 Construtor: adicionar, ordenar e salvar perguntas (BR-031) | Passou |
| TC006 Marcar pergunta como informação de saúde mostra o aviso do consentimento (ADR-020) | Passou |
| TC007 Publicar, encerrar inscrições (com confirmação), reabrir e despublicar | Passou |
| TC008 Evento publicado aparece em `/sitemap.xml` e em `upcoming_events` de `/data/home.json` (T177) | Passou |
| TC009 Excluir um rascunho depois de confirmar (BR-028) | Passou |
| TC010 Líder vê só os eventos do próprio ministério e tem o ministério travado (BR-030) | Passou |
| TC011 Líder não abre evento de outro ministério: "Não encontramos este evento." (BR-030) | Passou |
| TC012 Secretaria não tem a área Eventos, nem no menu nem pelo endereço (BR-076) | Passou |

## O que este relatório não cobre, e onde está coberto

- **Flag desligada → `/api/admin/events*` responde 404** (item da T215): o ambiente da execução tinha a flag ligada, então esse caso não cabe aqui. Está em `AdminEventsTest` ("com FEATURE_EVENTS desligada toda rota de /api/admin/events responde 404"), na matriz de autorização e em `EventMetaTest` (sitemap, `home.json` e `/eventos/{slug}`), todos no Pest. Depois da execução a flag voltou a `false` e os snapshots foram regenerados (`upcoming_events: []`).
- **Envio da imagem de capa (BR-045):** o agente do TestSprite não envia arquivo do disco; ficou fora do plano de propósito. Coberto no Pest (WebP de 1600 e 800 px, troca, remoção, tipo inválido, 413) e no Vitest (envio depois de criar, recusa de tipo, falha da imagem).
- **Regras de vagas contra inscritos (BR-027) e confirmação de mudança do formulário com inscrições (BR-029):** dependem de inscrições, que só existem a partir da US10. Cobertas no Pest (`AdminEventsTest`, `FormSchemaTest`) e no Vitest (`form-builder.test.tsx`, `admin-events.test.tsx`).

## Ambiente e limpeza

- Dados de apoio: dois eventos "TS …" (um de outro ministério e um do ministério do líder), criados antes da execução por um script temporário.
- Depois: os 7 eventos "TS …" (os 2 de apoio e os 5 criados pelos testes) foram removidos, o script foi apagado, `FEATURE_EVENTS` voltou a `false` no `.env` local e `pibls:snapshots:refresh` regenerou os arquivos.
- O `bootstrap` abre uma página local de configuração e espera o "commit" no navegador; como a configuração era a mesma que o comando passou (frontend, porta 8080, `/admin/entrar`), o `config.json` foi gravado já confirmado e o bootstrap pendente foi encerrado.
- O runner foi encerrado sem derrubar o servidor MCP. Custo: cerca de 3,6 créditos de 46,7.
