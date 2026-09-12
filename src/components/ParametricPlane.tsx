import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { SpecimenCanvas } from './SpecimenCanvas'
import { InspectionModal } from './InspectionModal'
import { CornerPopover } from './CornerPopover'
import type { CornerKey, RenderSettings, SpecimenInstance } from '../utils/polarMath'
import {
  BALANCED_WEIGHTS,
  CELL_SPACING,
  CORNER_ORDER,
  CORNERS,
  DEFAULT_RENDER_SETTINGS,
  GRID_COLS,
  GRID_ROWS,
  HERO_SIZE,
  STATUS_BAR_H,
  TILE_SIZE,
  cellCenterPixel,
  cellKey,
  cellOverlapsHero,
  formatCoordBadge,
  instanceAtCell,
  pixelToNearestCell,
} from '../utils/polarMath'

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
  const [inspected, setInspected] = useState<SpecimenInstance | null>(null)
  const [openDock, setOpenDock] = useState<CornerKey | null>(null)
  const [settings, setSettings] = useState<RenderSettings>(DEFAULT_RENDER_SETTINGS)
  const hoverClearRef = useRef<number | null>(null)

  const occupied = useMemo(() => {
    const map = new Map<string, SpecimenInstance>()
    for (const item of instances) map.set(cellKey(item.col, item.row), item)
    return map
  }, [instances])

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
    if (hoverClearRef.current !== null) window.clearTimeout(hoverClearRef.current)
    hoverClearRef.current = window.setTimeout(() => {
      setHoveredId((current) => (current === id ? null : current))
      hoverClearRef.current = null
    }, 120)
  }

  const onPlanePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('[data-ui-chrome]')) {
      return
    }
    if (openDock) {
      setOpenDock(null)
      return
    }

    const el = planeRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cell = pixelToNearestCell(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height)
    const existing = occupied.get(cellKey(cell.col, cell.row))
    if (existing) {
      setInspected(existing)
      return
    }
    if (cellOverlapsHero(cell.col, cell.row)) return
    setInstances((prev) => [...prev, instanceAtCell(cell.col, cell.row)])
  }

  const removeInstance = (id: string) => {
    setInstances((prev) => prev.filter((item) => item.id !== id))
    setHoveredId((current) => (current === id ? null : current))
    setInspected((current) => (current?.id === id ? null : current))
  }

  const hovered = instances.find((item) => item.id === hoveredId) ?? null

  return (
    <div className="flex h-full min-h-svh w-full flex-col bg-[#090A0E] font-mono">
      <div
        ref={planeRef}
        className="relative min-h-0 w-full flex-1 cursor-crosshair overflow-hidden"
        onPointerDown={onPlanePointerDown}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[#222634] bg-[#0E1015]"
          style={{ width: HERO_SIZE, height: HERO_SIZE }}
        >
          <SpecimenCanvas weights={BALANCED_WEIGHTS} size={HERO_SIZE} settings={settings} />
        </div>

        {instances.map((instance) => {
          const pixel = cellCenterPixel(instance.col, instance.row, size.width, size.height)
          const active = instance.id === hoveredId || instance.id === inspected?.id
          return (
            <div
              key={instance.id}
              className="absolute tile-spring"
              style={{
                left: pixel.x,
                top: pixel.y,
                width: instance.size,
                height: instance.size,
                zIndex: active ? 30 : 20,
              }}
              onPointerEnter={() => holdHover(instance.id)}
              onPointerLeave={() => releaseHover(instance.id)}
            >
              <div
                className="overflow-hidden rounded-xl border border-[#222634] bg-[#0E1015]"
                style={{ width: instance.size, height: instance.size }}
              >
                <SpecimenCanvas weights={instance.weights} size={instance.size} settings={settings} />
              </div>
            </div>
          )
        })}

        {hovered && (
          <HoverBadge
            instance={hovered}
            plane={size}
            onRemove={() => removeInstance(hovered.id)}
            onPointerEnter={() => holdHover(hovered.id)}
            onPointerLeave={() => releaseHover(hovered.id)}
          />
        )}

        {CORNER_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            data-ui-chrome="dock"
            className={`absolute z-40 rounded-full border border-white/10 bg-[#12141A]/80 px-3 py-1.5 font-mono text-[11px] tracking-[0.12em] text-neutral-300 backdrop-blur-md transition-colors hover:border-white/20 hover:text-white ${DOCK_POS[key]}`}
            onPointerDown={(event) => {
              event.stopPropagation()
              setOpenDock((current) => (current === key ? null : key))
            }}
          >
            {CORNERS[key].title}
          </button>
        ))}

        {openDock && (
          <div
            data-ui-chrome="popover"
            className={`absolute z-50 w-[300px] rounded-2xl border border-[#222634] bg-[#12141A]/95 p-4 shadow-2xl backdrop-blur-md ${PILL_POS[openDock]}`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <CornerPopover corner={openDock} settings={settings} onSettings={setSettings} />
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
        <span>Snap Field: {GRID_COLS}×{GRID_ROWS}</span>
        <span>Specimens: [{instances.length}]</span>
        <span>Pitch: {CELL_SPACING}px · Tile: {TILE_SIZE}px</span>
      </footer>

      {inspected && (
        <InspectionModal
          instance={inspected}
          settings={settings}
          onClose={() => setInspected(null)}
        />
      )}
    </div>
  )
}

function HoverBadge({
  instance,
  plane,
  onRemove,
  onPointerEnter,
  onPointerLeave,
}: {
  instance: SpecimenInstance
  plane: { width: number; height: number }
  onRemove: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}) {
  const pixel = cellCenterPixel(instance.col, instance.row, plane.width, plane.height)
  const width = 268
  const left = Math.min(Math.max(12, pixel.x - width / 2), Math.max(12, plane.width - width - 12))
  const top = pixel.y - instance.size / 2 - 10

  return (
    <div
      data-ui-chrome="hover"
      className="absolute z-40"
      style={{
        left,
        top,
        width,
        transform: 'translateY(-100%)',
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2 rounded-full border border-[#222634] bg-[#12141A]/95 px-3 py-1.5 shadow-2xl backdrop-blur-md">
        <div className="font-mono text-[10px] tabular-nums text-neutral-100">{formatCoordBadge(instance)}</div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full bg-red-500/15 px-2.5 py-0.5 font-mono text-[10px] text-red-400 transition-colors hover:bg-red-500/30"
        >
          ( Remove )
        </button>
      </div>
    </div>
  )
}
