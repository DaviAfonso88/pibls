import { useAuth } from "~/features/access/auth-context";
import { RequirePermission } from "~/features/access/guards";
import { SEE_EVENTS } from "~/features/access/permissions";
import { EventAdminList } from "~/features/events/components/admin/event-admin-list";
import { useMinistries } from "~/features/ministries/api";
import { usePublicSettings } from "~/shared/site/settings";
import { LoadingBlock } from "~/shared/ui/loading-block";
import AdminNotFound from "./not-found";

/**
 * Lista de eventos no painel (design: AdminEvento; CAP-12, R2). Com a flag `features.events` desligada a tela não existe
 * (404, como a API). Abre para quem gerencia eventos e para quem só lê os inscritos, este em modo de consulta (ADR-027).
 * A lista de ministérios para o filtro vem do snapshot público: quem cruza features é a rota.
 */
export default function AdminEventos() {
  const { user, can } = useAuth();
  const { settings } = usePublicSettings();
  const { items: ministries } = useMinistries();

  if (settings === undefined) return <LoadingBlock count={3} className="mx-auto max-w-6xl" />;
  if (!settings.features.events) return <AdminNotFound />;

  return (
    <RequirePermission permission={SEE_EVENTS}>
      <EventAdminList
        ministries={(ministries ?? []).map(({ id, name }) => ({ id, name }))}
        access={{
          all: can("eventos.write"),
          own: can("eventos.write.own"),
          userMinistryId: user?.ministry?.id ?? null,
        }}
      />
    </RequirePermission>
  );
}
