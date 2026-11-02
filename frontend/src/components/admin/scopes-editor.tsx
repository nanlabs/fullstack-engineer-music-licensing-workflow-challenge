import { useQuery } from "@tanstack/react-query"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { hasScope } from "@/lib/auth/scopes"
import { SCOPE_LABEL } from "@/lib/format/labels"
import { adminQueries, useMe } from "@/lib/queries"

interface ScopesEditorProps {
  value: string[]
  onChange: (scopes: string[]) => void
  disabled?: boolean
  idPrefix?: string
}

/**
 * Checkboxes over the tenant's scope catalogue, grouped by family. Only the
 * scopes the signed-in user holds can be granted: the backend refuses the
 * rest, and showing them would only promise what cannot be given.
 */
export function ScopesEditor({
  value,
  onChange,
  disabled,
  idPrefix = "scope",
}: ScopesEditorProps) {
  const me = useMe()
  const catalog = useQuery(adminQueries.scopes())

  if (catalog.isPending)
    return <p className="text-sm text-muted-foreground">Cargando permisos…</p>
  if (catalog.isError) {
    return (
      <p className="text-sm text-muted-foreground">
        No tienes acceso al catálogo de permisos (scopes:read).
      </p>
    )
  }

  const grantable = catalog.data.scopes.filter((s) =>
    hasScope(me.effective_scopes, s.scope)
  )
  const families = new Map<string, typeof grantable>()
  for (const entry of grantable) {
    const family = entry.scope.split(":")[0]
    families.set(family, [...(families.get(family) ?? []), entry])
  }
  const hasWildcard = me.effective_scopes.includes("*")
  const toggle = (scope: string, checked: boolean) =>
    onChange(checked ? [...value, scope] : value.filter((s) => s !== scope))

  return (
    <div className="flex flex-col gap-4">
      {hasWildcard ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            id={`${idPrefix}-all`}
            checked={value.includes("*")}
            disabled={disabled}
            onCheckedChange={(checked) => toggle("*", checked === true)}
          />
          <span>
            <span className="timecode">*</span>{" "}
            <span className="text-muted-foreground">· {SCOPE_LABEL["*"]}</span>
          </span>
        </label>
      ) : null}
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {[...families.entries()].map(([family, entries]) => (
          <fieldset key={family} className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs text-muted-foreground">
              {family}
            </legend>
            {entries.map((entry) => {
              const id = `${idPrefix}-${entry.scope.replace(":", "-")}`
              return (
                <div key={entry.scope} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={value.includes(entry.scope)}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      toggle(entry.scope, checked === true)
                    }
                  />
                  <Label
                    htmlFor={id}
                    className="font-normal"
                    title={entry.description}
                  >
                    <span className="timecode text-xs">{entry.scope}</span>
                    <span className="text-muted-foreground">
                      {SCOPE_LABEL[entry.scope] ?? entry.description}
                    </span>
                  </Label>
                </div>
              )
            })}
          </fieldset>
        ))}
      </div>
    </div>
  )
}
