import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Song } from '@/types'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface SongCardProps {
  song: Song
  artistName?: string
  labelName?: string
  onClick?: () => void
  className?: string
}

export function SongCard({ song, artistName, labelName, onClick, className }: SongCardProps) {
  return (
    <Card
      className={cn(
        'group hover:border-muted-foreground/20 transition-colors',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold truncate">{song.title}</CardTitle>
        <CardDescription className="text-[13px]">
          {artistName ?? 'Unknown Artist'}
        </CardDescription>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="flex gap-2 flex-wrap">
          {song.genre && (
            <Badge variant="secondary" className="text-[11px]">{song.genre}</Badge>
          )}
          <Badge variant="outline" className="text-[11px]">
            {formatDuration(song.duration_seconds)}
          </Badge>
          {labelName && (
            <Badge variant="outline" className="text-[11px]">{labelName}</Badge>
          )}
        </div>
      </CardContent>

      {song.isrc && (
        <CardFooter className="pt-0">
          <span className="text-[11px] text-muted-foreground font-mono">
            ISRC: {song.isrc}
          </span>
        </CardFooter>
      )}
    </Card>
  )
}
