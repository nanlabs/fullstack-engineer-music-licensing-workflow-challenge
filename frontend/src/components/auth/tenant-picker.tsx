import { Building2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { MembershipOption } from "@/lib/api/types"
import { USER_STATUS_LABEL } from "@/lib/format/labels"

interface TenantPickerProps {
  email: string
  tenants: MembershipOption[]
  busy: boolean
  onPick: (tenant: MembershipOption) => void
  onBack: () => void
}

export function TenantPicker({
  email,
  tenants,
  busy,
  onPick,
  onBack,
}: TenantPickerProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Elige la organización
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="text-foreground">{email}</span> pertenece a varias
          organizaciones.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {tenants.map((tenant) => {
          const enabled =
            tenant.user_status === "active" && tenant.auth_methods.otp
          return (
            <li key={tenant.tenant_id}>
              <button
                type="button"
                disabled={!enabled || busy}
                onClick={() => onPick(tenant)}
                className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Building2Icon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {tenant.tenant_name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {tenant.tenant_slug}
                  </span>
                </span>
                {!enabled ? (
                  <span className="text-xs text-muted-foreground">
                    {tenant.user_status !== "active"
                      ? USER_STATUS_LABEL[tenant.user_status]
                      : "Sin código"}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      <Button
        type="button"
        variant="link"
        className="h-auto self-start p-0 text-muted-foreground"
        onClick={onBack}
      >
        Cambiar de email
      </Button>
    </div>
  )
}
