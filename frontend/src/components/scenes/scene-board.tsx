import { Link } from "@tanstack/react-router"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { useMemo } from "react"

import { LicenseStateDot } from "@/components/licenses/license-state-badge"
import { TimelineRuler } from "@/components/shared/timeline-ruler"
import { CueBar, LANE_HEIGHT } from "@/components/tracks/cue-bar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Scene, Track } from "@/lib/api/types"
import { plural } from "@/lib/format/labels"
import { formatTimecode } from "@/lib/format/timecode"
import {
  assignLanes,
  envelope,
  placeInWindow,
  type TimeWindow,
} from "@/lib/format/timeline"
import { cn } from "@/lib/utils"

interface SceneBoardProps {
  scenes: Scene[]
  tracks: Track[]
  canWrite: boolean
  onEdit: (scene: Scene) => void
  onDelete: (scene: Scene) => void
  /** Called with the full new order of scene ids. */
  onReorder: (sceneIds: string[]) => void
  reordering?: boolean
}

function windowOf(scene: Scene): TimeWindow | null {
  return scene.start_ms !== null && scene.end_ms !== null
    ? { start: scene.start_ms, end: scene.end_ms }
    : null
}

/**
 * The movie as a board: one strip per scene on the movie's time axis, the
 * scene window as a band, every cue as a bar coloured by its license.
 */
export function SceneBoard({
  scenes,
  tracks,
  canWrite,
  onEdit,
  onDelete,
  onReorder,
  reordering,
}: SceneBoardProps) {
  const byScene = useMemo(() => {
    const map = new Map<string, Track[]>()
    for (const track of tracks) {
      const list = map.get(track.scene_id) ?? []
      list.push(track)
      map.set(track.scene_id, list)
    }
    return map
  }, [tracks])

  const axis = useMemo(
    () => envelope(scenes.map(windowOf), tracks),
    [scenes, tracks]
  )

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= scenes.length) return
    const ids = scenes.map((s) => s.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(target, 0, moved)
    onReorder(ids)
  }

  return (
    <section
      aria-label="Escenas"
      className="overflow-x-auto rounded-lg border bg-card"
    >
      <div className="min-w-[40rem]">
        <div className="grid grid-cols-[2rem_minmax(11rem,15rem)_1fr_auto] items-end gap-x-4 border-b px-4 pt-3 pb-2 text-xs text-muted-foreground">
          <span>#</span>
          <span>Escena</span>
          {axis ? (
            <TimelineRuler window={axis} maxTicks={10} className="border-b-0" />
          ) : (
            <span>Cues</span>
          )}
          <span className="w-28 text-right">{canWrite ? "" : "Cues"}</span>
        </div>
        <ol className="divide-y">
          {scenes.map((scene, index) => {
            const sceneTracks = byScene.get(scene.id) ?? []
            const lanes = assignLanes(sceneTracks)
            const laneCount = Math.max(1, ...lanes.map((l) => l.lane + 1))
            const window = windowOf(scene)
            const band =
              axis && window
                ? placeInWindow(
                    { start_ms: window.start, end_ms: window.end },
                    axis,
                    0
                  )
                : null
            const states = new Set(sceneTracks.map((t) => t.license.state))
            return (
              <li
                key={scene.id}
                className="grid grid-cols-[2rem_minmax(11rem,15rem)_1fr_auto] items-center gap-x-4 px-4 py-2.5 hover:bg-accent/30"
              >
                <span className="timecode text-sm text-muted-foreground">
                  {scene.position}
                </span>
                <div className="min-w-0">
                  <Link
                    to="/movies/$movieId/scenes/$sceneId"
                    params={{ movieId: scene.movie_id, sceneId: scene.id }}
                    className="block truncate font-medium hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {scene.title}
                  </Link>
                  <p className="timecode text-xs text-muted-foreground">
                    {window
                      ? `${formatTimecode(window.start)} – ${formatTimecode(window.end)}`
                      : "Sin ventana"}
                  </p>
                </div>
                <div
                  className="relative overflow-hidden rounded-sm"
                  style={{ height: laneCount * LANE_HEIGHT + 8 }}
                >
                  {band ? (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 rounded-sm border-x border-border/80 bg-foreground/[0.06]"
                      style={{ left: `${band.left}%`, width: `${band.width}%` }}
                    />
                  ) : null}
                  {axis
                    ? lanes.map(({ span, lane }) => (
                        <CueBar
                          key={span.id}
                          track={span}
                          window={axis}
                          lane={lane}
                        />
                      ))
                    : null}
                  {sceneTracks.length === 0 ? (
                    <span className="absolute inset-0 flex items-center px-2 text-xs text-muted-foreground/70">
                      Sin cues
                    </span>
                  ) : null}
                </div>
                <div className="flex w-28 items-center justify-end gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {[...states].map((state) => (
                      <LicenseStateDot key={state} state={state} />
                    ))}
                    <span
                      className={cn(sceneTracks.length === 0 && "opacity-60")}
                    >
                      {plural(sceneTracks.length, "cue", "cues")}
                    </span>
                  </span>
                  {canWrite ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones de la escena ${scene.title}`}
                          disabled={reordering}
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={index === 0}
                          onSelect={() => move(index, -1)}
                        >
                          <ArrowUpIcon /> Subir
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={index === scenes.length - 1}
                          onSelect={() => move(index, 1)}
                        >
                          <ArrowDownIcon /> Bajar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onEdit(scene)}>
                          <PencilIcon /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => onDelete(scene)}
                        >
                          <Trash2Icon /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
