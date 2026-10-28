import { toApiDateTime, toDateTimeLocal } from "~/shared/format";
import { slugify } from "~/shared/lib/slug";
import type {
  AdminEvent,
  ApiFormField,
  EventInput,
  FormFieldInput,
  FormFieldType,
} from "./admin-api";
import type { EventValues } from "./schemas";

/**
 * Uma pergunta do formulário de inscrição como a tela a edita: tudo texto (é o que os campos devolvem), com um `uid` só do
 * navegador para as chaves de lista e os ids dos campos. `key` é o identificador estável que o servidor guarda (BR-031):
 * vem do servidor nas perguntas que já existem e nasce do rótulo, ao salvar, nas novas.
 */
export interface FieldDraft {
  uid: string;
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  help_text: string;
  sensitive: boolean;
  min: string;
  max: string;
  /** Uma opção por linha (`SELECT` e `MULTISELECT`). */
  options: string;
}

const MAX_KEY_LENGTH = 40;

let sequence = 0;

/** Um identificador de pergunta só para esta sessão do navegador. */
export function newFieldUid(): string {
  sequence += 1;
  return `pergunta-${sequence}`;
}

export function emptyField(): FieldDraft {
  return {
    uid: newFieldUid(),
    key: "",
    label: "",
    type: "TEXT",
    required: false,
    help_text: "",
    sensitive: false,
    min: "",
    max: "",
    options: "",
  };
}

export function hasOptions(type: FormFieldType): boolean {
  return type === "SELECT" || type === "MULTISELECT";
}

/** Escolhas de lista: uma por linha, sem linhas em branco e sem espaço sobrando. */
export function parseOptions(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");
}

export function fieldsFromApi(fields: readonly ApiFormField[]): FieldDraft[] {
  return fields.map((field) => ({
    uid: newFieldUid(),
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    help_text: field.help_text ?? "",
    sensitive: field.sensitive === true,
    min: field.min === null || field.min === undefined ? "" : String(field.min),
    max: field.max === null || field.max === undefined ? "" : String(field.max),
    options: (field.options ?? []).join("\n"),
  }));
}

/**
 * A chave de uma pergunta nova, tirada do rótulo: `^[a-z][a-z0-9_]{0,39}$` (BR-031), diferente das que já existem. A
 * pergunta "Tamanho da camiseta" vira `tamanho_da_camiseta`; repetida, `tamanho_da_camiseta_2`.
 */
export function keyFromLabel(label: string, taken: ReadonlySet<string>): string {
  let base = slugify(label).replace(/-/g, "_");
  if (base === "") base = "campo";
  if (!/^[a-z]/.test(base)) base = `campo_${base}`;
  base = base.slice(0, MAX_KEY_LENGTH).replace(/_+$/g, "");

  if (!taken.has(base)) return base;

  for (let suffix = 2; ; suffix += 1) {
    const tail = `_${suffix}`;
    const candidate = `${base.slice(0, MAX_KEY_LENGTH - tail.length)}${tail}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function numberOrNull(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** As perguntas como o servidor as recebe; as novas ganham a chave aqui. */
export function fieldsToInput(fields: readonly FieldDraft[]): FormFieldInput[] {
  const taken = new Set(fields.map((field) => field.key).filter((key) => key !== ""));

  return fields.map((field) => {
    let key = field.key;
    if (key === "") {
      key = keyFromLabel(field.label, taken);
      taken.add(key);
    }

    return {
      key,
      label: field.label.trim().replace(/\s+/g, " "),
      type: field.type,
      required: field.required,
      help_text: field.help_text.trim() === "" ? null : field.help_text.trim(),
      sensitive: field.sensitive,
      min: field.type === "NUMBER" ? numberOrNull(field.min) : null,
      max: field.type === "NUMBER" ? numberOrNull(field.max) : null,
      options: hasOptions(field.type) ? parseOptions(field.options) : null,
    };
  });
}

/**
 * As perguntas do formulário salvo que o novo removeu ou cujo tipo trocou (BR-029). Mudar só o rótulo, a dica ou as
 * opções, ou acrescentar uma pergunta, não conta: as respostas já dadas continuam fazendo sentido.
 */
export function breakingKeys(
  saved: readonly ApiFormField[],
  current: readonly FieldDraft[],
): string[] {
  const byKey = new Map(
    current.filter((field) => field.key !== "").map((field) => [field.key, field]),
  );

  return saved
    .filter((field) => byKey.get(field.key)?.type !== field.type)
    .map((field) => field.key);
}

export function hasSensitiveField(fields: readonly FieldDraft[]): boolean {
  return fields.some((field) => field.sensitive);
}

/** O formulário vazio de um evento novo; o ministério já vem escolhido para quem só tem o próprio. */
export function emptyValues(ministryId: number | null): EventValues {
  return {
    title: "",
    slug: "",
    ministry_id: ministryId === null ? "" : String(ministryId),
    description: "",
    starts_at: "",
    ends_at: "",
    location: "",
    max_spots: "",
    registration_deadline: "",
    has_minors: false,
    form_schema: [],
  };
}

export function valuesOf(event: AdminEvent): EventValues {
  return {
    title: event.title,
    slug: event.slug,
    ministry_id: event.ministry ? String(event.ministry.id) : "",
    description: event.description,
    starts_at: toDateTimeLocal(event.starts_at),
    ends_at: event.ends_at ? toDateTimeLocal(event.ends_at) : "",
    location: event.location,
    max_spots:
      event.max_spots === null || event.max_spots === undefined ? "" : String(event.max_spots),
    registration_deadline: event.registration_deadline
      ? toDateTimeLocal(event.registration_deadline)
      : "",
    has_minors: event.has_minors,
    form_schema: fieldsFromApi(event.form_schema),
  };
}

/** Os valores do formulário como o servidor os recebe: datas com o fuso de Brasília, perguntas com a chave. */
export function toInput(values: EventValues): EventInput {
  return {
    title: values.title.trim(),
    slug: values.slug,
    ministry_id: Number(values.ministry_id),
    description: values.description,
    starts_at: toApiDateTime(values.starts_at),
    ends_at: values.ends_at === "" ? null : toApiDateTime(values.ends_at),
    location: values.location.trim(),
    max_spots: values.max_spots.trim() === "" ? null : Number(values.max_spots),
    registration_deadline:
      values.registration_deadline === "" ? null : toApiDateTime(values.registration_deadline),
    has_minors: values.has_minors,
    form_schema: fieldsToInput(values.form_schema),
  };
}

/** Dá para reabrir as inscrições: o prazo venceu, mas o evento não começou e ainda há vaga. */
export function canReopenRegistration(event: AdminEvent, now: Date = new Date()): boolean {
  return (
    event.registration.state === "INSCRICOES_ENCERRADAS" &&
    new Date(event.starts_at).getTime() > now.getTime() &&
    event.registration.spots_left !== 0
  );
}

/** Nova ordem depois de mover a pergunta `from` para a posição `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return [...items];

  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}
