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

export interface CellCoord {
  col: number
  row: number
}

export interface SpecimenInstance {
  id: string
  col: number
  row: number
  x: number
  y: number
  weights: CornerWeights
  size: number
}

export const IDW_EPSILON = 0.0001
export const TILE_SIZE = 72
export const HERO_SIZE = 160
export const INSPECT_SIZE = 480
export const CELL_SPACING = 84
export const GRID_COLS = 7
export const GRID_ROWS = 5
export const COL_MIN = -3
export const COL_MAX = 3
export const ROW_MIN = -2
export const ROW_MAX = 2
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

export const SETTING_BOUNDS: Record<keyof RenderSettings, { min: number; max: number }> = {
  hatchSpacing: { min: 4, max: 18 },
  strokeWeight: { min: 0.5, max: 2.5 },
  chromaticShift: { min: 2, max: 6 },
  spectralGain: { min: 0.2, max: 1 },
  inkSpread: { min: 1, max: 3 },
  paperSoak: { min: 0.15, max: 0.7 },
  matrixSpacing: { min: 5, max: 12 },
  dotGain: { min: 0.8, max: 1.8 },
}

export const CORNER_SETTING_KEYS: Record<CornerKey, [keyof RenderSettings, keyof RenderSettings]> = {
  w1: ['hatchSpacing', 'strokeWeight'],
  w2: ['chromaticShift', 'spectralGain'],
  w3: ['inkSpread', 'paperSoak'],
  w4: ['matrixSpacing', 'dotGain'],
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

export function clampSetting(key: keyof RenderSettings, value: number): number {
  const { min, max } = SETTING_BOUNDS[key]
  return Math.min(max, Math.max(min, value))
}

/** Screen-down row → field Y up. Col/row span the unit square at the grid extremes. */
export function cellToField(col: number, row: number): Point2D {
  return {
    x: col / COL_MAX,
    y: -row / ROW_MAX,
  }
}

export function cellCenterPixel(
  col: number,
  row: number,
  width: number,
  height: number,
): Point2D {
  return {
    x: width / 2 + col * CELL_SPACING,
    y: height / 2 + row * CELL_SPACING,
  }
}

export function pixelToNearestCell(px: number, py: number, width: number, height: number): CellCoord {
  const col = Math.round((px - width / 2) / CELL_SPACING)
  const row = Math.round((py - height / 2) / CELL_SPACING)
  return {
    col: Math.max(COL_MIN, Math.min(COL_MAX, col)),
    row: Math.max(ROW_MIN, Math.min(ROW_MAX, row)),
  }
}

export function cellOverlapsHero(col: number, row: number): boolean {
  if (col === 0 && row === 0) return true
  const tileHalf = TILE_SIZE / 2
  const heroHalf = HERO_SIZE / 2
  const cx = col * CELL_SPACING
  const cy = row * CELL_SPACING
  return (
    cx - tileHalf < heroHalf &&
    cx + tileHalf > -heroHalf &&
    cy - tileHalf < heroHalf &&
    cy + tileHalf > -heroHalf
  )
}

export function cellKey(col: number, row: number): string {
  return `${col}:${row}`
}

export function instanceAtCell(col: number, row: number): SpecimenInstance {
  const coords = cellToField(col, row)
  return {
    id: crypto.randomUUID(),
    col,
    row,
    x: coords.x,
    y: coords.y,
    weights: calculateCornerWeights(coords),
    size: TILE_SIZE,
  }
}

export function formatAxis(n: number): string {
  const sign = n >= 0 ? '+' : '−'
  return `${sign}${Math.abs(n).toFixed(3)}`
}

export function formatCoordBadge(point: Point2D): string {
  return `[ X: ${formatAxis(point.x)} | Y: ${formatAxis(point.y)} ]`
}
