import { useParams } from "react-router";
import { useAuth } from "~/features/access/auth-context";
import { RequirePermission } from "~/features/access/guards";
import { EventForm } from "~/features/events/components/admin/event-form";
import { useMinistries } from "~/features/ministries/api";
import { usePublicSettings } from "~/shared/site/settings";
import { LoadingBlock } from "~/shared/ui/loading-block";
import AdminNotFound from "./not-found";

/**
 * Cadastro (`/admin/eventos/novo`) e edição (`/admin/eventos/:id`) de evento (design: AdminEvento; CAP-12, R2). O `key`
 * troca o formulário inteiro ao mudar de evento. Quem só tem `eventos.write.own` fica com o ministério fixo no próprio.
 */
export default function AdminEvento() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const { settings } = usePublicSettings();
  const { items: ministries } = useMinistries();

  const editing = id !== undefined;
  const eventId = editing ? Number(id) : null;
  if (user === null || (editing && (!Number.isInteger(eventId) || (eventId ?? 0) < 1))) {
    return <AdminNotFound />;
  }

  if (settings === undefined) return <LoadingBlock count={3} className="mx-auto max-w-6xl" />;
  if (!settings.features.events) return <AdminNotFound />;

  const lockedMinistryId = can("eventos.write") ? null : (user.ministry?.id ?? null);

  return (
    <RequirePermission permission={["eventos.write", "eventos.write.own"]}>
      <EventForm
        key={eventId ?? "novo"}
        id={eventId}
        userId={user.id}
        ministries={(ministries ?? []).map(({ id: ministryId, name }) => ({
          id: ministryId,
          name,
        }))}
        lockedMinistryId={lockedMinistryId}
      />
    </RequirePermission>
  );
}
