import type { CornerKey, RenderSettings } from '../utils/polarMath'
import { CORNER_SETTING_KEYS, CORNERS } from '../utils/polarMath'

const HF_URL =
  'https://api-inference.huggingface.co/models/Qwen/Qwen2.5-Coder-32B-Instruct/v1/chat/completions'

function clamp01(n: number): number {
  return Math.max(0.1, Math.min(1, n))
}

const RANGES: Record<keyof RenderSettings, [number, number, boolean]> = {
  hatchSpacing: [4, 18, true],
  strokeWeight: [0.5, 2.5, false],
  chromaticShift: [2, 6, false],
  spectralGain: [0.2, 1, false],
  inkSpread: [1, 3, false],
  paperSoak: [0.15, 0.7, false],
  matrixSpacing: [5, 12, true],
  dotGain: [0.8, 1.8, false],
}

function unitToValue(key: keyof RenderSettings, t: number): number {
  const [min, max, invert] = RANGES[key]
  const u = (clamp01(t) - 0.1) / 0.9
  return invert ? max + (min - max) * u : min + (max - min) * u
}

function localParamPair(prompt: string): { param1: number; param2: number } {
  const t = prompt.toLowerCase()
  let param1 = 0.55
  let param2 = 0.5
  if (/\b(heavy|more|dense|strong|thick|boost)\b/.test(t)) {
    param1 = 0.88
    param2 = 0.82
  }
  if (/\b(less|soft|light|thin|subtle|reduce)\b/.test(t)) {
    param1 = 0.28
    param2 = 0.3
  }
  if (/\b(sharp|crisp|razor|etch)\b/.test(t)) param2 = 0.9
  if (/\b(bleed|ink|wash|sumi)\b/.test(t)) param1 = 0.86
  if (/\b(split|chroma|prism|rgb)\b/.test(t)) param1 = 0.84
  if (/\b(grain|dither|halftone|dot)\b/.test(t)) param1 = 0.8
  return { param1, param2 }
}

function parsePair(text: string): { param1: number; param2: number } | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as { param1?: unknown; param2?: unknown }
    if (typeof parsed.param1 !== 'number' || typeof parsed.param2 !== 'number') return null
    return { param1: clamp01(parsed.param1), param2: clamp01(parsed.param2) }
  } catch {
    return null
  }
}

async function queryHuggingFace(cornerName: string, prompt: string): Promise<{ param1: number; param2: number } | null> {
  const token = import.meta.env.VITE_HF_TOKEN
  if (!token) return null

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 12000)

  try {
    const res = await fetch(HF_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
        max_tokens: 80,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Return only JSON: {"param1": number, "param2": number} with values between 0.1 and 1.0. No markdown.',
          },
          {
            role: 'user',
            content: `Aesthetic corner "${cornerName}". Request: ${prompt}. Map the request onto two intensity knobs param1 and param2 (0.1–1.0).`,
          },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return parsePair(data.choices?.[0]?.message?.content ?? '')
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

export function applyCornerParams(
  settings: RenderSettings,
  corner: CornerKey,
  param1: number,
  param2: number,
): RenderSettings {
  const [k1, k2] = CORNER_SETTING_KEYS[corner]
  return {
    ...settings,
    [k1]: unitToValue(k1, param1),
    [k2]: unitToValue(k2, param2),
  }
}

/** Live HF chat completions when VITE_HF_TOKEN is set; local semantic pair otherwise. */
export async function tuneCornerWithHuggingFace(
  cornerName: string,
  prompt: string,
): Promise<{ param1: number; param2: number }> {
  const remote = await queryHuggingFace(cornerName, prompt)
  return remote ?? localParamPair(prompt)
}

export function cornerKeyFromName(name: string): CornerKey {
  const found = (Object.keys(CORNERS) as CornerKey[]).find((key) => CORNERS[key].title === name)
  return found ?? 'w1'
}
