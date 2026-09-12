import { useLayoutEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { CornerWeights, RenderSettings } from '../utils/polarMath'
import { DEFAULT_RENDER_SETTINGS } from '../utils/polarMath'

interface SpecimenCanvasProps {
  weights: CornerWeights
  size: number
  settings?: RenderSettings
  exportRef?: MutableRefObject<HTMLCanvasElement | null>
}

function drawAstrolabe(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  offsetX: number,
  strokeStyle: string,
  lineWidth: number,
) {
  ctx.save()
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const ox = cx + offsetX

  for (const r of [radius, radius * 0.76, radius * 0.5, radius * 0.2]) {
    ctx.beginPath()
    ctx.arc(ox, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.moveTo(ox - radius, cy)
  ctx.lineTo(ox + radius, cy)
  ctx.moveTo(ox, cy - radius)
  ctx.lineTo(ox, cy + radius)
  ctx.stroke()

  const rays = 12
  for (let i = 0; i < rays; i++) {
    const theta = (i * Math.PI * 2) / rays
    ctx.beginPath()
    ctx.moveTo(ox + Math.cos(theta) * radius * 0.2, cy + Math.sin(theta) * radius * 0.2)
    ctx.lineTo(ox + Math.cos(theta) * radius, cy + Math.sin(theta) * radius)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(ox, cy, radius * 0.08, 0, Math.PI * 2)
  ctx.stroke()

  ctx.restore()
}

export function renderPlate(
  ctx: CanvasRenderingContext2D,
  size: number,
  weights: CornerWeights,
  settings: RenderSettings = DEFAULT_RENDER_SETTINGS,
) {
  ctx.fillStyle = '#0E1015'
  ctx.fillRect(0, 0, size, size)

  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.4
  const { w1, w2, w3, w4 } = weights

  const hatchSpacing = settings.hatchSpacing
  const strokeWeight = settings.strokeWeight
  const chromaticShift = Math.min(6, Math.max(2, settings.chromaticShift))
  const spectralGain = settings.spectralGain
  const inkWidth = Math.min(3, Math.max(1, settings.inkSpread))
  const paperSoak = settings.paperSoak
  const matrixSpacing = settings.matrixSpacing
  const dotGain = Math.min(1.8, Math.max(0.8, settings.dotGain))

  // SW — radial ink pooling, capillary blur, fibrous spreading
  if (w3 > 0.04) {
    ctx.save()
    const pool = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius * (1.05 + w3 * 0.22))
    pool.addColorStop(0, `rgba(168, 128, 78, ${0.12 + paperSoak * w3 * 0.55})`)
    pool.addColorStop(0.45, `rgba(140, 104, 62, ${0.08 + w3 * 0.18})`)
    pool.addColorStop(1, 'rgba(14, 16, 21, 0)')
    ctx.fillStyle = pool
    ctx.fillRect(0, 0, size, size)

    ctx.strokeStyle = `rgba(180, 150, 110, ${0.22 + paperSoak * w3})`
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.shadowColor = `rgba(180, 140, 90, ${0.35 + w3 * 0.4})`
    ctx.shadowBlur = 6 + paperSoak * 22 * w3

    const bands = 7
    for (let i = 0; i < bands; i++) {
      const t = (i / (bands - 1) - 0.5) * radius * 1.4
      ctx.lineWidth = Math.min(4.2, inkWidth * (0.7 + w3 * 1.15))
      ctx.beginPath()
      ctx.moveTo(cx - radius * 0.95, cy + t * 0.35)
      ctx.quadraticCurveTo(cx + t * 0.15, cy + t, cx + radius * 0.95, cy + t * 0.2)
      ctx.stroke()
    }

    ctx.shadowBlur = 10 + w3 * 16
    ctx.strokeStyle = `rgba(180, 150, 110, ${0.18 + w3 * 0.32})`
    ctx.lineWidth = Math.min(3.4, Math.max(1, inkWidth * 0.85))
    ctx.beginPath()
    ctx.arc(cx, cy, radius * (0.92 + w3 * 0.08), 0, Math.PI * 2)
    ctx.stroke()

    ctx.shadowBlur = 0
    ctx.strokeStyle = `rgba(196, 168, 128, ${0.08 + w3 * 0.16})`
    ctx.lineWidth = 0.6
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      const jitter = 0.82 + ((i * 17) % 7) * 0.02
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * radius * 0.55, cy + Math.sin(a) * radius * 0.55)
      ctx.lineTo(cx + Math.cos(a) * radius * jitter, cy + Math.sin(a) * radius * jitter)
      ctx.stroke()
    }
    ctx.restore()
  }

  // NE — red/cyan chromatic split on radial plate lines
  if (w2 > 0.05) {
    const shift = chromaticShift * w2
    const alpha = spectralGain * Math.max(0.35, w2)
    drawAstrolabe(ctx, cx, cy, radius, -shift, `rgba(255, 48, 48, ${alpha})`, Math.max(0.7, strokeWeight * 0.9))
    drawAstrolabe(ctx, cx, cy, radius, shift, `rgba(0, 220, 255, ${alpha})`, Math.max(0.7, strokeWeight * 0.9))
  }

  const plateAlpha = 0.28 + w1 * 0.62
  drawAstrolabe(ctx, cx, cy, radius, 0, `rgba(255, 255, 255, ${plateAlpha})`, strokeWeight)

  // NW — intaglio cross-hatch density from w1
  if (w1 > 0.06) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, radius * 1.02, 0, Math.PI * 2)
    ctx.clip()
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 + w1 * 0.7})`
    ctx.lineWidth = Math.max(0.45, strokeWeight * (0.75 + w1 * 0.35))
    const step = Math.max(2.6, hatchSpacing / (0.55 + w1 * 1.15))
    for (let x = -size; x < size * 2; x += step) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + size * 0.5, size)
      ctx.stroke()
    }
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 + w1 * 0.35})`
    for (let y = -size; y < size * 2; y += step * 1.3) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size, y + size * 0.08)
      ctx.stroke()
    }
    ctx.restore()
  }

  // SE — Bayer / halftone matrix on high-density regions
  if (w4 > 0.06) {
    ctx.save()
    const cell = Math.max(4, matrixSpacing / (0.75 + w4 * 0.45))
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
    for (let iy = 0; iy < size / cell + 2; iy++) {
      for (let ix = 0; ix < size / cell + 2; ix++) {
        const x = ix * cell + cell * 0.5
        const y = iy * cell + cell * 0.5
        const dist = Math.hypot(x - cx, y - cy)
        const density = Math.max(0, 1 - dist / (radius * 1.15))
        const threshold = bayer[(iy & 3) * 4 + (ix & 3)] / 16
        if (density * w4 <= threshold * 0.8) continue
        const r = Math.min(1.8, Math.max(0.8, dotGain * (0.55 + density * w4)))
        ctx.fillStyle = `rgba(255, 255, 255, ${0.45 + w4 * 0.5})`
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }
}

export function SpecimenCanvas({ weights, size, settings = DEFAULT_RENDER_SETTINGS, exportRef }: SpecimenCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (exportRef) exportRef.current = canvas
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return
    ctxRef.current = ctx
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [size, exportRef])

  useLayoutEffect(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    renderPlate(ctx, size, weights, settings)
  }, [weights, size, settings])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="pointer-events-none block"
    />
  )
}
