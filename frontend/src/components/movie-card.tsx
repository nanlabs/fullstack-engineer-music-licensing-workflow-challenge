import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Movie } from '@/types'

interface MovieCardProps {
  movie: Movie
  sceneCount?: number
  trackCount?: number
  licensedCount?: number
  onClick?: () => void
  className?: string
}

export function MovieCard({ movie, sceneCount, trackCount, licensedCount, onClick, className }: MovieCardProps) {
  const year = movie.release_year ?? new Date(movie.created_at).getFullYear()
  const progress = trackCount ? Math.round(((licensedCount ?? 0) / trackCount) * 100) : 0

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      onClick={onClick}
      onKeyDown={event => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) onClick()
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold truncate">{movie.title}</CardTitle>
            {movie.director && (
              <CardDescription className="text-[13px] mt-0.5">Directed by {movie.director}</CardDescription>
            )}
          </div>
          <Badge variant="outline" className="text-[11px] shrink-0">{year}</Badge>
        </div>
        {movie.description && (
          <p className="line-clamp-2 pt-2 text-[12px] leading-relaxed text-muted-foreground">{movie.description}</p>
        )}
      </CardHeader>

      {(sceneCount !== undefined || trackCount !== undefined) && (
        <CardContent className="space-y-3 pb-4">
          <div className="flex gap-2 flex-wrap">
            {sceneCount !== undefined && <Badge variant="secondary" className="text-[11px]">{sceneCount} scene{sceneCount !== 1 ? 's' : ''}</Badge>}
            {trackCount !== undefined && <Badge variant="secondary" className="text-[11px]">{trackCount} track{trackCount !== 1 ? 's' : ''}</Badge>}
            {licensedCount !== undefined && <Badge variant="secondary" className="text-[11px]">{licensedCount} licensed</Badge>}
          </div>
          {trackCount !== undefined && trackCount > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Licensing progress</span><span className="tabular-nums">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </CardContent>
      )}

      <CardFooter className="justify-between border-t border-border/60 pt-3">
        <span className="text-[11px] text-muted-foreground">
          Release {movie.release_year ?? 'TBD'}
        </span>
        {onClick && <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />}
      </CardFooter>
    </Card>
  )
}
