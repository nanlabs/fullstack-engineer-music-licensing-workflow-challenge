import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  MailIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { InvitationDialog } from "@/components/admin/invitation-dialog"
import { ScopeChips } from "@/components/admin/scope-chips"
import {
  InvitationStatusBadge,
  effectiveInvitationStatus,
} from "@/components/admin/status-badges"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { PaginationControls } from "@/components/shared/pagination-controls"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { describeError } from "@/lib/api/errors"
import { INVITATION_STATUSES, type InvitationFilter } from "@/lib/api/types"
import { requireScope } from "@/lib/auth/require-scope"
import { useCan } from "@/lib/auth/use-can"
import { formatDateTime, formatRelative } from "@/lib/format/dates"
import { INVITATION_STATUS_LABEL } from "@/lib/format/labels"
import { adminQueries, useInvitationAction } from "@/lib/queries"

const searchSchema = z.object({
  status: z.enum(INVITATION_STATUSES).optional(),
  page: z.number().int().min(1).optional(),
})
type Search = z.infer<typeof searchSchema>

function toFilter(search: Search): InvitationFilter {
  return { status: search.status, page: search.page ?? 1, page_size: 20 }
}

export const Route = createFileRoute("/_app/admin/invitations")({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => requireScope(context.me, "invitations:read"),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      adminQueries.invitations(toFilter(deps))
    ),
  component: InvitationsPage,
})

function InvitationsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(adminQueries.invitations(toFilter(search)))
  const canWrite = useCan("invitations:write")
  const canReadRoles = useCan("roles:read")
  const roles = useQuery({ ...adminQueries.roles(), enabled: canReadRoles })
  const action = useInvitationAction()
  const [inviting, setInviting] = useState(false)

  const roleName = (id: string | null) =>
    id ? (roles.data?.roles.find((r) => r.id === id)?.name ?? "…") : "–"
  const patch = (next: Partial<Search>) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true })
  const run = (id: string, kind: "resend" | "revoke") =>
    action.mutate(
      { id, action: kind },
      {
        onSuccess: () =>
          toast.success(
            kind === "resend" ? "Invitación reenviada" : "Invitación revocada",
            {
              description:
                kind === "resend"
                  ? "El enlace nuevo está en el log del backend (make logs)."
                  : undefined,
            }
          ),
        onError: (error) => {
          const text = describeError(error)
          toast.error(text.title, { description: text.description })
        },
      }
    )

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Administración" }, { label: "Invitaciones" }]}
        title="Invitaciones"
        description="Quien recibe una invitación crea su cuenta con el enlace y entra con un código, sin contraseña."
        actions={
          canWrite ? (
            <Button onClick={() => setInviting(true)}>
              <PlusIcon data-icon="inline-start" /> Invitar
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex items-center gap-2">
        <Select
          value={search.status ?? "all"}
          onValueChange={(value) =>
            patch({
              status: value === "all" ? undefined : (value as Search["status"]),
              page: undefined,
            })
          }
        >
          <SelectTrigger className="w-48" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {INVITATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {INVITATION_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {data.empty ? (
        <EmptyState
          icon={<MailIcon />}
          title={
            search.status
              ? "Ninguna invitación en ese estado."
              : "No hay invitaciones."
          }
          description={
            canWrite && !search.status
              ? "Invita a quien deba gestionar películas o licencias."
              : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Email</TableHead>
                  <TableHead className="w-28">Estado</TableHead>
                  <TableHead className="w-40">Rol</TableHead>
                  <TableHead>Permisos directos</TableHead>
                  <TableHead className="w-36">Creada</TableHead>
                  <TableHead className="w-36">Caduca</TableHead>
                  {canWrite ? <TableHead className="w-12" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((inv) => {
                  const pending = effectiveInvitationStatus(inv) === "pending"
                  return (
                    <TableRow key={inv.id} className="h-11">
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell>
                        <InvitationStatusBadge invitation={inv} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {roleName(inv.role_id)}
                      </TableCell>
                      <TableCell>
                        <ScopeChips scopes={inv.scopes} />
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground"
                        title={formatDateTime(inv.created_at)}
                      >
                        {formatRelative(inv.created_at)}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground"
                        title={formatDateTime(inv.expires_at)}
                      >
                        {formatRelative(inv.expires_at)}
                      </TableCell>
                      {canWrite ? (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Acciones de ${inv.email}`}
                                disabled={!pending}
                              >
                                <MoreHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => run(inv.id, "resend")}
                              >
                                <SendIcon /> Reenviar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => run(inv.id, "revoke")}
                              >
                                <XCircleIcon /> Revocar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            pagination={data.pagination}
            onPage={(page) => patch({ page: page === 1 ? undefined : page })}
            noun={["invitación", "invitaciones"]}
          />
        </div>
      )}
      <InvitationDialog open={inviting} onOpenChange={setInviting} />
    </>
  )
}
