# ADR-020 — Consentimento específico para dados de saúde nas inscrições (`FormField.sensitive`)

- **Status:** Aceita pelo responsável; confirmação da liderança pastoral pendente (TBD-12)
- **Data:** 2026-10-23 (decisão do responsável em 2026-10-20)

## Contexto

A estratégia de privacidade (`architecture.md` → Data Privacy → Base legal) exige consentimento específico (LGPD, art. 11, I) quando o formulário de inscrição tiver campo marcado como sensível. Mas o `FormField` (BR-031, CAP-06, `events.form_schema`) não tinha esse marcador, e o construtor de formulário da R2 deixava o líder pedir alergia, medicamento ou restrição médica sem esse consentimento. Os acampamentos e retiros, que têm menores, são o caso real. Achado no `/speckit.checklist` (security CHK008 e api CHK027).

## Decisão

- `FormField` ganha `sensitive`: booleano, opcional, padrão `false`, sem relação com o `type`.
- Se o `form_schema` do evento tiver algum campo `sensitive = true`, o formulário público mostra um **segundo checkbox, destacado e separado do consentimento geral**: "Autorizo o uso destas informações de saúde para a organização do evento".
- A API exige `health_consent = true` nessa situação (BR-083) e grava `event_registrations.health_consent_at` com a `consent_version` vigente (BR-082). Sem campo sensível, `health_consent` é ignorado e `health_consent_at` fica `NULL`.
- A regra vale pelo schema vigente na hora da inscrição. Inscrições anteriores não são alteradas: `health_consent_at` fica `NULL` e a migration não preenche o histórico (*expand*, coluna nula).
- O construtor mostra, no campo, a dica "Marque se a resposta for informação de saúde" e o aviso de que o formulário passa a exigir o consentimento específico.
- As respostas já são cifradas (`answers` 🔒, ADR-016); `sensitive` não muda isso nem o prazo de retenção das inscrições (FR-065).

## Alternativas consideradas

- *Proibir campos de saúde no construtor e coletar o dado fora do portal:* mais simples, mas empurra o dado para WhatsApp e papel, sem consentimento nem retenção controlados; descartada.
- *Consentimento geral cobrindo saúde:* não atende ao art. 11, I (consentimento específico e destacado); descartada.
- *Detectar campo de saúde por palavra no rótulo:* frágil e opaca para o líder; descartada em favor do marcador explícito.

## Consequências

- *Positivas:* o líder decide por campo, o titular consente de forma específica e o momento do consentimento fica provado.
- *Negativas:* um campo a mais no schema, no construtor, na API e na migration; o líder precisa lembrar de marcar (a dica e o aviso reduzem o risco, mas não o eliminam).
- *A observar:* a Política de Privacidade (TBD-06) deve citar o tratamento de dados de saúde em inscrições e a finalidade do consentimento específico.

## Propagação (T167)

`architecture.md` (CAP-06, tabela `event_registrations`, BR-031, BR-083, Base legal, exemplo de API, TBD-12), `specs/001-novo-portal-pibls/data-model.md` (`FormField`, `event_registrations`), `specs/001-novo-portal-pibls/contracts/openapi.yaml` (`FormField`, `RegistrationInput`) e `specs/001-novo-portal-pibls/spec.md`.
