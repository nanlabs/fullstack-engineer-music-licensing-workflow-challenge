import { Badge } from "@/components/ui/badge"
import type { MovieStatus } from "@/lib/api/types"
import { MOVIE_STATUS_LABEL } from "@/lib/format/labels"
import { cn } from "@/lib/utils"

const TONE: Record<MovieStatus, string> = {
  draft: "border-border text-muted-foreground",
  in_production: "border-primary/50 text-primary",
  released: "border-license-approved/50 text-license-approved",
  archived:
    "border-border text-muted-foreground line-through decoration-muted-foreground/60",
}

export function MovieStatusBadge({
  status,
  className,
}: {
  status: MovieStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("bg-transparent", TONE[status], className)}
    >
      {MOVIE_STATUS_LABEL[status]}
    </Badge>
  )
}
