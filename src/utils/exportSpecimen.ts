import type { SpecimenInstance } from '../utils/polarMath'
import { DEFAULT_RENDER_SETTINGS, formatAxis, pct } from '../utils/polarMath'
import { renderPlate } from '../components/SpecimenCanvas'

function download(filename: string, href: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

export function exportSpecimenState(instance: SpecimenInstance) {
  const payload = {
    id: instance.id,
    x: instance.x,
    y: instance.y,
    weights: instance.weights,
    readout: `[ X: ${formatAxis(instance.x)} | Y: ${formatAxis(instance.y)} ]`,
    mix: {
      etch: pct(instance.weights.w1),
      caustic: pct(instance.weights.w2),
      bleed: pct(instance.weights.w3),
      dither: pct(instance.weights.w4),
    },
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  download(`specimen-${instance.id.slice(0, 8)}.json`, url)
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)

  const size = 480
  const canvas = document.createElement('canvas')
  const dpr = 2
  canvas.width = size * dpr
  canvas.height = size * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  renderPlate(ctx, size, instance.weights, DEFAULT_RENDER_SETTINGS)
  download(`specimen-${instance.id.slice(0, 8)}.png`, canvas.toDataURL('image/png'))
}
