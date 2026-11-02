import { TimelineRuler } from "@/components/shared/timeline-ruler"
import { CueBar, LANE_HEIGHT } from "@/components/tracks/cue-bar"
import type { Scene, Track } from "@/lib/api/types"
import { assignLanes, sceneWindow } from "@/lib/format/timeline"

interface CueTimelineProps {
  scene: Scene
  tracks: Track[]
}

/** The scene at full width: ruler on top, every cue as a bar in its lane. */
export function CueTimeline({ scene, tracks }: CueTimelineProps) {
  const window = sceneWindow(scene, tracks)
  if (!window) return null
  const lanes = assignLanes(tracks)
  const laneCount = Math.max(1, ...lanes.map((l) => l.lane + 1))
  const hasWindow = scene.start_ms !== null && scene.end_ms !== null

  return (
    <section
      aria-label="Línea de tiempo de la escena"
      className="rounded-lg border bg-card px-4 pt-3 pb-4"
    >
      <TimelineRuler window={window} maxTicks={12} />
      <div
        className="relative mt-1 rounded-sm bg-foreground/[0.04]"
        style={{ height: laneCount * LANE_HEIGHT + 8 }}
      >
        {lanes.map(({ span, lane }) => (
          <CueBar key={span.id} track={span} window={window} lane={lane} />
        ))}
      </div>
      {!hasWindow ? (
        <p className="mt-2 text-xs text-muted-foreground">
          La escena no tiene ventana: la escala va del primer cue al último.
        </p>
      ) : null}
    </section>
  )
}
