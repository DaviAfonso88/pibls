import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router";
import { Spinner } from "~/shared/ui/spinner";
import { accessMessages } from "~/features/access/messages";
import AdminPanel from "./panel";
import AdminShell from "./shell";

// Cada tela do painel é um chunk à parte, carregado só quando a rota é aberta
const Entrar = lazy(() => import("./entrar"));
const EsqueciSenha = lazy(() => import("./esqueci-senha"));
const RedefinirSenha = lazy(() => import("./redefinir-senha"));
const Inicio = lazy(() => import("./inicio"));
const Usuarios = lazy(() => import("./usuarios"));
const Contatos = lazy(() => import("./contatos"));
const Contato = lazy(() => import("./contato"));
const Oracao = lazy(() => import("./oracao"));
const OracaoDetalhe = lazy(() => import("./oracao-detalhe"));
const Boletins = lazy(() => import("./boletins"));
const Boletim = lazy(() => import("./boletim"));
const PalavraViva = lazy(() => import("./palavra-viva"));
const Mensagem = lazy(() => import("./mensagem"));
const Pix = lazy(() => import("./pix"));
const Configuracoes = lazy(() => import("./configuracoes"));
const Ministerios = lazy(() => import("./ministerios"));
const Eventos = lazy(() => import("./eventos"));
const Evento = lazy(() => import("./evento"));
const Inscritos = lazy(() => import("./inscritos"));
const NaoEncontrado = lazy(() => import("./not-found"));

function Loading() {
  return (
    <div className="flex min-h-svh items-center justify-center" role="status">
      <Spinner aria-hidden="true" className="size-8 text-primary" />
      <span className="sr-only">{accessMessages.checkingSession}</span>
    </div>
  );
}

/**
 * Todo o painel é UMA rota do React Router (`admin/*`, em `app/routes.ts`) e este é o roteamento de dentro dela
 * (Frontend → Lazy loading: "todo /admin/* fica num chunk separado").
 *
 * Por quê: cada rota declarada em `routes.ts` entra no *manifest* de rotas que vai no JS inicial do site público, e o
 * painel terá umas 25. Com uma só, o painel custa ao site público o tamanho de uma rota, não de 25 (orçamento de 160 KB,
 * RNF-05). O painel não usa `loader` nem `action`, então nada se perde.
 *
 * A estrutura: `shell` (autenticação, toast, `noindex`) → telas de entrada (sem menu) ou `panel` (exige sessão, com menu)
 * → cada tela. Cada história de painel acrescenta as suas rotas dentro do `panel`, antes do `*`.
 */
export default function AdminApp() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<AdminShell />}>
          <Route path="entrar" element={<Entrar />} />
          <Route path="esqueci-senha" element={<EsqueciSenha />} />
          <Route path="redefinir-senha" element={<RedefinirSenha />} />
          <Route element={<AdminPanel />}>
            <Route index element={<Inicio />} />
            <Route path="contatos" element={<Contatos />} />
            <Route path="contatos/:id" element={<Contato />} />
            <Route path="oracao" element={<Oracao />} />
            <Route path="oracao/:id" element={<OracaoDetalhe />} />
            <Route path="boletins" element={<Boletins />} />
            <Route path="boletins/novo" element={<Boletim />} />
            <Route path="boletins/:id" element={<Boletim />} />
            <Route path="palavra-viva" element={<PalavraViva />} />
            <Route path="palavra-viva/nova" element={<Mensagem />} />
            <Route path="palavra-viva/:id" element={<Mensagem />} />
            <Route path="pix" element={<Pix />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="ministerios" element={<Ministerios />} />
            <Route path="ministerios/novo" element={<Ministerios />} />
            <Route path="ministerios/:id" element={<Ministerios />} />
            <Route path="eventos" element={<Eventos />} />
            <Route path="eventos/novo" element={<Evento />} />
            <Route path="eventos/:id" element={<Evento />} />
            <Route path="eventos/:id/inscritos" element={<Inscritos />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="*" element={<NaoEncontrado />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
