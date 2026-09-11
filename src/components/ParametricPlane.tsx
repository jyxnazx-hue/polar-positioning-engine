import { useEffect, useRef, useState } from 'react'
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from 'react'
import { SpecimenCanvas } from './SpecimenCanvas'
import type { CornerKey, RenderSettings, SpecimenInstance } from '../utils/polarMath'
import {
  BALANCED_WEIGHTS,
  CORNER_ORDER,
  CORNERS,
  DEFAULT_RENDER_SETTINGS,
  HERO_SIZE,
  STATUS_BAR_H,
  TILE_SIZE,
  heroClearance,
  instanceAtPoint,
  normalizedToPixelRect,
  pixelToNormalizedRect,
  resolveClearance,
  tileClearance,
} from '../utils/polarMath'

function formatAxis(n: number): string {
  const sign = n >= 0 ? '+' : '−'
  return `${sign}${Math.abs(n).toFixed(3)}`
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
  const lastStampRef = useRef(0)
  const [size, setSize] = useState({ width: 900, height: 650 })
  const [instances, setInstances] = useState<SpecimenInstance[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [inspected, setInspected] = useState<SpecimenInstance | null>(null)
  const [openDock, setOpenDock] = useState<CornerKey | null>(null)
  const [settings, setSettings] = useState<RenderSettings>(DEFAULT_RENDER_SETTINGS)
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
    if (hoverClearRef.current !== null) window.clearTimeout(hoverClearRef.current)
    hoverClearRef.current = window.setTimeout(() => {
      setHoveredId((current) => (current === id ? null : current))
      hoverClearRef.current = null
    }, 120)
  }

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

    const now = performance.now()
    if (now - lastStampRef.current < 280) return
    lastStampRef.current = now

    const el = planeRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const obstacles = [
      { x: rect.width / 2, y: rect.height / 2, clearance: heroClearance() },
      ...instances.map((item) => {
        const p = normalizedToPixelRect(item, rect.width, rect.height)
        return { x: p.x, y: p.y, clearance: tileClearance() }
      }),
    ]
    const coords = resolveClearance(
      event.clientX - rect.left,
      event.clientY - rect.top,
      { width: rect.width, height: rect.height },
      obstacles,
    )
    setInstances((prev) => [...prev, instanceAtPoint(coords.x, coords.y)])
  }

  const removeInstance = (id: string) => {
    setInstances((prev) => prev.filter((item) => item.id !== id))
    setHoveredId((current) => (current === id ? null : current))
    setInspected((current) => (current?.id === id ? null : current))
  }

  const heroWeights = inspected?.weights ?? BALANCED_WEIGHTS
  const hovered = instances.find((item) => item.id === hoveredId) ?? null

  return (
    <div className="flex h-full min-h-svh w-full flex-col bg-[#090A0E]">
      <div
        ref={planeRef}
        className="relative min-h-0 w-full flex-1 cursor-crosshair overflow-hidden"
        onPointerDown={onPlanePointerDown}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[#222634] bg-[#111319]"
          style={{
            width: HERO_SIZE,
            height: HERO_SIZE,
          }}
        >
          <SpecimenCanvas weights={heroWeights} size={HERO_SIZE} settings={settings} />
        </div>

        {instances.map((instance) => {
          const pixel = normalizedToPixelRect(instance, size.width, size.height)
          const active = instance.id === hoveredId || instance.id === inspected?.id
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
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div
                className="overflow-hidden rounded-xl border border-[#222634] bg-[#111319]"
                style={{
                  width: instance.size,
                  height: instance.size,
                }}
              >
                <SpecimenCanvas weights={instance.weights} size={instance.size} settings={settings} />
              </div>
            </div>
          )
        })}

        {hovered && (
          <InspectionHud
            instance={hovered}
            plane={size}
            onInspect={() => setInspected(hovered)}
            onRemove={() => removeInstance(hovered.id)}
            onPointerEnter={() => holdHover(hovered.id)}
            onPointerLeave={() => releaseHover(hovered.id)}
          />
        )}

        {CORNER_ORDER.map((key) => (
          <button
            key={key}
            type="button"
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
            className={`absolute z-50 w-[280px] rounded-2xl border border-[#222634] bg-[#12141A]/95 p-4 shadow-2xl backdrop-blur-md ${PILL_POS[openDock]}`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <CornerPill corner={openDock} settings={settings} onSettings={setSettings} />
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
        <span>Specimens Generated: [{instances.length}]</span>
        <span>Clearance: {tileClearance()}px</span>
        <span>Field Clamp: ±0.850</span>
      </footer>
    </div>
  )
}

function CornerPill({
  corner,
  settings,
  onSettings,
}: {
  corner: CornerKey
  settings: RenderSettings
  onSettings: Dispatch<SetStateAction<RenderSettings>>
}) {
  const fields =
    corner === 'w1'
      ? ([
          { key: 'hatchSpacing', label: CORNERS.w1.sliders[0], min: 4, max: 18, step: 0.5, invert: true },
          { key: 'strokeWeight', label: CORNERS.w1.sliders[1], min: 0.5, max: 2.5, step: 0.05, invert: false },
        ] as const)
      : corner === 'w2'
        ? ([
            { key: 'chromaticShift', label: CORNERS.w2.sliders[0], min: 2, max: 6, step: 0.1, invert: false },
            { key: 'spectralGain', label: CORNERS.w2.sliders[1], min: 0.2, max: 1, step: 0.01, invert: false },
          ] as const)
        : corner === 'w3'
          ? ([
              { key: 'inkSpread', label: CORNERS.w3.sliders[0], min: 1, max: 3.5, step: 0.05, invert: false },
              { key: 'paperSoak', label: CORNERS.w3.sliders[1], min: 0.15, max: 0.7, step: 0.01, invert: false },
            ] as const)
          : ([
              { key: 'matrixSpacing', label: CORNERS.w4.sliders[0], min: 5, max: 12, step: 0.1, invert: true },
              { key: 'dotGain', label: CORNERS.w4.sliders[1], min: 0.8, max: 1.8, step: 0.05, invert: false },
            ] as const)

  return (
    <>
      <div className="mb-3 font-mono text-[11px] tracking-[0.14em] text-neutral-400">{CORNERS[corner].title}</div>
      {fields.map((field) => (
        <label key={field.key} className="mb-3 block last:mb-0">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-neutral-500">
            <span>{field.label}</span>
            <span className="tabular-nums text-neutral-300">{settings[field.key].toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={settings[field.key]}
            className="pole-slider w-full"
            style={field.invert ? { direction: 'rtl' } : undefined}
            onChange={(event) => {
              const value = Number(event.target.value)
              onSettings((prev) => ({ ...prev, [field.key]: value }))
            }}
          />
        </label>
      ))}
    </>
  )
}

function InspectionHud({
  instance,
  plane,
  onInspect,
  onRemove,
  onPointerEnter,
  onPointerLeave,
}: {
  instance: SpecimenInstance
  plane: { width: number; height: number }
  onInspect: () => void
  onRemove: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}) {
  const pixel = normalizedToPixelRect(instance, plane.width, plane.height)
  const hudWidth = 220
  const left = Math.min(Math.max(12, pixel.x - hudWidth / 2), Math.max(12, plane.width - hudWidth - 12))
  const preferAbove = pixel.y > 140
  const top = preferAbove ? pixel.y - instance.size / 2 - 8 : pixel.y + instance.size / 2 + 8

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
      <div className="rounded-2xl border border-[#222634] bg-[#12141A]/95 px-3 py-2.5 shadow-2xl backdrop-blur-md">
        <div className="font-mono text-[10px] tabular-nums text-neutral-100">
          [ X: {formatAxis(instance.x)} | Y: {formatAxis(instance.y)} ]
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onInspect}
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black transition-transform hover:scale-105"
          >
            Inspect
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/30"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}
