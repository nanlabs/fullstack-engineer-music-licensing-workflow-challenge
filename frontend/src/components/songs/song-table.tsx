import { Link } from "@tanstack/react-router"
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { RightsHolderBadge } from "@/components/songs/rights-holder-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Song } from "@/lib/api/types"
import { formatTimecode } from "@/lib/format/timecode"

interface SongTableProps {
  songs: Song[]
  canWrite: boolean
  onEdit: (song: Song) => void
  onDelete: (song: Song) => void
}

export function SongTable({
  songs,
  canWrite,
  onEdit,
  onDelete,
}: SongTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Canción</TableHead>
            <TableHead>Álbum</TableHead>
            <TableHead>Titular de derechos</TableHead>
            <TableHead className="w-40">ISRC</TableHead>
            <TableHead className="w-24 text-right">Duración</TableHead>
            {canWrite ? <TableHead className="w-12" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {songs.map((song) => (
            <TableRow key={song.id} className="h-11">
              <TableCell>
                <Link
                  to="/songs/$songId"
                  params={{ songId: song.id }}
                  className="block rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="block font-medium">{song.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {song.artist}
                    {song.release_year ? ` · ${song.release_year}` : ""}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {song.album ?? "–"}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  {song.rights_holder}
                  <RightsHolderBadge kind={song.rights_holder_kind} />
                </span>
              </TableCell>
              <TableCell className="timecode text-xs text-muted-foreground">
                {song.isrc ?? "–"}
              </TableCell>
              <TableCell className="text-right timecode text-muted-foreground">
                {song.duration_ms != null
                  ? formatTimecode(song.duration_ms)
                  : "–"}
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Acciones de ${song.title}`}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(song)}>
                        <PencilIcon /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onDelete(song)}
                      >
                        <Trash2Icon /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
