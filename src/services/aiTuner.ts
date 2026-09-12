import type { CornerKey, RenderSettings } from '../utils/polarMath'
import { CORNER_SETTING_KEYS, SETTING_BOUNDS, clampSetting } from '../utils/polarMath'

export interface TuneResult {
  patch: Partial<RenderSettings>
  source: 'huggingface' | 'local'
  note: string
}

function lerpToward(value: number, target: number, amount: number): number {
  return value + (target - value) * amount
}

function nudge(key: keyof RenderSettings, current: number, direction: 1 | -1, intensity = 0.28): number {
  const { min, max } = SETTING_BOUNDS[key]
  const target = direction > 0 ? max : min
  return clampSetting(key, lerpToward(current, target, intensity))
}

function extractNumber(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:=]?\\s*(-?\\d+(?:\\.\\d+)?)`, 'i')
    const match = text.match(re)
    if (match) return Number(match[1])
  }
  return null
}

function intensityFrom(prompt: string): number {
  if (/\b(max|maximum|extreme|fully|very)\b/.test(prompt)) return 0.72
  if (/\b(slightly|a bit|subtle|gently)\b/.test(prompt)) return 0.14
  if (/\b(more|less|increase|decrease)\b/.test(prompt)) return 0.38
  return 0.28
}

export function localSemanticTune(
  corner: CornerKey,
  prompt: string,
  current: RenderSettings,
): Partial<RenderSettings> {
  const p = prompt.toLowerCase()
  const intensity = intensityFrom(p)
  const patch: Partial<RenderSettings> = {}
  const [k1, k2] = CORNER_SETTING_KEYS[corner]

  const num1 = extractNumber(prompt, [k1, 'first', 'density', 'shift', 'spread', 'frequency', 'hatch', 'chromatic', 'ink', 'matrix'])
  const num2 = extractNumber(prompt, [k2, 'second', 'weight', 'gain', 'soak', 'stroke', 'spectral', 'paper', 'dot'])

  if (num1 !== null && Number.isFinite(num1)) patch[k1] = clampSetting(k1, num1)
  if (num2 !== null && Number.isFinite(num2)) patch[k2] = clampSetting(k2, num2)

  const denser = /\b(denser|tighter|finer|more hatch|high density|more lines|crisper hatch)\b/.test(p)
  const sparser = /\b(sparser|looser|coarser|open|fewer lines|less hatch)\b/.test(p)
  const heavier = /\b(heavier|thicker|bolder|bold|stronger stroke|dilate|fatter)\b/.test(p)
  const lighter = /\b(lighter|thinner|delicate|hairline|fine line|weaker stroke)\b/.test(p)
  const moreShift = /\b(more (?:shift|chroma|chromatic|prism|caustic|offset|aberration)|wider|split)\b/.test(p)
  const lessShift = /\b(less (?:shift|chroma|chromatic|offset)|aligned|register|tighter channels)\b/.test(p)
  const moreGain = /\b(vivid|brighter|hotter|more gain|punchy|saturated)\b/.test(p)
  const lessGain = /\b(duller|dimmer|less gain|muted|softer glow)\b/.test(p)
  const wetter = /\b(wetter|soaked|bleed|wash|sumi|more soak|more ink)\b/.test(p)
  const drier = /\b(drier|dry|less soak|less ink|crisp wash)\b/.test(p)
  const finerMatrix = /\b(finer (?:dots|screen|matrix|halftone)|higher frequency|more dots)\b/.test(p)
  const coarserMatrix = /\b(coarser (?:dots|screen|matrix|halftone)|lower frequency|fewer dots)\b/.test(p)
  const moreDot = /\b(larger dots|more gain|heavier dots|dot gain)\b/.test(p)
  const lessDot = /\b(smaller dots|less gain|pinpoint|tiny dots)\b/.test(p)

  if (corner === 'w1') {
    if (denser) patch.hatchSpacing = nudge('hatchSpacing', current.hatchSpacing, -1, intensity)
    if (sparser) patch.hatchSpacing = nudge('hatchSpacing', current.hatchSpacing, 1, intensity)
    if (heavier) patch.strokeWeight = nudge('strokeWeight', current.strokeWeight, 1, intensity)
    if (lighter) patch.strokeWeight = nudge('strokeWeight', current.strokeWeight, -1, intensity)
  }
  if (corner === 'w2') {
    if (moreShift) patch.chromaticShift = nudge('chromaticShift', current.chromaticShift, 1, intensity)
    if (lessShift) patch.chromaticShift = nudge('chromaticShift', current.chromaticShift, -1, intensity)
    if (moreGain) patch.spectralGain = nudge('spectralGain', current.spectralGain, 1, intensity)
    if (lessGain) patch.spectralGain = nudge('spectralGain', current.spectralGain, -1, intensity)
  }
  if (corner === 'w3') {
    if (heavier || wetter) patch.inkSpread = nudge('inkSpread', current.inkSpread, 1, intensity)
    if (lighter || drier) patch.inkSpread = nudge('inkSpread', current.inkSpread, -1, intensity)
    if (wetter) patch.paperSoak = nudge('paperSoak', current.paperSoak, 1, intensity)
    if (drier) patch.paperSoak = nudge('paperSoak', current.paperSoak, -1, intensity)
  }
  if (corner === 'w4') {
    if (finerMatrix || denser) patch.matrixSpacing = nudge('matrixSpacing', current.matrixSpacing, -1, intensity)
    if (coarserMatrix || sparser) patch.matrixSpacing = nudge('matrixSpacing', current.matrixSpacing, 1, intensity)
    if (moreDot || heavier) patch.dotGain = nudge('dotGain', current.dotGain, 1, intensity)
    if (lessDot || lighter) patch.dotGain = nudge('dotGain', current.dotGain, -1, intensity)
  }

  if (Object.keys(patch).length === 0) {
    patch[k1] = nudge(k1, current[k1], /\b(less|reduce|decrease|lower)\b/.test(p) ? -1 : 1, 0.2)
    patch[k2] = nudge(k2, current[k2], /\b(less|reduce|decrease|lower)\b/.test(p) ? -1 : 1, 0.16)
  }

  return patch
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/\{[\s\S]*\}/)
  if (!fenced) return null
  try {
    const parsed = JSON.parse(fenced[0]) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return null
  }
  return null
}

function patchFromModelJson(data: Record<string, unknown>, corner: CornerKey): Partial<RenderSettings> {
  const keys = CORNER_SETTING_KEYS[corner]
  const patch: Partial<RenderSettings> = {}
  for (const key of keys) {
    const raw = data[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      patch[key] = clampSetting(key, raw)
    }
  }
  return patch
}

async function callHuggingFace(
  corner: CornerKey,
  prompt: string,
  current: RenderSettings,
): Promise<Partial<RenderSettings> | null> {
  const token = import.meta.env.VITE_HF_TOKEN
  if (!token) return null

  const [k1, k2] = CORNER_SETTING_KEYS[corner]
  const body = {
    model: 'HuggingFaceTB/SmolLM3-3B:hf-inference',
    messages: [
      {
        role: 'system',
        content:
          'You tune print-style rendering parameters. Reply with JSON only, no markdown. Keys must be exactly the two parameter names given.',
      },
      {
        role: 'user',
        content: `Corner ${corner}. Current ${k1}=${current[k1]}, ${k2}=${current[k2]}. Bounds ${k1}: ${SETTING_BOUNDS[k1].min}-${SETTING_BOUNDS[k1].max}, ${k2}: ${SETTING_BOUNDS[k2].min}-${SETTING_BOUNDS[k2].max}. Instruction: ${prompt}`,
      },
    ],
    max_tokens: 160,
    temperature: 0.2,
  }

  const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Hugging Face HTTP ${response.status}`)
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) return null
  const json = parseJsonObject(content)
  if (!json) return null
  const patch = patchFromModelJson(json, corner)
  return Object.keys(patch).length ? patch : null
}

export async function tuneCornerWithHuggingFace(
  corner: CornerKey,
  prompt: string,
  current: RenderSettings,
): Promise<TuneResult> {
  const trimmed = prompt.trim()
  if (!trimmed) {
    return {
      patch: {},
      source: 'local',
      note: 'Empty prompt — no changes.',
    }
  }

  try {
    const remote = await callHuggingFace(corner, trimmed, current)
    if (remote && Object.keys(remote).length) {
      return {
        patch: remote,
        source: 'huggingface',
        note: 'Applied Hugging Face parameters.',
      }
    }
  } catch {
    // Fall through to the local semantic engine.
  }

  return {
    patch: localSemanticTune(corner, trimmed, current),
    source: 'local',
    note: import.meta.env.VITE_HF_TOKEN
      ? 'Hugging Face unavailable — local semantic engine applied.'
      : 'Local semantic engine applied.',
  }
}
