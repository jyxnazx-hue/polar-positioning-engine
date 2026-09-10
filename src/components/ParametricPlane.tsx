import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { SpecimenCanvas } from './SpecimenCanvas'
import type { CornerKey, CornerParamMap, SpecimenInstance } from '../utils/polarMath'
import {
  BALANCED_WEIGHTS,
  CORNER_ORDER,
  CORNERS,
  DEFAULT_POLE_PARAMS,
  HERO_SIZE,
  STATUS_BAR_H,
  TILE_SIZE,
  instanceAtPoint,
  normalizedToPixelRect,
  pixelToNormalizedRect,
  resolveCollisionPx,
} from '../utils/polarMath'

function formatAxis(n: number): string {
  const sign = n >= 0 ? '+' : '−'
  return `${sign}${Math.abs(n).toFixed(3)}`
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

const DOCK_POS: Record<CornerKey, string> = {
  w1: 'left-5 top-5',
  w2: 'right-5 top-5',
  w3: 'bottom-5 left-5',
  w4: 'bottom-5 right-5',
}

const PILL_POS: Record<CornerKey, string> = {
  w1: 'left-5 top-14',
  w2: 'right-5 top-14',
  w3: 'bottom-14 left-5',
  w4: 'bottom-14 right-5',
}

export function ParametricPlane() {
  const planeRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 900, height: 650 })
  const [instances, setInstances] = useState<SpecimenInstance[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [inspected, setInspected] = useState<SpecimenInstance | null>(null)
  const [openDock, setOpenDock] = useState<CornerKey | null>(null)
  const [poleParams, setPoleParams] = useState<CornerParamMap>(DEFAULT_POLE_PARAMS)
  const dragRef = useRef<{ id: string; grabX: number; grabY: number } | null>(null)
  const hoverClearRef = useRef<number | null>(null)

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

  useEffect(() => {
    if (!openDock) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenDock(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openDock])

  const holdHover = (id: string) => {
    if (hoverClearRef.current !== null) {
      window.clearTimeout(hoverClearRef.current)
      hoverClearRef.current = null
    }
    setHoveredId(id)
  }

  const releaseHover = (id: string) => {
    if (dragRef.current) return
    if (hoverClearRef.current !== null) window.clearTimeout(hoverClearRef.current)
    hoverClearRef.current = window.setTimeout(() => {
      setHoveredId((current) => (current === id ? null : current))
      hoverClearRef.current = null
    }, 140)
  }

  const obstaclesFor = useCallback(
    (excludeId?: string) => {
      const hero = { x: size.width / 2, y: size.height / 2, size: HERO_SIZE }
      const others = instances
        .filter((item) => item.id !== excludeId)
        .map((item) => {
          const p = normalizedToPixelRect(item, size.width, size.height)
          return { x: p.x, y: p.y, size: item.size }
        })
      return [hero, ...others]
    },
    [instances, size.height, size.width],
  )

  const placeAtPixel = useCallback(
    (px: number, py: number, id?: string) => {
      const resolved = resolveCollisionPx(px, py, TILE_SIZE, size, obstaclesFor(id))
      const coords = pixelToNormalizedRect(resolved.x, resolved.y, size.width, size.height)
      return instanceAtPoint(coords.x, coords.y, { id, size: TILE_SIZE })
    },
    [obstaclesFor, size],
  )

  const onPlanePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (event.target !== event.currentTarget) {
      setOpenDock(null)
      return
    }
    if (openDock) {
      setOpenDock(null)
      return
    }
    const el = planeRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const spawned = placeAtPixel(event.clientX - rect.left, event.clientY - rect.top)
    setInstances((prev) => [...prev, spawned])
    holdHover(spawned.id)
  }

  const onTilePointerDown = (event: ReactPointerEvent<HTMLDivElement>, instance: SpecimenInstance) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.button !== 0) return
    setOpenDock(null)
    event.currentTarget.setPointerCapture(event.pointerId)
    const el = planeRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pixel = normalizedToPixelRect(instance, rect.width, rect.height)
    dragRef.current = {
      id: instance.id,
      grabX: event.clientX - rect.left - pixel.x,
      grabY: event.clientY - rect.top - pixel.y,
    }
    setDraggingId(instance.id)
    holdHover(instance.id)
  }

  const onTilePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragRef.current
    if (!session || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const el = planeRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const next = placeAtPixel(
      event.clientX - rect.left - session.grabX,
      event.clientY - rect.top - session.grabY,
      session.id,
    )
    setInstances((prev) => prev.map((item) => (item.id === session.id ? next : item)))
    setInspected((current) => (current?.id === session.id ? next : current))
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
    setDraggingId(null)
  }

  const purge = (id: string) => {
    setInstances((prev) => prev.filter((item) => item.id !== id))
    setHoveredId((current) => (current === id ? null : current))
    setInspected((current) => (current?.id === id ? null : current))
  }

  const inspect = (instance: SpecimenInstance) => {
    setInspected(instance)
  }

  const heroWeights = inspected?.weights ?? BALANCED_WEIGHTS
  const hovered = instances.find((item) => item.id === hoveredId) ?? null
  const showHud = Boolean(hovered && draggingId !== hovered.id)

  return (
    <div className="flex h-full min-h-svh w-full flex-col bg-[#090A0E]">
      <div
        ref={planeRef}
        className="relative min-h-0 w-full flex-1 cursor-crosshair overflow-hidden"
        onPointerDown={onPlanePointerDown}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[#222634] bg-[#0B0C11] shadow-[0_0_80px_rgba(0,0,0,0.45)]"
          style={{ width: HERO_SIZE, height: HERO_SIZE }}
        >
          <SpecimenCanvas weights={heroWeights} size={HERO_SIZE} poleParams={poleParams} />
        </div>

        {inspected && (
          <button
            type="button"
            className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 translate-y-[142px] font-mono text-[9px] uppercase tracking-[0.22em] text-neutral-500 transition-colors hover:text-neutral-300"
            onPointerDown={(event) => {
              event.stopPropagation()
              setInspected(null)
            }}
          >
            Restore equilibrium
          </button>
        )}

        {instances.map((instance) => {
          const pixel = normalizedToPixelRect(instance, size.width, size.height)
          const active = instance.id === hoveredId || instance.id === draggingId || instance.id === inspected?.id
          return (
            <div
              key={instance.id}
              className={`absolute ${active ? 'z-30' : 'z-20'}`}
              style={{
                left: pixel.x,
                top: pixel.y,
                width: instance.size,
                height: instance.size,
                transform: 'translate(-50%, -50%)',
              }}
              onPointerEnter={() => holdHover(instance.id)}
              onPointerLeave={() => releaseHover(instance.id)}
              onPointerDown={(event) => onTilePointerDown(event, instance)}
              onPointerMove={onTilePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <div
                className={`overflow-hidden rounded-xl border bg-[#0B0C11] transition-[border-color,box-shadow] duration-150 ${
                  active ? 'border-[#3A4154] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]' : 'border-[#222634]'
                }`}
                style={{
                  width: instance.size,
                  height: instance.size,
                  cursor: draggingId === instance.id ? 'grabbing' : 'grab',
                }}
              >
                <SpecimenCanvas
                  weights={instance.weights}
                  size={instance.size}
                  poleParams={poleParams}
                  compact
                />
              </div>
            </div>
          )
        })}

        {showHud && hovered && (
          <InspectionHud
            instance={hovered}
            plane={size}
            onInspect={() => inspect(hovered)}
            onPurge={() => purge(hovered.id)}
            onPointerEnter={() => holdHover(hovered.id)}
            onPointerLeave={() => releaseHover(hovered.id)}
          />
        )}

        {CORNER_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={`absolute z-40 rounded-full border border-white/10 bg-[#12141C]/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-300 backdrop-blur-md transition-colors hover:border-white/20 hover:text-white ${DOCK_POS[key]}`}
            onPointerDown={(event) => {
              event.stopPropagation()
              setOpenDock((current) => (current === key ? null : key))
            }}
          >
            {CORNERS[key].dockLabel}
          </button>
        ))}

        {openDock && (
          <div
            className={`absolute z-50 w-64 rounded-2xl border border-[#222634] bg-[#12141C]/90 p-3 shadow-2xl backdrop-blur-md ${PILL_POS[openDock]}`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
              {CORNERS[openDock].dockLabel}
            </div>
            {(['primary', 'secondary'] as const).map((field, index) => (
              <label key={field} className="mb-2.5 block last:mb-0">
                <div className="mb-1 flex justify-between font-mono text-[10px] text-neutral-500">
                  <span>{CORNERS[openDock].sliders[index]}</span>
                  <span className="tabular-nums text-neutral-300">
                    {poleParams[openDock][field].toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={poleParams[openDock][field]}
                  className="pole-slider w-full"
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    setPoleParams((prev) => ({
                      ...prev,
                      [openDock]: { ...prev[openDock], [field]: value },
                    }))
                  }}
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <footer
        className="flex shrink-0 items-center justify-between px-5 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500"
        style={{
          height: STATUS_BAR_H,
          backgroundColor: '#0C0D12',
          borderTop: '1px solid #161822',
        }}
      >
        <span>Specimens: [{instances.length}] Active</span>
        <span>Field Center: (0.000, 0.000) Equilibrium</span>
        <span>Pipeline: IDW Shepard GPU Accelerated</span>
      </footer>
    </div>
  )
}

function InspectionHud({
  instance,
  plane,
  onInspect,
  onPurge,
  onPointerEnter,
  onPointerLeave,
}: {
  instance: SpecimenInstance
  plane: { width: number; height: number }
  onInspect: () => void
  onPurge: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}) {
  const pixel = normalizedToPixelRect(instance, plane.width, plane.height)
  const hudWidth = 248
  const left = Math.min(Math.max(12, pixel.x - hudWidth / 2), Math.max(12, plane.width - hudWidth - 12))
  const preferAbove = pixel.y > 168
  const top = preferAbove ? pixel.y - instance.size / 2 - 10 : pixel.y + instance.size / 2 + 10

  return (
    <div
      className="absolute z-40"
      style={{
        left,
        top,
        width: hudWidth,
        transform: preferAbove ? 'translateY(-100%)' : undefined,
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="rounded-xl border p-3 shadow-2xl backdrop-blur-md"
        style={{ backgroundColor: '#12141C', borderColor: '#222634' }}
      >
        <div className="font-mono text-[11px] font-medium tabular-nums tracking-wide text-neutral-100">
          [ X: {formatAxis(instance.x)} | Y: {formatAxis(instance.y)} ]
        </div>
        <div className="mt-2 font-mono text-[10px] leading-relaxed text-neutral-400">
          Etch: {pct(instance.weights.w1)} | Caustic: {pct(instance.weights.w2)} | Bleed:{' '}
          {pct(instance.weights.w3)} | Dither: {pct(instance.weights.w4)}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onInspect}
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black hover:bg-neutral-200"
          >
            Inspect
          </button>
          <button
            type="button"
            onClick={onPurge}
            className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20"
          >
            Purge
          </button>
        </div>
      </div>
    </div>
  )
}
