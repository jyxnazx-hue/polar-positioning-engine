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

export interface PoleParams {
  primary: number
  secondary: number
}

export type CornerKey = keyof CornerWeights
export type CornerParamMap = Record<CornerKey, PoleParams>

export interface CornerDefinition {
  id: string
  quadrant: string
  coordinates: Point2D
  title: string
  description: string
  dockLabel: string
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
export const TILE_SIZE = 90
export const HERO_SIZE = 260
export const COLLISION_PX = 95
export const STATUS_BAR_H = 36

export const DEFAULT_POLE_PARAMS: CornerParamMap = {
  w1: { primary: 0.72, secondary: 0.58 },
  w2: { primary: 0.66, secondary: 0.52 },
  w3: { primary: 0.6, secondary: 0.5 },
  w4: { primary: 0.55, secondary: 0.48 },
}

export const CORNERS: Record<CornerKey, CornerDefinition> = {
  w1: {
    id: 'etching',
    quadrant: 'NW',
    coordinates: { x: -1.0, y: 1.0 },
    title: 'Renaissance Etching',
    description: 'Intaglio cross-hatching & razor-sharp stroke contrast',
    dockLabel: 'NW // Renaissance Etching',
    sliders: ['Stroke density', 'Contrast'],
  },
  w2: {
    id: 'caustic',
    quadrant: 'NE',
    coordinates: { x: 1.0, y: 1.0 },
    title: 'Prismatic Caustic',
    description: 'Chromatic aberration — red/cyan split across radial lines',
    dockLabel: 'NE // Prismatic Caustic',
    sliders: ['Chromatic shift', 'Fringe gain'],
  },
  w3: {
    id: 'bleed',
    quadrant: 'SW',
    coordinates: { x: -1.0, y: -1.0 },
    title: 'Woodblock Bleed',
    description: 'Soft radial ink pooling, capillary blur & fibrous spread',
    dockLabel: 'SW // Woodblock Bleed',
    sliders: ['Ink pool', 'Fiber spread'],
  },
  w4: {
    id: 'dither',
    quadrant: 'SE',
    coordinates: { x: 1.0, y: -1.0 },
    title: 'Halftone Dither',
    description: 'Bayer / halftone dot matrix across high-density regions',
    dockLabel: 'SE // Halftone Dither',
    sliders: ['Screen frequency', 'Dot gain'],
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

export function clampCoordinates(point: Point2D): Point2D {
  return {
    x: Math.max(-1.0, Math.min(1.0, point.x)),
    y: Math.max(-1.0, Math.min(1.0, point.y)),
  }
}

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

export function instanceAtPoint(
  x: number,
  y: number,
  options?: { id?: string; size?: number },
): SpecimenInstance {
  const coords = clampCoordinates({ x, y })
  return {
    id: options?.id ?? crypto.randomUUID(),
    x: coords.x,
    y: coords.y,
    weights: calculateCornerWeights(coords),
    size: options?.size ?? TILE_SIZE,
  }
}

interface PixelObstacle {
  x: number
  y: number
  size: number
}

/** Radial push so a new tile stays clear of the hero and other instances. */
export function resolveCollisionPx(
  px: number,
  py: number,
  selfSize: number,
  plane: { width: number; height: number },
  obstacles: PixelObstacle[],
): Point2D {
  let x = px
  let y = py
  const half = selfSize / 2

  for (let iter = 0; iter < 18; iter++) {
    let moved = false
    for (const obs of obstacles) {
      const minDist = Math.max(COLLISION_PX, (obs.size + selfSize) / 2 + 4)
      let dx = x - obs.x
      let dy = y - obs.y
      let dist = Math.hypot(dx, dy)
      if (dist < 1e-4) {
        const ang = 0.785 + iter * 0.9
        dx = Math.cos(ang)
        dy = Math.sin(ang)
        dist = 0
      }
      if (dist < minDist) {
        const nx = dx / (dist || 1)
        const ny = dy / (dist || 1)
        x = obs.x + nx * minDist
        y = obs.y + ny * minDist
        moved = true
      }
    }
    x = Math.max(half + 8, Math.min(plane.width - half - 8, x))
    y = Math.max(half + 8, Math.min(plane.height - half - 8, y))
    if (!moved) break
  }

  return { x, y }
}
