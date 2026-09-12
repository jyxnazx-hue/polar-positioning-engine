import { useState, type Dispatch, type SetStateAction } from 'react'
import type { CornerKey, RenderSettings } from '../utils/polarMath'
import { CORNERS } from '../utils/polarMath'
import { tuneCornerWithHuggingFace } from '../services/aiTuner'

export function CornerPopover({
  corner,
  settings,
  onSettings,
}: {
  corner: CornerKey
  settings: RenderSettings
  onSettings: Dispatch<SetStateAction<RenderSettings>>
}) {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const fields =
    corner === 'w1'
      ? ([
          { key: 'hatchSpacing', label: CORNERS.w1.sliders[0], min: 4, max: 18, step: 0.5, invert: true },
          { key: 'strokeWeight', label: CORNERS.w1.sliders[1], min: 0.5, max: 2.5, step: 0.05, invert: false },
        ] as const)
      : corner === 'w2'
        ? ([
            { key: 'chromaticShift', label: CORNERS.w2.sliders[0], min: 2, max: 6, step: 0.1, invert: false },
            { key: 'spectralGain', label: CORNERS.w2.sliders[1], min: 0.2, max: 1, step: 0.01, invert: false },
          ] as const)
        : corner === 'w3'
          ? ([
              { key: 'inkSpread', label: CORNERS.w3.sliders[0], min: 1, max: 3, step: 0.05, invert: false },
              { key: 'paperSoak', label: CORNERS.w3.sliders[1], min: 0.15, max: 0.7, step: 0.01, invert: false },
            ] as const)
          : ([
              { key: 'matrixSpacing', label: CORNERS.w4.sliders[0], min: 5, max: 12, step: 0.1, invert: true },
              { key: 'dotGain', label: CORNERS.w4.sliders[1], min: 0.8, max: 1.8, step: 0.05, invert: false },
            ] as const)

  const runTune = async () => {
    setBusy(true)
    setNote(null)
    try {
      const result = await tuneCornerWithHuggingFace(corner, prompt, settings)
      if (Object.keys(result.patch).length) {
        onSettings((prev) => ({ ...prev, ...result.patch }))
      }
      setNote(result.note)
    } catch {
      setNote('Tune failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mb-3 font-mono text-[11px] tracking-[0.14em] text-neutral-300">{CORNERS[corner].title}</div>
      {fields.map((field) => (
        <label key={field.key} className="mb-3 block">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-neutral-500">
            <span>{field.label}</span>
            <span className="tabular-nums text-neutral-300">{settings[field.key].toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={settings[field.key]}
            className="pole-slider w-full"
            style={field.invert ? { direction: 'rtl' } : undefined}
            onChange={(event) => {
              const value = Number(event.target.value)
              onSettings((prev) => ({ ...prev, [field.key]: value }))
            }}
          />
        </label>
      ))}
      <div className="mt-1 border-t border-[#222634] pt-3">
        <div className="mb-1.5 font-mono text-[10px] tracking-[0.12em] text-neutral-500">AI Prompt</div>
        <input
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void runTune()
            }
          }}
          placeholder="denser hatch, thicker stroke…"
          className="mb-2 w-full rounded-lg border border-[#222634] bg-[#0E1015] px-2.5 py-1.5 font-mono text-[11px] text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-white/25"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void runTune()}
          className="rounded-full bg-white px-3 py-1 font-mono text-[11px] font-medium text-black transition-transform hover:scale-[1.03] disabled:opacity-50"
        >
          {busy ? 'Tuning…' : 'Tune with AI'}
        </button>
        {note && <p className="mt-2 font-mono text-[10px] leading-snug text-neutral-500">{note}</p>}
      </div>
    </>
  )
}
