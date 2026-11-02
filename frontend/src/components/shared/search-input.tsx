import { SearchIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Milliseconds of quiet typing before `onChange` fires. */
  delay?: number
  className?: string
  "aria-label"?: string
}

/** A text search that reports after the user pauses; the URL holds the committed value. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  delay = 300,
  className,
  ...rest
}: SearchInputProps) {
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft === value) return
    const id = setTimeout(() => onChange(draft), delay)
    return () => clearTimeout(id)
  }, [draft, value, delay, onChange])

  return (
    <div className={cn("relative", className)}>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        aria-label={rest["aria-label"] ?? placeholder ?? "Buscar"}
        className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Limpiar búsqueda"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => {
            setDraft("")
            onChange("")
          }}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  )
}
