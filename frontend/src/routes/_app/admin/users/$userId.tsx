import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { ScopeChips } from "@/components/admin/scope-chips"
import { ScopesEditor } from "@/components/admin/scopes-editor"
import { UserStatusBadge } from "@/components/admin/status-badges"
import { ErrorState } from "@/components/layout/error-state"
import { PageHeader } from "@/components/layout/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { describeError } from "@/lib/api/errors"
import { requireScope } from "@/lib/auth/require-scope"
import { useCan } from "@/lib/auth/use-can"
import { formatDateTime, formatRelative } from "@/lib/format/dates"
import {
  adminQueries,
  useAssignRole,
  useMe,
  useSetUserScopes,
  useSetUserStatus,
} from "@/lib/queries"

export const Route = createFileRoute("/_app/admin/users/$userId")({
  beforeLoad: ({ context }) => requireScope(context.me, "users:read"),
  loader: ({ context: { queryClient }, params: { userId } }) =>
    Promise.all([
      queryClient.ensureQueryData(adminQueries.user(userId)),
      queryClient.ensureQueryData(adminQueries.userRoles(userId)),
    ]),
  component: UserPage,
})

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

function UserPage() {
  const { userId } = Route.useParams()
  const me = useMe()
  const { data: user } = useSuspenseQuery(adminQueries.user(userId))
  const { data: grants } = useSuspenseQuery(adminQueries.userRoles(userId))
  const canWriteUsers = useCan("users:write")
  const canWriteScopes = useCan("scopes:write")
  const canReadRoles = useCan("roles:read")
  const canAssign = useCan("roles:assign")
  const roles = useQuery({ ...adminQueries.roles(), enabled: canReadRoles })
  const setStatus = useSetUserStatus(userId)
  const setScopes = useSetUserScopes(userId)
  const assign = useAssignRole(userId)
  const isSelf = user.id === me.user.id

  const [confirm, setConfirm] = useState<"suspend" | "reinstate" | null>(null)
  const [draft, setDraft] = useState<string[] | null>(null)
  const scopes = draft ?? user.scopes
  const dirty =
    draft !== null &&
    (draft.length !== user.scopes.length ||
      draft.some((s) => !user.scopes.includes(s)))

  const notify = (error: unknown) => {
    const text = describeError(error)
    toast.error(text.title, { description: text.description })
  }

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Administración" },
          { label: "Usuarios", to: "/admin/users" },
          { label: user.name },
        ]}
        title={user.name}
        meta={
          <span className="flex items-center gap-2">
            <UserStatusBadge status={user.status} />
            <span className="text-sm text-muted-foreground">{user.email}</span>
          </span>
        }
        actions={
          canWriteUsers && !isSelf ? (
            user.status === "suspended" ? (
              <Button onClick={() => setConfirm("reinstate")}>
                Reinstaurar
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => setConfirm("suspend")}
              >
                Suspender
              </Button>
            )
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Cuenta" className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-base font-semibold">Cuenta</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Fact label="Email verificado">
              {user.email_verified ? "Sí" : "No"}
            </Fact>
            <Fact label="Acceso con código">
              {user.otp_enabled ? "Activo" : "Desactivado"}
            </Fact>
            <Fact label="Creada">{formatDateTime(user.created_at)}</Fact>
            <Fact label="Último acceso">
              {user.last_login_at
                ? `${formatRelative(user.last_login_at)} · ${formatDateTime(user.last_login_at)}`
                : "Nunca"}
            </Fact>
          </dl>
          <p className="mt-4 timecode text-xs text-muted-foreground">
            {user.id}
          </p>
          {isSelf ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Es tu cuenta: no puedes suspenderla ni reinstaurarla.
            </p>
          ) : null}
        </section>

        <section
          aria-label="Permisos efectivos"
          className="rounded-lg border bg-card p-5"
        >
          <h2 className="mb-1 text-base font-semibold">Permisos efectivos</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Lo que puede hacer ahora mismo, sumando roles y permisos directos.
          </p>
          <ScopeChips scopes={grants.effective_scopes} empty="Ninguno" />
        </section>

        <section aria-label="Roles" className="rounded-lg border bg-card p-5">
          <h2 className="mb-1 text-base font-semibold">Roles</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {canAssign
              ? "Marca los roles que debe tener."
              : "Los roles asignados a esta cuenta."}
          </p>
          {canReadRoles ? (
            roles.isPending ? (
              <p className="text-sm text-muted-foreground">Cargando roles…</p>
            ) : roles.isError ? (
              <ErrorState error={roles.error} />
            ) : roles.data.count === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay roles definidos.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {roles.data.roles.map((role) => {
                  const has = grants.roles.some((r) => r.id === role.id)
                  return (
                    <li key={role.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={has}
                        disabled={!canAssign || assign.isPending}
                        onCheckedChange={(checked) =>
                          assign.mutate(
                            { roleId: role.id, assign: checked === true },
                            { onError: notify }
                          )
                        }
                      />
                      <Label
                        htmlFor={`role-${role.id}`}
                        className="flex-col items-start gap-0.5 font-normal"
                      >
                        <span className="font-medium">{role.name}</span>
                        {role.description ? (
                          <span className="text-xs text-muted-foreground">
                            {role.description}
                          </span>
                        ) : null}
                        <ScopeChips scopes={role.scopes} empty="" />
                      </Label>
                    </li>
                  )
                })}
              </ul>
            )
          ) : (
            <ScopeChips
              scopes={grants.roles.map((r) => r.name)}
              empty="Sin roles"
            />
          )}
        </section>

        <section
          aria-label="Permisos directos"
          className="rounded-lg border bg-card p-5"
        >
          <h2 className="mb-1 text-base font-semibold">Permisos directos</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Concedidos a la cuenta además de los de sus roles.
          </p>
          {canWriteUsers && canWriteScopes ? (
            <div className="flex flex-col gap-4">
              <ScopesEditor
                value={scopes}
                onChange={setDraft}
                disabled={setScopes.isPending}
                idPrefix="user"
              />
              {setScopes.error ? <ErrorState error={setScopes.error} /> : null}
              <div className="flex gap-2">
                <Button
                  disabled={!dirty || setScopes.isPending}
                  onClick={() =>
                    setScopes.mutate(scopes, {
                      onSuccess: () => {
                        setDraft(null)
                        toast.success("Permisos guardados")
                      },
                    })
                  }
                >
                  {setScopes.isPending ? "Guardando…" : "Guardar permisos"}
                </Button>
                {dirty ? (
                  <Button variant="ghost" onClick={() => setDraft(null)}>
                    Descartar
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <ScopeChips scopes={user.scopes} empty="Ninguno" />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null)
            setStatus.reset()
          }
        }}
        title={
          confirm === "suspend"
            ? `Suspender a ${user.name}`
            : `Reinstaurar a ${user.name}`
        }
        description={
          confirm === "suspend"
            ? "No podrá entrar ni usar la API hasta que se reinstaure. Sus sesiones abiertas dejan de valer."
            : "Recupera el acceso con los permisos que ya tenía."
        }
        confirmLabel={confirm === "suspend" ? "Suspender" : "Reinstaurar"}
        destructive={confirm === "suspend"}
        pending={setStatus.isPending}
        error={setStatus.error}
        onConfirm={() => {
          if (!confirm) return
          setStatus.mutate(confirm, {
            onSuccess: () => {
              toast.success(
                confirm === "suspend"
                  ? "Usuario suspendido"
                  : "Usuario reinstaurado"
              )
              setConfirm(null)
            },
          })
        }}
      />
    </>
  )
}
