import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { CheckIcon, ChevronsUpDownIcon, Music2Icon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { SongSummary } from "@/lib/api/types"
import { songQueries } from "@/lib/queries/songs"
import { cn } from "@/lib/utils"

interface SongPickerProps {
  id?: string
  value: SongSummary | null
  onChange: (song: SongSummary) => void
  invalid?: boolean
  disabled?: boolean
}

/** Searches the catalogue by title or artist and picks one song. */
export function SongPicker({
  id,
  value,
  onChange,
  invalid,
  disabled,
}: SongPickerProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const songs = useQuery({
    ...songQueries.list({ q: q.trim() || undefined, page_size: 20 }),
    enabled: open,
    placeholderData: keepPreviousData,
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {value ? (
            <span className="flex min-w-0 items-center gap-2">
              <Music2Icon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="truncate">
                {value.title}{" "}
                <span className="text-muted-foreground">· {value.artist}</span>
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Elegir canción</span>
          )}
          <ChevronsUpDownIcon
            className="size-4 shrink-0 opacity-50"
            aria-hidden
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-80 p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por título o artista"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            <CommandEmpty>
              {songs.isPending
                ? "Buscando…"
                : "Ninguna canción coincide. Añádela en Canciones."}
            </CommandEmpty>
            {songs.data ? (
              <CommandGroup>
                {songs.data.items.map((song) => (
                  <CommandItem
                    key={song.id}
                    value={song.id}
                    onSelect={() => {
                      onChange({
                        id: song.id,
                        title: song.title,
                        artist: song.artist,
                        rights_holder: song.rights_holder,
                      })
                      setOpen(false)
                    }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{song.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {song.artist} · {song.rights_holder}
                      </span>
                    </span>
                    <CheckIcon
                      className={cn(
                        "size-4",
                        value?.id === song.id ? "opacity-100" : "opacity-0"
                      )}
                      aria-hidden
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
