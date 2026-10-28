import { useQuery } from "@tanstack/react-query";
import { InfoIcon } from "lucide-react";
import { RequirePermission } from "~/features/access/guards";
import { usersQuery } from "~/features/access/api";
import { useAuth } from "~/features/access/auth-context";
import { formatLastAccess } from "~/features/access/last-access";
import { accessMessages } from "~/features/access/messages";
import { permissionAreas, roleLabel } from "~/features/access/permissions";
import { isApiError } from "~/shared/http/errors";
import { messages } from "~/shared/messages";
import { Alert, AlertDescription, AlertTitle } from "~/shared/ui/alert";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { StatusBadge } from "~/shared/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/shared/ui/table";

const { users } = accessMessages;

function Directory() {
  const { user: me } = useAuth();
  const query = useQuery(usersQuery);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <title>Usuários — Painel PIBLS</title>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] leading-tight font-extrabold tracking-tight">
          {users.title}
        </h1>
        <p className="m-0 text-muted-foreground">{users.intro}</p>
      </header>

      <Alert variant="info" role="note">
        <InfoIcon aria-hidden="true" />
        <AlertTitle className="font-bold">{users.readOnlyTitle}</AlertTitle>
        <AlertDescription>{users.readOnlyText}</AlertDescription>
      </Alert>

      <section
        aria-labelledby="lista"
        className="overflow-hidden rounded-[14px] border border-border bg-card"
      >
        {query.isPending ? (
          <>
            <h2 id="lista" className="sr-only">
              {users.title}
            </h2>
            <LoadingBlock count={5} className="p-4" />
          </>
        ) : query.isError ? (
          <>
            <h2 id="lista" className="sr-only">
              {users.title}
            </h2>
            <ErrorState
              headingLevel="h3"
              title={users.loadError}
              message={isApiError(query.error) ? query.error.message : messages.errors.generic}
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
            />
          </>
        ) : (
          <>
            <h2
              id="lista"
              className="m-0 border-b border-border px-5 py-3.5 text-[17px] font-extrabold"
            >
              {users.count(query.data.meta.total)}
            </h2>
            <div className="overflow-x-auto">
              <Table className="min-w-190 text-[15px]">
                <TableHeader>
                  <TableRow className="bg-background">
                    <TableHead className="px-5">{users.name}</TableHead>
                    <TableHead className="px-5">{users.role}</TableHead>
                    <TableHead className="px-5">{users.areas}</TableHead>
                    <TableHead className="px-5">{users.lastAccess}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.data.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className="px-5 py-3">
                        <span className="flex flex-col">
                          <span className="font-bold">{person.name}</span>
                          <span className="flex flex-wrap items-center gap-2">
                            {person.id === me?.id ? (
                              <span className="text-[13px] font-bold text-primary">
                                {users.you}
                              </span>
                            ) : null}
                            {person.is_active ? null : (
                              <StatusBadge tone="neutral">{users.inactive}</StatusBadge>
                            )}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-3 whitespace-normal">
                        {person.roles.map(roleLabel).join(", ")}
                      </TableCell>
                      <TableCell className="px-5 py-3 whitespace-normal">
                        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                          {permissionAreas(person.permissions).map((area) => (
                            <li
                              key={area}
                              className="inline-flex rounded-md border border-border bg-muted px-2 py-0.5 text-[13px] font-semibold"
                            >
                              {area}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell className="px-5 py-3 whitespace-nowrap text-muted-foreground">
                        {formatLastAccess(person.last_login_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** Diretório de usuários, somente leitura (design: AdminUsuarios; BG-4, BR-077). */
export default function AdminUsuarios() {
  return (
    <RequirePermission permission="users.read">
      <Directory />
    </RequirePermission>
  );
}
