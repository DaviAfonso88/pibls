import { RequirePermission } from "~/features/access/guards";
import { EventAdminList } from "~/features/events/components/admin/event-admin-list";
import { useMinistries } from "~/features/ministries/api";
import { usePublicSettings } from "~/shared/site/settings";
import { LoadingBlock } from "~/shared/ui/loading-block";
import AdminNotFound from "./not-found";

/**
 * Lista de eventos no painel (design: AdminEvento; CAP-12, R2). Com a flag `features.events` desligada a tela não existe
 * (404, como a API). A lista de ministérios para o filtro vem do snapshot público: quem cruza features é a rota.
 */
export default function AdminEventos() {
  const { settings } = usePublicSettings();
  const { items: ministries } = useMinistries();

  if (settings === undefined) return <LoadingBlock count={3} className="mx-auto max-w-6xl" />;
  if (!settings.features.events) return <AdminNotFound />;

  return (
    <RequirePermission permission={["eventos.write", "eventos.write.own"]}>
      <EventAdminList ministries={(ministries ?? []).map(({ id, name }) => ({ id, name }))} />
    </RequirePermission>
  );
}
