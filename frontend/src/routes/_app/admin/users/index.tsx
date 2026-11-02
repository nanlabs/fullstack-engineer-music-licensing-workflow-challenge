import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { z } from "zod"

import { ScopeChips } from "@/components/admin/scope-chips"
import { UserStatusBadge } from "@/components/admin/status-badges"
import { PageHeader } from "@/components/layout/page-header"
import { PaginationControls } from "@/components/shared/pagination-controls"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { PageQuery } from "@/lib/api/types"
import { requireScope } from "@/lib/auth/require-scope"
import { formatDateTime, formatRelative } from "@/lib/format/dates"
import { adminQueries, useMe } from "@/lib/queries"

const searchSchema = z.object({ page: z.number().int().min(1).optional() })
type Search = z.infer<typeof searchSchema>

const toQuery = (search: Search): PageQuery => ({
  page: search.page ?? 1,
  page_size: 20,
})

export const Route = createFileRoute("/_app/admin/users/")({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => requireScope(context.me, "users:read"),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(adminQueries.users(toQuery(deps))),
  component: UsersPage,
})

function UsersPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const me = useMe()
  const { data } = useSuspenseQuery(adminQueries.users(toQuery(search)))

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Administración" }, { label: "Usuarios" }]}
        title="Usuarios"
        description="Las cuentas de esta organización. Los permisos efectivos suman los del rol y los directos."
      />
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-28">Estado</TableHead>
                <TableHead>Permisos directos</TableHead>
                <TableHead className="w-36">Último acceso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((user) => (
                <TableRow key={user.id} className="h-11">
                  <TableCell className="font-medium">
                    <Link
                      to="/admin/users/$userId"
                      params={{ userId: user.id }}
                      className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {user.name}
                    </Link>
                    {user.id === me.user.id ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (tú)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <UserStatusBadge status={user.status} />
                  </TableCell>
                  <TableCell>
                    <ScopeChips scopes={user.scopes} empty="Solo por rol" />
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground"
                    title={formatDateTime(user.last_login_at)}
                  >
                    {user.last_login_at
                      ? formatRelative(user.last_login_at)
                      : "Nunca"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <PaginationControls
          pagination={data.pagination}
          onPage={(page) =>
            void navigate({
              search: { page: page === 1 ? undefined : page },
              replace: true,
            })
          }
          noun={["usuario", "usuarios"]}
        />
      </div>
    </>
  )
}
