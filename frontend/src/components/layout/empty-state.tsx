import type { ReactNode } from "react"

interface EmptyStateProps {
  /** One sentence: what is empty. */
  title: string
  /** The invitation to act, or why it is empty. */
  description?: string
  action?: ReactNode
  icon?: ReactNode
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed px-6 py-8">
      {icon ? (
        <div className="text-muted-foreground [&>svg]:size-5">{icon}</div>
      ) : null}
      <div>
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
