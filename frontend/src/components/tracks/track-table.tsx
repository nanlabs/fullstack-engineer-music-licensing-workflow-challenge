import { Link } from "@tanstack/react-router"
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { LicenseStateBadge } from "@/components/licenses/license-state-badge"
import { lockReason } from "@/components/tracks/track-lock-notice"
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
import type { Track } from "@/lib/api/types"
import { TRACK_USAGE_LABEL } from "@/lib/format/labels"
import { formatDuration, formatTimecode } from "@/lib/format/timecode"

interface TrackTableProps {
  tracks: Track[]
  canWrite: boolean
  onEdit: (track: Track) => void
  onDelete: (track: Track) => void
}

export function TrackTable({
  tracks,
  canWrite,
  onEdit,
  onDelete,
}: TrackTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Canción</TableHead>
            <TableHead>Titular de derechos</TableHead>
            <TableHead className="w-24 text-right">Entrada</TableHead>
            <TableHead className="w-24 text-right">Salida</TableHead>
            <TableHead className="w-24 text-right">Duración</TableHead>
            <TableHead className="w-28">Uso</TableHead>
            <TableHead className="w-36">Licencia</TableHead>
            {canWrite ? <TableHead className="w-12" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tracks.map((track) => {
            const locked = lockReason(track.license.state)
            return (
              <TableRow key={track.id} className="h-11">
                <TableCell>
                  <Link
                    to="/tracks/$trackId"
                    params={{ trackId: track.id }}
                    className="block rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="block font-medium">
                      {track.song.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {track.song.artist}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {track.song.rights_holder}
                </TableCell>
                <TableCell className="text-right timecode">
                  {formatTimecode(track.start_ms)}
                </TableCell>
                <TableCell className="text-right timecode">
                  {formatTimecode(track.end_ms)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatDuration(track.duration_ms)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {TRACK_USAGE_LABEL[track.usage]}
                </TableCell>
                <TableCell>
                  <LicenseStateBadge state={track.license.state} />
                </TableCell>
                {canWrite ? (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones del cue ${track.song.title}`}
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={!!locked}
                          onSelect={() => onEdit(track)}
                        >
                          <PencilIcon /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={!!locked}
                          onSelect={() => onDelete(track)}
                        >
                          <Trash2Icon /> Quitar
                        </DropdownMenuItem>
                        {locked ? (
                          <p className="max-w-56 px-2 py-1.5 text-xs text-muted-foreground">
                            {locked}
                          </p>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                ) : null}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
