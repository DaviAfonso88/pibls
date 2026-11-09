import { useParams } from "react-router";
import { useAuth } from "~/features/access/auth-context";
import { RequirePermission } from "~/features/access/guards";
import { READ_REGISTRATIONS } from "~/features/access/permissions";
import { RegistrationsPage } from "~/features/events/components/admin/registrations-page";
import { usePublicSettings } from "~/shared/site/settings";
import { LoadingBlock } from "~/shared/ui/loading-block";
import AdminNotFound from "./not-found";

/**
 * Inscritos de um evento (`/admin/eventos/:id/inscritos`; design: AdminInscritos; CAP-15, R2). Com a flag `features.events`
 * desligada a tela não existe (404, como a API). Ver e exportar pedem `eventos.inscricoes.read` (ou `.own`); cancelar pede a
 * permissão de escrita deste evento, e sem ela o botão nem aparece. O `key` troca a tela inteira ao mudar de evento.
 */
export default function AdminInscritos() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const { settings } = usePublicSettings();

  const eventId = Number(id);
  if (user === null || !Number.isInteger(eventId) || eventId < 1) return <AdminNotFound />;

  if (settings === undefined) return <LoadingBlock count={3} className="mx-auto max-w-6xl" />;
  if (!settings.features.events) return <AdminNotFound />;

  return (
    <RequirePermission permission={READ_REGISTRATIONS}>
      <RegistrationsPage
        key={eventId}
        eventId={eventId}
        access={{
          all: can("eventos.write"),
          own: can("eventos.write.own"),
          userMinistryId: user.ministry?.id ?? null,
        }}
      />
    </RequirePermission>
  );
}
