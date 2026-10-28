import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Outlet } from "react-router";
import { useAuth } from "~/features/access/auth-context";
import { RequireAuth } from "~/features/access/guards";
import { PanelFrame } from "~/features/access/components/panel-frame";
import { newLeadsCountQuery } from "~/features/leads/counts";
import { LoadingBlock } from "~/shared/ui/loading-block";

/** O painel com os selos de contatos novos no menu, para quem lê cada caixa (uma falha na contagem só some com o selo). */
function FramedPanel() {
  const { can } = useAuth();
  const contacts = useQuery({ ...newLeadsCountQuery("geral"), enabled: can("leads.read") });
  const prayer = useQuery({ ...newLeadsCountQuery("oracao"), enabled: can("leads.oracao.read") });

  return (
    <PanelFrame badges={{ contacts: contacts.data, prayer: prayer.data }}>
      {/* O menu fica na tela enquanto a próxima tela do painel (um chunk à parte) carrega */}
      <Suspense fallback={<LoadingBlock count={4} className="mx-auto max-w-6xl" />}>
        <Outlet />
      </Suspense>
    </PanelFrame>
  );
}

/** Layout das telas do painel: exige sessão e põe o conteúdo dentro do menu lateral (ou da gaveta, no celular). */
export default function AdminPanel() {
  return (
    <RequireAuth>
      <FramedPanel />
    </RequireAuth>
  );
}
