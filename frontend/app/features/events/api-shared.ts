import { array, boolean, nullish, number, object, oneOf, string } from "~/shared/http/parsers";

/*
 * O que as telas públicas e as do painel compartilham da API de eventos: os estados, os tipos de pergunta e o formato de
 * uma pergunta do formulário. Fica à parte do `admin-api` (que traz o envio de arquivo) para a página pública não puxar
 * código de painel.
 */

export const EVENT_STATES = [
  "RASCUNHO",
  "INSCRICOES_ABERTAS",
  "INSCRICOES_ENCERRADAS",
  "REALIZADO",
] as const;
export type EventState = (typeof EVENT_STATES)[number];

export const FORM_FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "SELECT",
  "MULTISELECT",
  "BOOLEAN",
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** O limite de perguntas do formulário de inscrição (BR-031). */
export const MAX_FORM_FIELDS = 30;

export const pageMeta = object({
  page: number,
  per_page: number,
  total: number,
  last_page: number,
});

/** `FormField` (contracts/openapi.yaml): uma pergunta do formulário de inscrição. */
export const formFieldParser = object({
  key: string,
  label: string,
  type: oneOf(FORM_FIELD_TYPES),
  required: boolean,
  help_text: nullish(string),
  sensitive: nullish(boolean),
  min: nullish(number),
  max: nullish(number),
  options: nullish(array(string)),
});

export type ApiFormField = ReturnType<typeof formFieldParser>;
