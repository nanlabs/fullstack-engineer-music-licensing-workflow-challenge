import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  ShieldIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { RoleDialog } from "@/components/admin/role-dialog"
import { ScopeChips } from "@/components/admin/scope-chips"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Role } from "@/lib/api/types"
import { requireScope } from "@/lib/auth/require-scope"
import { useCan } from "@/lib/auth/use-can"
import { formatDateTime, formatRelative } from "@/lib/format/dates"
import { adminQueries, useDeleteRole } from "@/lib/queries"

export const Route = createFileRoute("/_app/admin/roles")({
  beforeLoad: ({ context }) => requireScope(context.me, "roles:read"),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(adminQueries.roles()),
  component: RolesPage,
})

function RolesPage() {
  const { data } = useSuspenseQuery(adminQueries.roles())
  const canWrite = useCan("roles:write")
  const remove = useDeleteRole()
  const [dialog, setDialog] = useState<{ open: boolean; role?: Role }>({
    open: false,
  })
  const [deleting, setDeleting] = useState<Role | null>(null)

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Administración" }, { label: "Roles" }]}
        title="Roles"
        description="Conjuntos de permisos reutilizables. Cambiar un rol cambia al momento lo que pueden hacer quienes lo tienen."
        actions={
          canWrite ? (
            <Button onClick={() => setDialog({ open: true })}>
              <PlusIcon data-icon="inline-start" /> Nuevo rol
            </Button>
          ) : null
        }
      />
      {data.count === 0 ? (
        <EmptyState
          icon={<ShieldIcon />}
          title="No hay roles."
          description={
            canWrite
              ? "Crea el primero, por ejemplo uno para quien gestiona licencias."
              : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-56">Rol</TableHead>
                <TableHead>Permisos</TableHead>
                <TableHead className="w-36">Actualizado</TableHead>
                {canWrite ? <TableHead className="w-12" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.roles.map((role) => (
                <TableRow key={role.id} className="h-11">
                  <TableCell>
                    <span className="block font-medium">{role.name}</span>
                    {role.description ? (
                      <span className="block text-xs text-muted-foreground">
                        {role.description}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <ScopeChips scopes={role.scopes} empty="Sin permisos" />
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground"
                    title={formatDateTime(role.updated_at)}
                  >
                    {formatRelative(role.updated_at)}
                  </TableCell>
                  {canWrite ? (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Acciones del rol ${role.name}`}
                          >
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => setDialog({ open: true, role })}
                          >
                            <PencilIcon /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleting(role)}
                          >
                            <Trash2Icon /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <RoleDialog
        open={dialog.open}
        role={dialog.role}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
            remove.reset()
          }
        }}
        title={deleting ? `Eliminar el rol ${deleting.name}` : "Eliminar rol"}
        description="Quien lo tenga pierde esos permisos al momento. Los permisos directos no cambian."
        confirmLabel="Eliminar rol"
        destructive
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Rol eliminado")
              setDeleting(null)
            },
          })
        }}
      />
    </>
  )
}
