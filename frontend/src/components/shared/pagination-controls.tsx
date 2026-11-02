import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Pagination } from "@/lib/api/types"
import { plural } from "@/lib/format/labels"

interface PaginationControlsProps {
  pagination: Pagination
  onPage: (page: number) => void
  noun?: [singular: string, plural: string]
}

export function PaginationControls({
  pagination,
  onPage,
  noun = ["elemento", "elementos"],
}: PaginationControlsProps) {
  const { page, pages, total } = pagination
  if (total === 0) return null
  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between gap-4 text-sm text-muted-foreground"
    >
      <span>{plural(total, noun[0], noun[1])}</span>
      <div className="flex items-center gap-2">
        <span>
          Página {page} de {Math.max(pages, 1)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página siguiente"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </nav>
  )
}
