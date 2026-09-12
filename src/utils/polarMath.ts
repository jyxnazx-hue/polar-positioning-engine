export interface Point2D {
  x: number
  y: number
}

export interface CornerWeights {
  w1: number
  w2: number
  w3: number
  w4: number
}

export type CornerKey = keyof CornerWeights

export interface RenderSettings {
  hatchSpacing: number
  strokeWeight: number
  chromaticShift: number
  spectralGain: number
  inkSpread: number
  paperSoak: number
  matrixSpacing: number
  dotGain: number
}

export type Quadrant = 'NW' | 'NE' | 'SW' | 'SE'

export interface CornerDefinition {
  id: string
  quadrant: Quadrant
  coordinates: Point2D
  title: string
  description: string
  sliders: [string, string]
}

export interface SpecimenInstance {
  id: string
  x: number
  y: number
  weights: CornerWeights
}

export const IDW_EPSILON = 0.0001
export const TILE_SIZE = 80

export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  hatchSpacing: 5.5,
  strokeWeight: 1.1,
  chromaticShift: 4,
  spectralGain: 0.75,
  inkSpread: 2.2,
  paperSoak: 0.35,
  matrixSpacing: 6,
  dotGain: 1.2,
}

export const CORNERS: Record<CornerKey, CornerDefinition> = {
  w1: {
    id: 'etching',
    quadrant: 'NW',
    coordinates: { x: -1.0, y: 1.0 },
    title: 'Renaissance Etching',
    description: 'Intaglio cross-hatching and razor-sharp stroke contrast.',
    sliders: ['Hatch Density', 'Stroke Weight'],
  },
  w2: {
    id: 'caustic',
    quadrant: 'NE',
    coordinates: { x: 1.0, y: 1.0 },
    title: 'Prismatic Caustic',
    description: 'Horizontal red/cyan split across radial plate lines.',
    sliders: ['Chromatic Shift', 'Spectral Gain'],
  },
  w3: {
    id: 'bleed',
    quadrant: 'SW',
    coordinates: { x: -1.0, y: -1.0 },
    title: 'Woodblock Bleed',
    description: 'Radial ink pooling, capillary blur, and fibrous spread.',
    sliders: ['Ink Spread', 'Paper Soak'],
  },
  w4: {
    id: 'dither',
    quadrant: 'SE',
    coordinates: { x: 1.0, y: -1.0 },
    title: 'Halftone Dither',
    description: 'Bayer/halftone dot matrix across high-density regions.',
    sliders: ['Matrix Frequency', 'Dot Gain'],
  },
}

export const CORNER_ORDER: CornerKey[] = ['w1', 'w2', 'w3', 'w4']

export const CORNER_SETTING_KEYS: Record<CornerKey, [keyof RenderSettings, keyof RenderSettings]> = {
  w1: ['hatchSpacing', 'strokeWeight'],
  w2: ['chromaticShift', 'spectralGain'],
  w3: ['inkSpread', 'paperSoak'],
  w4: ['matrixSpacing', 'dotGain'],
}

const POLES: readonly Point2D[] = CORNER_ORDER.map((key) => CORNERS[key].coordinates)

export function clampCoordinates(point: Point2D): Point2D {
  return {
    x: Math.min(1, Math.max(-1, point.x)),
    y: Math.min(1, Math.max(-1, point.y)),
  }
}

export function calculateCornerWeights(point: Point2D): CornerWeights {
  const { x, y } = clampCoordinates(point)
  const inv = [0, 0, 0, 0]
  let total = 0
  for (let i = 0; i < 4; i++) {
    const c = POLES[i]
    const d = Math.hypot(x - c.x, y - c.y)
    const w = 1.0 / (d + IDW_EPSILON) ** 2
    inv[i] = w
    total += w
  }
  return {
    w1: inv[0] / total,
    w2: inv[1] / total,
    w3: inv[2] / total,
    w4: inv[3] / total,
  }
}

export const BALANCED_WEIGHTS = calculateCornerWeights({ x: 0, y: 0 })

export function pixelToNormalizedRect(
  px: number,
  py: number,
  width: number,
  height: number,
): Point2D {
  return clampCoordinates({
    x: (px / width) * 2 - 1,
    y: 1 - (py / height) * 2,
  })
}

export function normalizedToPixel(point: Point2D, width: number, height: number): Point2D {
  const { x, y } = clampCoordinates(point)
  return {
    x: ((x + 1) / 2) * width,
    y: ((1 - y) / 2) * height,
  }
}

export function createSpecimen(point: Point2D): SpecimenInstance {
  const coords = clampCoordinates(point)
  return {
    id: crypto.randomUUID(),
    x: coords.x,
    y: coords.y,
    weights: calculateCornerWeights(coords),
  }
}

export function relocateSpecimen(instance: SpecimenInstance, point: Point2D): SpecimenInstance {
  const coords = clampCoordinates(point)
  return {
    ...instance,
    x: coords.x,
    y: coords.y,
    weights: calculateCornerWeights(coords),
  }
}

export function formatAxis(n: number): string {
  const sign = n >= 0 ? '+' : '−'
  return `${sign}${Math.abs(n).toFixed(3)}`
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}
