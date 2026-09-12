import type { CornerWeights, RenderSettings } from './polarMath'
import { DEFAULT_RENDER_SETTINGS } from './polarMath'

const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

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
  ctx.filter = 'none'
  ctx.imageSmoothingEnabled = false
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

  // Bottom-left — crisp sumi-e ink washes (stroke dilation, never blur)
  if (w3 > 0.04) {
    ctx.save()
    const wash = 0.18 + paperSoak * w3 * 0.55
    ctx.strokeStyle = `rgba(180, 150, 110, ${Math.min(0.55, wash)})`
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const bands = 8
    for (let i = 0; i < bands; i++) {
      const t = (i / (bands - 1) - 0.5) * radius * 1.45
      ctx.lineWidth = inkWidth * (0.7 + w3 * 0.85)
      ctx.beginPath()
      ctx.moveTo(cx - radius * 0.95, cy + t * 0.35)
      ctx.quadraticCurveTo(cx + t * 0.15, cy + t, cx + radius * 0.95, cy + t * 0.2)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(180, 150, 110, 0.4)'
    ctx.lineWidth = inkWidth
    ctx.beginPath()
    ctx.arc(cx, cy, radius * (0.92 + w3 * 0.08), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // Top-right — red / cyan channel offset, 2–6px, no blur
  if (w2 > 0.05) {
    const shift = chromaticShift * w2
    const alpha = spectralGain * Math.max(0.35, w2)
    drawAstrolabe(ctx, cx, cy, radius, -shift, `rgba(255, 48, 48, ${alpha})`, Math.max(0.7, strokeWeight * 0.9))
    drawAstrolabe(ctx, cx, cy, radius, shift, `rgba(0, 220, 255, ${alpha})`, Math.max(0.7, strokeWeight * 0.9))
  }

  const plateAlpha = 0.28 + w1 * 0.62
  drawAstrolabe(ctx, cx, cy, radius, 0, `rgba(255, 255, 255, ${plateAlpha})`, strokeWeight)

  // Top-left — razor-sharp white intaglio cross-hatch
  if (w1 > 0.06) {
    ctx.save()
    ctx.strokeStyle = '#FFFFFF'
    ctx.globalAlpha = 0.35 + w1 * 0.55
    ctx.lineWidth = Math.max(0.45, strokeWeight * 0.85)
    ctx.lineCap = 'butt'
    const step = Math.max(3.2, hatchSpacing)
    for (let x = -size; x < size * 2; x += step) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + size, size)
      ctx.stroke()
    }
    ctx.globalAlpha = 0.18 + w1 * 0.4
    for (let x = -size; x < size * 2; x += step) {
      ctx.beginPath()
      ctx.moveTo(x + size, 0)
      ctx.lineTo(x, size)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Bottom-right — Bayer 4×4 halftone dots
  if (w4 > 0.06) {
    ctx.save()
    const cell = Math.max(4, matrixSpacing)
    for (let iy = 0; iy < size / cell + 2; iy++) {
      for (let ix = 0; ix < size / cell + 2; ix++) {
        const x = ix * cell + cell * 0.5
        const y = iy * cell + cell * 0.5
        const dist = Math.hypot(x - cx, y - cy)
        const density = Math.max(0, 1 - dist / (radius * 1.15))
        const threshold = BAYER_4[(iy & 3) * 4 + (ix & 3)] / 16
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

function svgAstrolabe(
  cx: number,
  cy: number,
  radius: number,
  offsetX: number,
  stroke: string,
  lineWidth: number,
): string {
  const ox = cx + offsetX
  const rings = [radius, radius * 0.76, radius * 0.5, radius * 0.2]
    .map((r) => `<circle cx="${ox}" cy="${cy}" r="${r}" />`)
    .join('')
  const axes = `<line x1="${ox - radius}" y1="${cy}" x2="${ox + radius}" y2="${cy}" /><line x1="${ox}" y1="${cy - radius}" x2="${ox}" y2="${cy + radius}" />`
  let rays = ''
  for (let i = 0; i < 12; i++) {
    const theta = (i * Math.PI * 2) / 12
    rays += `<line x1="${ox + Math.cos(theta) * radius * 0.2}" y1="${cy + Math.sin(theta) * radius * 0.2}" x2="${ox + Math.cos(theta) * radius}" y2="${cy + Math.sin(theta) * radius}" />`
  }
  return `<g fill="none" stroke="${stroke}" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round">${rings}${axes}${rays}</g>`
}

export function plateToSvg(
  size: number,
  weights: CornerWeights,
  settings: RenderSettings = DEFAULT_RENDER_SETTINGS,
): string {
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

  let body = `<rect width="${size}" height="${size}" fill="#0E1015" />`

  if (w3 > 0.04) {
    const wash = Math.min(0.55, 0.18 + paperSoak * w3 * 0.55)
    const bands = 8
    let paths = ''
    for (let i = 0; i < bands; i++) {
      const t = (i / (bands - 1) - 0.5) * radius * 1.45
      const w = inkWidth * (0.7 + w3 * 0.85)
      paths += `<path d="M ${cx - radius * 0.95} ${cy + t * 0.35} Q ${cx + t * 0.15} ${cy + t} ${cx + radius * 0.95} ${cy + t * 0.2}" fill="none" stroke="rgba(180,150,110,${wash})" stroke-width="${w}" stroke-linecap="round" />`
    }
    paths += `<circle cx="${cx}" cy="${cy}" r="${radius * (0.92 + w3 * 0.08)}" fill="none" stroke="rgba(180,150,110,0.4)" stroke-width="${inkWidth}" />`
    body += paths
  }

  if (w2 > 0.05) {
    const shift = chromaticShift * w2
    const alpha = spectralGain * Math.max(0.35, w2)
    body += svgAstrolabe(cx, cy, radius, -shift, `rgba(255,48,48,${alpha})`, Math.max(0.7, strokeWeight * 0.9))
    body += svgAstrolabe(cx, cy, radius, shift, `rgba(0,220,255,${alpha})`, Math.max(0.7, strokeWeight * 0.9))
  }

  const plateAlpha = 0.28 + w1 * 0.62
  body += svgAstrolabe(cx, cy, radius, 0, `rgba(255,255,255,${plateAlpha})`, strokeWeight)

  if (w1 > 0.06) {
    const step = Math.max(3.2, hatchSpacing)
    const a1 = 0.35 + w1 * 0.55
    const a2 = 0.18 + w1 * 0.4
    const lw = Math.max(0.45, strokeWeight * 0.85)
    let lines = ''
    for (let x = -size; x < size * 2; x += step) {
      lines += `<line x1="${x}" y1="0" x2="${x + size}" y2="${size}" />`
    }
    body += `<g stroke="#FFFFFF" stroke-width="${lw}" stroke-opacity="${a1}" fill="none">${lines}</g>`
    lines = ''
    for (let x = -size; x < size * 2; x += step) {
      lines += `<line x1="${x + size}" y1="0" x2="${x}" y2="${size}" />`
    }
    body += `<g stroke="#FFFFFF" stroke-width="${lw}" stroke-opacity="${a2}" fill="none">${lines}</g>`
  }

  if (w4 > 0.06) {
    const cell = Math.max(4, matrixSpacing)
    let dots = ''
    for (let iy = 0; iy < size / cell + 2; iy++) {
      for (let ix = 0; ix < size / cell + 2; ix++) {
        const x = ix * cell + cell * 0.5
        const y = iy * cell + cell * 0.5
        const dist = Math.hypot(x - cx, y - cy)
        const density = Math.max(0, 1 - dist / (radius * 1.15))
        const threshold = BAYER_4[(iy & 3) * 4 + (ix & 3)] / 16
        if (density * w4 <= threshold * 0.8) continue
        const r = Math.min(1.8, Math.max(0.8, dotGain * (0.55 + density * w4)))
        const a = 0.45 + w4 * 0.5
        dots += `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,${a})" />`
      }
    }
    body += dots
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`
}

export function renderPlateToPngBlob(
  size: number,
  weights: CornerWeights,
  settings: RenderSettings,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return Promise.reject(new Error('Canvas unsupported'))
  renderPlate(ctx, size, weights, settings)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG encode failed'))
    }, 'image/png')
  })
}
