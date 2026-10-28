import { RequirePermission } from "~/features/access/guards";
import { SettingsForm } from "~/features/content/components/admin/settings-form";

/** Configurações do site (design: AdminConfiguracoes; CAP-17). Só `settings.write`; a API recusa de qualquer jeito (BR-076). */
export default function AdminConfiguracoes() {
  return (
    <RequirePermission permission="settings.write">
      <SettingsForm />
    </RequirePermission>
  );
}
