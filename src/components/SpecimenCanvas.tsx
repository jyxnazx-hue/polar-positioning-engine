import { useEffect, useRef } from 'react'
import type { CornerWeights, RenderSettings } from '../utils/polarMath'
import { DEFAULT_RENDER_SETTINGS } from '../utils/polarMath'

interface SpecimenCanvasProps {
  weights: CornerWeights
  size: number
  settings: RenderSettings
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

  ctx.restore()
}

export function renderPlate(
  ctx: CanvasRenderingContext2D,
  size: number,
  weights: CornerWeights,
  settings: RenderSettings = DEFAULT_RENDER_SETTINGS,
) {
  ctx.fillStyle = '#111319'
  ctx.fillRect(0, 0, size, size)

  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.4
  const { w1, w2, w3, w4 } = weights

  const hatchSpacing = settings.hatchSpacing
  const strokeWeight = settings.strokeWeight
  const chromaticShift = Math.min(6, Math.max(2, settings.chromaticShift))
  const spectralGain = settings.spectralGain
  const inkWidth = Math.min(3.5, Math.max(1, settings.inkSpread))
  const paperSoak = settings.paperSoak
  const matrixSpacing = settings.matrixSpacing
  const dotGain = Math.min(1.8, Math.max(0.8, settings.dotGain))

  // SW — crisp sumi strokes (no canvas blur)
  if (w3 > 0.04) {
    ctx.save()
    ctx.strokeStyle = `rgba(190, 160, 120, ${0.22 + paperSoak * w3})`
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const bands = 7
    for (let i = 0; i < bands; i++) {
      const t = (i / (bands - 1) - 0.5) * radius * 1.4
      ctx.lineWidth = inkWidth * (0.65 + w3 * 0.9)
      ctx.beginPath()
      ctx.moveTo(cx - radius * 0.95, cy + t * 0.35)
      ctx.quadraticCurveTo(cx + t * 0.15, cy + t, cx + radius * 0.95, cy + t * 0.2)
      ctx.stroke()
    }
    ctx.strokeStyle = `rgba(190, 160, 120, ${0.18 + w3 * 0.28})`
    ctx.lineWidth = Math.max(1, inkWidth * 0.7)
    ctx.beginPath()
    ctx.arc(cx, cy, radius * (0.92 + w3 * 0.08), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // NE — red/cyan offset, 2–6px
  if (w2 > 0.05) {
    const shift = chromaticShift * w2
    const alpha = spectralGain * Math.max(0.35, w2)
    drawAstrolabe(ctx, cx, cy, radius, -shift, `rgba(255, 48, 48, ${alpha})`, Math.max(0.7, strokeWeight * 0.9))
    drawAstrolabe(ctx, cx, cy, radius, shift, `rgba(0, 220, 255, ${alpha})`, Math.max(0.7, strokeWeight * 0.9))
  }

  const plateAlpha = 0.28 + w1 * 0.62
  drawAstrolabe(ctx, cx, cy, radius, 0, `rgba(255, 255, 255, ${plateAlpha})`, strokeWeight)

  // NW — sharp white cross-hatch
  if (w1 > 0.06) {
    ctx.save()
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 + w1 * 0.7})`
    ctx.lineWidth = Math.max(0.5, strokeWeight)
    const step = Math.max(3.2, hatchSpacing)
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

  // SE — sharp halftone dots
  if (w4 > 0.06) {
    ctx.save()
    const cell = Math.max(4, matrixSpacing)
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

export function SpecimenCanvas({ weights, size, settings }: SpecimenCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
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
