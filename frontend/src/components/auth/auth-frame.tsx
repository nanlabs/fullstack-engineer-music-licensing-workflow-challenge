import { ClapperboardIcon } from "lucide-react"
import type { ReactNode } from "react"

/**
 * The one-column frame of the public screens (login, invitation). The ruler
 * along the bottom is the only ornament: the timeline the rest of the app
 * is built around.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-3">
          <ClapperboardIcon className="size-7 text-primary" aria-hidden />
          <div className="leading-tight">
            <p className="font-semibold tracking-tight">ACME BROS PICTURES</p>
            <p className="text-sm text-muted-foreground">Licencias musicales</p>
          </div>
        </div>
        {children}
      </div>
      <Ruler />
    </div>
  )
}

function Ruler() {
  const ticks = Array.from({ length: 41 }, (_, i) => i)
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-10 overflow-hidden"
    >
      <div className="absolute inset-x-0 bottom-0 flex h-full items-end justify-between px-6">
        {ticks.map((i) => (
          <span
            key={i}
            className={
              i % 10 === 0
                ? "h-5 w-px bg-primary/70"
                : i % 5 === 0
                  ? "h-3.5 w-px bg-border"
                  : "h-2 w-px bg-border/60"
            }
          />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
    </div>
  )
}
