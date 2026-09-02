import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const navigate = useNavigate()

  return (
    <nav aria-label="Breadcrumb" className="mb-4 overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1.5 text-[12px] text-muted-foreground">
        {items.map((item, index) => {
          const current = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && <ChevronRight className="size-3 text-muted-foreground/60" aria-hidden="true" />}
              {item.href && !current ? (
                <button
                  type="button"
                  onClick={() => navigate(item.href!)}
                  className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </button>
              ) : (
                <span className={current ? 'font-medium text-foreground' : undefined} aria-current={current ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
