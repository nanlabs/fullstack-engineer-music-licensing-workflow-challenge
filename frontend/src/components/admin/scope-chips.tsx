import { Badge } from "@/components/ui/badge"
import { SCOPE_LABEL } from "@/lib/format/labels"

export function ScopeChips({
  scopes,
  empty = "–",
}: {
  scopes: string[]
  empty?: string
}) {
  if (scopes.length === 0)
    return <span className="text-muted-foreground">{empty}</span>
  return (
    <span className="flex flex-wrap gap-1">
      {scopes.map((scope) => (
        <Badge
          key={scope}
          variant="secondary"
          className="timecode font-normal"
          title={SCOPE_LABEL[scope]}
        >
          {scope}
        </Badge>
      ))}
    </span>
  )
}
