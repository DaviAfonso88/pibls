/**
 * O que a pessoa pode fazer com os eventos, calculado pela rota a partir da sessão (as features não importam umas das
 * outras, então quem conhece `useAuth` monta isto e passa para baixo).
 */
export interface EventManageAccess {
  /** `eventos.write`: gerencia os eventos de qualquer ministério. */
  all: boolean;
  /** `eventos.write.own`: gerencia os do próprio ministério e os gerais (ADR-025). */
  own: boolean;
  /** O ministério vinculado à pessoa; sem ele, `.own` não concede nada (BR-075). */
  userMinistryId: number | null;
}

/** Se a pessoa cria eventos: o botão "Novo evento" e o atalho do Início. */
export function canCreateEvent(access: EventManageAccess): boolean {
  return access.all || access.own;
}

/**
 * Se a pessoa edita este evento e cancela as inscrições dele: espelho da `EventPolicy::manage` (BR-030, BR-075,
 * ADR-025), só para a interface não oferecer o que o servidor recusaria. Quem decide é o servidor (BR-076).
 */
export function canManageEvent(access: EventManageAccess, eventMinistryId: number | null): boolean {
  if (access.all) return true;
  if (!access.own || access.userMinistryId === null) return false;

  return eventMinistryId === null || eventMinistryId === access.userMinistryId;
}
