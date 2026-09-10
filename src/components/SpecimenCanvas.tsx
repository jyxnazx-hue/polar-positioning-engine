import { useEffect, useRef } from 'react'
import type { CornerParamMap, CornerWeights } from '../utils/polarMath'
import { DEFAULT_POLE_PARAMS } from '../utils/polarMath'

interface SpecimenCanvasProps {
  weights: CornerWeights
  size: number
  poleParams?: CornerParamMap
  compact?: boolean
}

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

function drawAstrolabe(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  offsetX: number,
  strokeStyle: string,
  lineWidth: number,
  detail: number,
) {
  ctx.save()
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const ox = cx + offsetX

  for (const r of [radius, radius * 0.82, radius * 0.64, radius * 0.28]) {
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

  const rays = detail > 0.55 ? 16 : 12
  for (let i = 0; i < rays; i++) {
    const theta = (i * Math.PI * 2) / rays
    const inner = radius * (i % 2 === 0 ? 0.28 : 0.4)
    ctx.beginPath()
    ctx.moveTo(ox + Math.cos(theta) * inner, cy + Math.sin(theta) * inner)
    ctx.lineTo(ox + Math.cos(theta) * radius, cy + Math.sin(theta) * radius)
    ctx.stroke()
  }

  const ticks = detail > 0.55 ? 72 : 36
  for (let i = 0; i < ticks; i++) {
    const theta = (i * Math.PI * 2) / ticks
    const major = i % 6 === 0
    const t0 = radius * (major ? 0.92 : 0.96)
    ctx.beginPath()
    ctx.moveTo(ox + Math.cos(theta) * t0, cy + Math.sin(theta) * t0)
    ctx.lineTo(ox + Math.cos(theta) * radius, cy + Math.sin(theta) * radius)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(ox, cy, radius * 0.12, 0, Math.PI * 2)
  ctx.stroke()

  ctx.restore()
}

export function renderPlate(
  ctx: CanvasRenderingContext2D,
  size: number,
  weights: CornerWeights,
  poleParams: CornerParamMap = DEFAULT_POLE_PARAMS,
) {
  ctx.fillStyle = '#0B0C11'
  ctx.fillRect(0, 0, size, size)

  const cx = size / 2
  const cy = size / 2
  const baseRadius = size * 0.38
  const scale = size / 420
  const etch = weights.w1 * (0.35 + poleParams.w1.primary)
  const contrast = poleParams.w1.secondary
  const caustic = weights.w2 * (0.35 + poleParams.w2.secondary)
  const shiftAmt = poleParams.w2.primary
  const bleed = weights.w3 * (0.35 + poleParams.w3.primary)
  const fiber = poleParams.w3.secondary
  const dither = weights.w4 * (0.35 + poleParams.w4.secondary)
  const frequency = poleParams.w4.primary

  if (bleed > 0.01) {
    const pool = ctx.createRadialGradient(
      cx,
      cy,
      baseRadius * 0.15,
      cx,
      cy,
      baseRadius * (1.1 + bleed * 0.35 + fiber * 0.2),
    )
    pool.addColorStop(0, `rgba(42, 28, 18, ${0.55 * bleed})`)
    pool.addColorStop(0.45, `rgba(160, 118, 72, ${0.28 * bleed})`)
    pool.addColorStop(0.78, `rgba(180, 150, 110, ${0.14 * bleed * fiber})`)
    pool.addColorStop(1, 'rgba(11, 12, 17, 0)')
    ctx.fillStyle = pool
    ctx.beginPath()
    ctx.arc(cx, cy, baseRadius * 1.28, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.globalAlpha = bleed * 0.35 * fiber
    ctx.strokeStyle = 'rgba(196, 154, 96, 0.45)'
    ctx.lineWidth = (6 + bleed * 10) * scale
    ctx.beginPath()
    ctx.arc(cx, cy, baseRadius * 1.02, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  if (caustic > 0.03) {
    const shift = caustic * 10 * shiftAmt * Math.max(scale, 0.35)
    const fringe = 0.35 + caustic * 0.55
    drawAstrolabe(ctx, cx, cy, baseRadius, -shift, `rgba(239, 68, 68, ${fringe})`, Math.max(0.6, 1.35 * scale), scale)
    drawAstrolabe(ctx, cx, cy, baseRadius, shift, `rgba(0, 229, 255, ${fringe})`, Math.max(0.6, 1.35 * scale), scale)
  }

  const strokeWidth = Math.max(0.45, (0.85 + bleed * 2.2 + etch * 0.4) * Math.max(scale, 0.4))
  const baseAlpha = 0.32 + etch * 0.55 * (0.45 + contrast)
  drawAstrolabe(ctx, cx, cy, baseRadius, 0, `rgba(244, 241, 234, ${baseAlpha})`, strokeWidth, scale)

  if (etch > 0.04) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2)
    ctx.clip()
    ctx.strokeStyle = `rgba(229, 169, 60, ${0.42 * etch * contrast})`
    ctx.lineWidth = Math.max(0.4, (0.7 + etch * 0.4) * Math.max(scale, 0.45))
    const step = Math.max(2.2, (16 - etch * 12 * poleParams.w1.primary) * Math.max(scale, 0.55))
    const span = baseRadius
    for (let x = cx - span; x < cx + span; x += step) {
      ctx.beginPath()
      ctx.moveTo(x, cy - span)
      ctx.lineTo(x + span * 0.55, cy + span)
      ctx.stroke()
    }
    ctx.strokeStyle = `rgba(244, 241, 234, ${0.18 * etch})`
    for (let y = cy - span; y < cy + span; y += step * 1.35) {
      ctx.beginPath()
      ctx.moveTo(cx - span, y)
      ctx.lineTo(cx + span, y + span * 0.12)
      ctx.stroke()
    }
    ctx.restore()
  }

  if (dither > 0.04) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2)
    ctx.clip()
    const cell = Math.max(2.2, (6.5 - frequency * 3.2) * Math.max(scale, 0.7))
    const maxR = Math.max(0.45, 2.4 * dither * Math.max(scale, 0.6))
    for (let ix = 0; ix < size / cell; ix++) {
      for (let iy = 0; iy < size / cell; iy++) {
        const x = ix * cell + cell * 0.5
        const y = iy * cell + cell * 0.5
        const dist = Math.hypot(x - cx, y - cy)
        if (dist > baseRadius) continue
        const density = 1 - dist / baseRadius
        const threshold = BAYER4[iy & 3][ix & 3] / 16
        if (density * (0.3 + dither) > threshold) {
          const r = Math.max(0.28, maxR * density)
          ctx.fillStyle = `rgba(244, 244, 240, ${0.22 + dither * 0.35})`
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    ctx.restore()
  }
}

export function SpecimenCanvas({
  weights,
  size,
  poleParams = DEFAULT_POLE_PARAMS,
  compact = false,
}: SpecimenCanvasProps) {
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
    renderPlate(ctx, size, weights, poleParams)
  }, [weights, size, poleParams])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={compact ? 'pointer-events-none block' : 'pointer-events-none block rounded-2xl'}
    />
  )
}
