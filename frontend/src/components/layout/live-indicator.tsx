import { cn } from "@/lib/utils"
import {
  useRealtime,
  type RealtimeStatus,
} from "@/lib/realtime/realtime-context"

const TEXT: Record<
  RealtimeStatus,
  { label: string; hint: string; dot: string }
> = {
  connecting: {
    label: "Conectando",
    hint: "Abriendo el canal de eventos.",
    dot: "bg-muted-foreground",
  },
  live: {
    label: "En vivo",
    hint: "Los cambios de licencias llegan al momento.",
    dot: "bg-live",
  },
  reconnecting: {
    label: "Reconectando",
    hint: "Se perdió el canal; reintentando. Lo que cambie mientras tanto llegará al reconectar.",
    dot: "bg-primary",
  },
  offline: {
    label: "Sin conexión en vivo",
    hint: "Los datos se refrescan al navegar.",
    dot: "bg-muted-foreground/50",
  },
}

export function LiveIndicator({ className }: { className?: string }) {
  const { status } = useRealtime()
  const text = TEXT[status]
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        className
      )}
      role="status"
      title={text.hint}
    >
      <span className="relative flex size-2">
        {status === "live" ? (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60 motion-reduce:hidden" />
        ) : null}
        <span
          className={cn("relative inline-flex size-2 rounded-full", text.dot)}
        />
      </span>
      <span>{text.label}</span>
    </div>
  )
}
