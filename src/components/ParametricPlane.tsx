import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { SpecimenCanvas } from './SpecimenCanvas'
import { exportSpecimenState } from '../utils/exportSpecimen'
import type { SpecimenInstance } from '../utils/polarMath'
import {
  CORNER_ORDER,
  CORNERS,
  DEFAULT_RENDER_SETTINGS,
  TILE_SIZE,
  clampCoordinates,
  createSpecimen,
  formatAxis,
  normalizedToPixel,
  pct,
  pixelToNormalizedRect,
  relocateSpecimen,
} from '../utils/polarMath'

const CLICK_SLOP = 6
const DUPLICATE_NUDGE = 0.08
const HUD_WIDTH = 280

const CORNER_LABEL: Record<(typeof CORNER_ORDER)[number], string> = {
  w1: 'top-4 left-5 text-left',
  w2: 'top-4 right-5 text-right',
  w3: 'bottom-4 left-5 text-left',
  w4: 'bottom-4 right-5 text-right',
}

export function ParametricPlane() {
  const planeRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 900, height: 650 })
  const [instances, setInstances] = useState<SpecimenInstance[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const dragRef = useRef<{ id: string; moved: boolean; x: number; y: number } | null>(null)
  const pendingStampRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const el = planeRef.current
    if (!el) return
    const apply = (w: number, h: number) => {
      if (w <= 0 || h <= 0) return
      setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
    }
    apply(el.clientWidth, el.clientHeight)
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      apply(entry.contentRect.width, entry.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pointFromEvent = (event: { clientX: number; clientY: number }) => {
    const el = planeRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return pixelToNormalizedRect(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height)
  }

  const onPlanePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (event.target !== event.currentTarget) return
    pendingStampRef.current = { x: event.clientX, y: event.clientY }
    setPinnedId(null)
    setHoveredId(null)
  }

  const onPlanePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pending = pendingStampRef.current
    pendingStampRef.current = null
    if (!pending || event.button !== 0) return
    if (event.target !== event.currentTarget) return
    const dx = event.clientX - pending.x
    const dy = event.clientY - pending.y
    if (dx * dx + dy * dy > CLICK_SLOP * CLICK_SLOP) return
    const point = pointFromEvent(event)
    if (!point) return
    setInstances((prev) => [...prev, createSpecimen(point)])
  }

  const onTilePointerDown = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { id, moved: false, x: event.clientX, y: event.clientY }
    pendingStampRef.current = null
  }

  const onTilePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || (event.buttons & 1) === 0) return
    const dist = Math.hypot(event.clientX - drag.x, event.clientY - drag.y)
    if (!drag.moved && dist < CLICK_SLOP) return
    drag.moved = true
    setDraggingId(drag.id)
    setPinnedId(null)
    const point = pointFromEvent(event)
    if (!point) return
    setInstances((prev) =>
      prev.map((item) => (item.id === drag.id ? relocateSpecimen(item, point) : item)),
    )
  }

  const onTilePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    setDraggingId(null)
    if (drag && !drag.moved) setPinnedId(drag.id)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const duplicate = (instance: SpecimenInstance) => {
    const copy = createSpecimen(
      clampCoordinates({ x: instance.x + DUPLICATE_NUDGE, y: instance.y - DUPLICATE_NUDGE }),
    )
    setInstances((prev) => [...prev, copy])
    setPinnedId(copy.id)
    setHoveredId(copy.id)
  }

  const inspectId = draggingId ? null : (pinnedId ?? hoveredId)
  const inspect = instances.find((item) => item.id === inspectId) ?? null
  const inspectPixel = inspect ? normalizedToPixel(inspect, size.width, size.height) : null
  const hudFlip = inspectPixel ? inspectPixel.x > size.width - HUD_WIDTH - TILE_SIZE : false

  return (
    <div className="relative h-full min-h-svh w-full bg-[#0A0B0E]">
      <div
        ref={planeRef}
        className="absolute inset-0 overflow-hidden"
        style={{
          touchAction: 'none',
          backgroundColor: '#0A0B0E',
          backgroundImage:
            'linear-gradient(#1A1D24 1px, transparent 1px), linear-gradient(90deg, #1A1D24 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        onPointerDown={onPlanePointerDown}
        onPointerUp={onPlanePointerUp}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#1A1D24]" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#1A1D24]" />
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#1E222D] bg-[#0A0B0E]/80 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-neutral-500">
            Balanced
          </div>
        </div>

        {CORNER_ORDER.map((key) => (
          <div
            key={key}
            className={`pointer-events-none absolute z-10 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500 ${CORNER_LABEL[key]}`}
          >
            {CORNERS[key].quadrant} // {CORNERS[key].title}
          </div>
        ))}

        {instances.map((instance) => {
          const pixel = normalizedToPixel(instance, size.width, size.height)
          return (
            <SpecimenTile
              key={instance.id}
              instance={instance}
              left={pixel.x}
              top={pixel.y}
              dragging={draggingId === instance.id}
              onPointerDown={onTilePointerDown}
              onPointerMove={onTilePointerMove}
              onPointerUp={onTilePointerUp}
              onHoverStart={() => setHoveredId(instance.id)}
              onHoverEnd={() => setHoveredId((current) => (current === instance.id ? null : current))}
            />
          )
        })}

        {inspect && inspectPixel && (
          <div
            data-hud="true"
            className="absolute z-50"
            style={{
              width: HUD_WIDTH,
              left: hudFlip
                ? inspectPixel.x - TILE_SIZE / 2 - 10
                : inspectPixel.x + TILE_SIZE / 2 + 10,
              top: Math.max(16, inspectPixel.y - TILE_SIZE / 2),
              transform: hudFlip ? 'translateX(-100%)' : undefined,
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerEnter={() => setHoveredId(inspect.id)}
            onPointerLeave={() => setHoveredId((current) => (current === inspect.id ? null : current))}
          >
            <div className="rounded-lg border border-[#1E222D] bg-[#0A0B0E]/85 p-3 shadow-2xl backdrop-blur-md">
              <div className="text-[11px] tabular-nums tracking-wide text-neutral-100">
                [ X: {formatAxis(inspect.x)} | Y: {formatAxis(inspect.y)} ]
              </div>
              <div className="mt-2 text-[10px] leading-4 text-neutral-400">
                Etch: {pct(inspect.weights.w1)} | Caustic: {pct(inspect.weights.w2)} | Bleed:{' '}
                {pct(inspect.weights.w3)} | Dither: {pct(inspect.weights.w4)}
              </div>
              <div className="mt-3 flex flex-nowrap gap-1.5">
                <HudButton label="Export State" onClick={() => exportSpecimenState(inspect)} />
                <HudButton label="Duplicate" onClick={() => duplicate(inspect)} />
                <HudButton
                  label="Remove"
                  onClick={() => {
                    setInstances((prev) => prev.filter((item) => item.id !== inspect.id))
                    setPinnedId(null)
                    setHoveredId(null)
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SpecimenTile({
  instance,
  left,
  top,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onHoverStart,
  onHoverEnd,
}: {
  instance: SpecimenInstance
  left: number
  top: number
  dragging: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>, id: string) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  onHoverStart: () => void
  onHoverEnd: () => void
}) {
  return (
    <div
      className="specimen-stamp absolute"
      style={{
        left,
        top,
        width: TILE_SIZE,
        height: TILE_SIZE,
        zIndex: dragging ? 40 : 20,
        cursor: dragging ? 'grabbing' : 'grab',
      }}
      onPointerDown={(event) => onPointerDown(event, instance.id)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerEnter={onHoverStart}
      onPointerLeave={onHoverEnd}
    >
      <div
        className="specimen-stamp-inner overflow-hidden border border-[#1E222D] bg-[#0E1015]"
        style={{ width: TILE_SIZE, height: TILE_SIZE }}
      >
        <SpecimenCanvas weights={instance.weights} size={TILE_SIZE} settings={DEFAULT_RENDER_SETTINGS} />
      </div>
    </div>
  )
}

function HudButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="whitespace-nowrap rounded-md border border-[#1E222D] bg-white/5 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
      onClick={onClick}
    >
      {label}
    </button>
  )
}
