import { RequirePermission } from "~/features/access/guards";
import { PixForm } from "~/features/content/components/admin/pix-form";

/** Chave PIX da Tesouraria (design: AdminPix; CAP-18). Só `pix.write`; a API recusa de qualquer jeito (BR-076). */
export default function AdminPix() {
  return (
    <RequirePermission permission="pix.write">
      <PixForm />
    </RequirePermission>
  );
}
