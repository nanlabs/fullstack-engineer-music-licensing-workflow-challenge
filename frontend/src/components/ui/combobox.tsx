"use client"

import { useEffect, useRef, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react"

export interface ComboboxItem {
  value: string
  label: string
  description?: string
}

interface ComboboxProps {
  items: ComboboxItem[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

export function Combobox({
  items,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = items.find(item => item.value === value)

  const filtered = query.trim()
    ? items.filter(item => {
        const q = query.trim().toLowerCase()
        return (
          item.label.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q) ?? false)
        )
      })
    : items

  useEffect(() => {
    if (open) {
      setQuery("")
      // Focus the search input when the popover opens
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  function select(itemValue: string) {
    onValueChange(itemValue === value ? "" : itemValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
          !selected && "text-muted-foreground",
          className,
        )}
      >
        <span className="flex-1 truncate text-left">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) p-0">
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {/* Items */}
        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            filtered.map(item => (
              <button
                key={item.value}
                type="button"
                onClick={() => select(item.value)}
                className={cn(
                  "relative flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground",
                  item.value === value && "bg-accent/50",
                )}
              >
                <CheckIcon
                  className={cn(
                    "size-3.5 shrink-0",
                    item.value === value ? "opacity-100" : "opacity-0",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  {item.description && (
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
