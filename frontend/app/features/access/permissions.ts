/**
 * As 14 chaves de permissão (Requisitos Funcionais → Matriz de permissões). O servidor é quem autoriza (BR-076); estas
 * chaves só servem para a SPA montar o menu, os atalhos e os botões. O mesmo catálogo está no enum `PermissionKey` do
 * backend.
 */
export const PERMISSION_KEYS = [
  "boletins.write",
  "mensagens.write",
  "eventos.write",
  "eventos.write.own",
  "eventos.inscricoes.read",
  "eventos.inscricoes.read.own",
  "leads.read",
  "leads.manage",
  "leads.oracao.read",
  "leads.oracao.manage",
  "ministerios.write",
  "settings.write",
  "pix.write",
  "users.read",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Aceita uma chave ou uma lista (qualquer uma libera). */
export type PermissionRequirement = PermissionKey | readonly PermissionKey[];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

/** Papéis de referência (`role_code`) com o nome que a equipe reconhece. */
const ROLE_LABELS: Record<string, string> = {
  COMUNICACAO: "Comunicação",
  SECRETARIA: "Secretaria",
  TESOURARIA: "Tesouraria",
  ORACAO: "Equipe de oração",
  PASTORAL: "Pastoral",
  LIDER_MINISTERIO: "Liderança de ministério",
  ADMIN_TECNICO: "Administrador técnico",
};

export function roleLabel(roleCode: string): string {
  return ROLE_LABELS[roleCode] ?? roleCode;
}

/**
 * As áreas do painel que um conjunto de permissões abre, em linguagem de gente ("Pode cuidar de"). Uma área aparece uma
 * vez, mesmo que duas chaves a abram; quem só lê, e não atende, vê "só consulta".
 */
export function permissionAreas(permissions: readonly string[]): string[] {
  const has = (key: PermissionKey) => permissions.includes(key);
  const areas: string[] = [];

  if (has("leads.read") || has("leads.manage")) {
    areas.push(has("leads.manage") ? "Contatos" : "Contatos (só consulta)");
  }
  if (has("leads.oracao.read") || has("leads.oracao.manage")) {
    areas.push(
      has("leads.oracao.manage") ? "Pedidos de oração" : "Pedidos de oração (só consulta)",
    );
  }
  if (has("boletins.write")) areas.push("Boletins");
  if (has("mensagens.write")) areas.push("Palavra Viva");
  if (has("eventos.write")) areas.push("Eventos");
  if (has("eventos.write.own")) areas.push("Eventos do seu ministério");
  if (has("eventos.inscricoes.read")) areas.push("Inscrições");
  if (has("eventos.inscricoes.read.own")) areas.push("Inscrições do seu ministério");
  if (has("ministerios.write")) areas.push("Ministérios e grupos");
  if (has("settings.write")) areas.push("Configurações");
  if (has("pix.write")) areas.push("PIX");
  if (has("users.read")) areas.push("Lista de usuários");

  return areas;
}
