import { Link, type LinkProps } from "@tanstack/react-router"
import { ChevronRightIcon } from "lucide-react"
import type { ReactNode } from "react"

export interface Crumb {
  label: string
  /** Link target; the last crumb usually has none. */
  to?: LinkProps["to"]
  params?: LinkProps["params"]
}

interface PageHeaderProps {
  title: ReactNode
  crumbs?: Crumb[]
  description?: ReactNode
  /** Small facts next to the title: status badge, year, counts. */
  meta?: ReactNode
  actions?: ReactNode
}

export function PageHeader({
  title,
  crumbs,
  description,
  meta,
  actions,
}: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-2">
      {crumbs && crumbs.length > 0 ? (
        <nav
          aria-label="Ruta"
          className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
        >
          {crumbs.map((crumb, index) => (
            <span
              key={`${crumb.label}-${index}`}
              className="flex items-center gap-1"
            >
              {index > 0 ? (
                <ChevronRightIcon className="size-3.5 opacity-60" aria-hidden />
              ) : null}
              {crumb.to ? (
                <Link
                  to={crumb.to}
                  params={crumb.params}
                  className="hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-foreground">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight">
              {title}
            </h1>
            {meta}
          </div>
          {description ? (
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}
