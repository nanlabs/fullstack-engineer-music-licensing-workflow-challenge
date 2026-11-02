import { Badge } from "@/components/ui/badge"
import type { RightsHolderKind } from "@/lib/api/types"
import { RIGHTS_HOLDER_KIND_LABEL } from "@/lib/format/labels"

export function RightsHolderBadge({ kind }: { kind: RightsHolderKind | null }) {
  if (!kind) return null
  return (
    <Badge variant="outline" className="bg-transparent text-muted-foreground">
      {RIGHTS_HOLDER_KIND_LABEL[kind]}
    </Badge>
  )
}
