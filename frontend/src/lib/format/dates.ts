import { format, formatDistanceToNowStrict, isPast, parseISO } from "date-fns"
import { es } from "date-fns/locale"

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–"
  return format(parseISO(iso), "d MMM yyyy", { locale: es })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "–"
  return format(parseISO(iso), "d MMM yyyy, HH:mm", { locale: es })
}

/** "hace 3 min", "en 2 días". */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "–"
  return formatDistanceToNowStrict(parseISO(iso), {
    locale: es,
    addSuffix: true,
  })
}

export function isPastDate(iso: string | null | undefined): boolean {
  return !!iso && isPast(parseISO(iso))
}

/** Value for `<input type="datetime-local">` from an ISO date, in local time. */
export function toLocalInputValue(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")
}

/** ISO date in UTC from a `datetime-local` value; `null` when empty or invalid. */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
