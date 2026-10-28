import { formatDate, formatPhone, formatTime } from "~/shared/format";
import type { AdminEvent } from "./admin-api";
import type { AdminRegistration, RegistrationAnswer } from "./registrations-api";

/**
 * As colunas da lista de inscritos, do PDF e do CSV (FR-060, FR-061): os campos fixos e uma por pergunta do formulário,
 * na ordem dele. O servidor monta as do CSV com a mesma regra (`RegistrationsExport`): se uma muda, a outra muda junto.
 * "Responsável" só existe em evento com menores.
 */
export interface RegistrationColumn {
  id: string;
  header: string;
  /** O texto da célula, já como a pessoa lê. Vazio quando não há o que mostrar. */
  text: (registration: AdminRegistration) => string;
}

/** `2026-11-02T15:30:00Z` → `02/11/2026 12h30` (horário de São Paulo). */
export function formatRegisteredAt(value: string): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

function phoneText(value: string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "" : formatPhone(value);
}

/** Uma resposta como texto: lista separada por vírgula, "Sim" ou "Não", data do dia/mês/ano, número com vírgula. */
export function answerText(answer: RegistrationAnswer | undefined): string {
  const value = answer?.value;

  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return String(value).replace(".", ",");
  if (Array.isArray(value)) return value.map(String).join(", ");

  const text = String(value);
  const date = answer?.type === "DATE" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text) : null;
  return date ? `${date[3]}/${date[2]}/${date[1]}` : text;
}

export function registrationColumns(
  event: Pick<AdminEvent, "has_minors" | "form_schema">,
): RegistrationColumn[] {
  const columns: RegistrationColumn[] = [
    {
      id: "created_at",
      header: "Inscrito em",
      text: (registration) => formatRegisteredAt(registration.created_at),
    },
    {
      id: "participant_name",
      header: "Nome",
      text: (registration) => registration.participant_name,
    },
    { id: "phone", header: "Telefone", text: (registration) => phoneText(registration.phone) },
    { id: "email", header: "E-mail", text: (registration) => registration.email ?? "" },
  ];

  if (event.has_minors) {
    columns.push(
      {
        id: "guardian_name",
        header: "Responsável",
        text: (registration) => registration.guardian_name ?? "",
      },
      {
        id: "guardian_phone",
        header: "Telefone do responsável",
        text: (registration) => phoneText(registration.guardian_phone),
      },
    );
  }

  for (const field of event.form_schema) {
    columns.push({
      id: `answer-${field.key}`,
      header: field.label,
      text: (registration) =>
        answerText(registration.answers.find((answer) => answer.key === field.key)),
    });
  }

  return columns;
}
