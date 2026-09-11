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

export interface CornerDefinition {
  id: string
  coordinates: Point2D
  title: string
  sliders: [string, string]
}

export interface SpecimenInstance {
  id: string
  x: number
  y: number
  weights: CornerWeights
  size: number
}

export const IDW_EPSILON = 0.0001
export const TILE_SIZE = 72
export const HERO_SIZE = 160
export const D_MIN = 88
export const FIELD_CLAMP = 0.85
export const STATUS_BAR_H = 36

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
    coordinates: { x: -1.0, y: 1.0 },
    title: 'Renaissance Etching',
    sliders: ['Hatch Density', 'Stroke Weight'],
  },
  w2: {
    id: 'caustic',
    coordinates: { x: 1.0, y: 1.0 },
    title: 'Prismatic Caustic',
    sliders: ['Chromatic Shift', 'Spectral Gain'],
  },
  w3: {
    id: 'bleed',
    coordinates: { x: -1.0, y: -1.0 },
    title: 'Woodblock Bleed',
    sliders: ['Ink Spread', 'Paper Soak'],
  },
  w4: {
    id: 'dither',
    coordinates: { x: 1.0, y: -1.0 },
    title: 'Halftone Dither',
    sliders: ['Matrix Frequency', 'Dot Gain'],
  },
}

export const CORNER_ORDER: CornerKey[] = ['w1', 'w2', 'w3', 'w4']

const POLES: readonly Point2D[] = CORNER_ORDER.map((key) => CORNERS[key].coordinates)

export function calculateCornerWeights(point: Point2D): CornerWeights {
  const { x, y } = point
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

export function clampField(point: Point2D): Point2D {
  return {
    x: Math.max(-FIELD_CLAMP, Math.min(FIELD_CLAMP, point.x)),
    y: Math.max(-FIELD_CLAMP, Math.min(FIELD_CLAMP, point.y)),
  }
}

export function pixelToNormalizedRect(
  px: number,
  py: number,
  width: number,
  height: number,
): Point2D {
  return clampField({
    x: (px / width) * 2 - 1,
    y: 1 - (py / height) * 2,
  })
}

export function normalizedToPixelRect(
  point: Point2D,
  width: number,
  height: number,
): Point2D {
  return {
    x: ((point.x + 1) / 2) * width,
    y: ((1 - point.y) / 2) * height,
  }
}

export function instanceAtPoint(x: number, y: number): SpecimenInstance {
  const coords = clampField({ x, y })
  return {
    id: crypto.randomUUID(),
    x: coords.x,
    y: coords.y,
    weights: calculateCornerWeights(coords),
    size: TILE_SIZE,
  }
}

interface PixelObstacle {
  x: number
  y: number
  clearance: number
}

/**
 * Iterative radial push so the stamp center stays ≥ D_min from the hero
 * and every existing tile, then clamp into the [-0.85, 0.85] field.
 */
export function resolveClearance(
  px: number,
  py: number,
  plane: { width: number; height: number },
  obstacles: PixelObstacle[],
): Point2D {
  let x = px
  let y = py

  for (let iter = 0; iter < 28; iter++) {
    let moved = false
    for (const obs of obstacles) {
      let dx = x - obs.x
      let dy = y - obs.y
      let dist = Math.hypot(dx, dy)
      if (dist < 1e-4) {
        const ang = 0.7 + iter * 0.9
        dx = Math.cos(ang)
        dy = Math.sin(ang)
        dist = 0
      }
      if (dist < obs.clearance) {
        const nx = dx / (dist || 1)
        const ny = dy / (dist || 1)
        x = obs.x + nx * obs.clearance
        y = obs.y + ny * obs.clearance
        moved = true
      }
    }

    const clamped = clampField(pixelToNormalizedRect(x, y, plane.width, plane.height))
    const back = normalizedToPixelRect(clamped, plane.width, plane.height)
    if (Math.hypot(back.x - x, back.y - y) > 0.5) moved = true
    x = back.x
    y = back.y
    if (!moved) break
  }

  return clampField(pixelToNormalizedRect(x, y, plane.width, plane.height))
}

export function heroClearance(): number {
  return Math.max(D_MIN, (HERO_SIZE + TILE_SIZE) / 2 + 4)
}

export function tileClearance(): number {
  return D_MIN
}
