import { useEffect } from 'react'
import { SpecimenCanvas } from './SpecimenCanvas'
import type { RenderSettings, SpecimenInstance } from '../utils/polarMath'
import { INSPECT_SIZE, formatCoordBadge } from '../utils/polarMath'
import { plateToSvg, renderPlateToPngBlob } from '../utils/renderPlate'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function InspectionModal({
  instance,
  settings,
  onClose,
}: {
  instance: SpecimenInstance
  settings: RenderSettings
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const exportBoth = async () => {
    const slug = `specimen_${instance.col}_${instance.row}`
    const png = await renderPlateToPngBlob(INSPECT_SIZE, instance.weights, settings)
    downloadBlob(png, `${slug}.png`)
    await new Promise((resolve) => window.setTimeout(resolve, 80))
    const svg = plateToSvg(INSPECT_SIZE, instance.weights, settings)
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${slug}.svg`)
  }

  const { w1, w2, w3, w4 } = instance.weights

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-md"
      onPointerDown={onClose}
    >
      <div
        className="my-auto w-max max-w-[calc(100vw-2rem)] rounded-3xl border border-[#222634] bg-[#0D0E13]/95 p-6 shadow-2xl backdrop-blur-md"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 font-mono text-[11px] tracking-[0.14em] text-neutral-400">
          Inspection · {formatCoordBadge(instance)}
        </div>
        <div
          className="overflow-hidden rounded-xl border border-[#222634] bg-[#0E1015]"
          style={{ width: INSPECT_SIZE, height: INSPECT_SIZE, maxWidth: '100%' }}
        >
          <SpecimenCanvas weights={instance.weights} size={INSPECT_SIZE} settings={settings} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
          <span>Etch {w1.toFixed(3)}</span>
          <span>Caustic {w2.toFixed(3)}</span>
          <span>Bleed {w3.toFixed(3)}</span>
          <span>Dither {w4.toFixed(3)}</span>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#222634] bg-[#12141A] px-4 py-1.5 font-mono text-xs text-neutral-200 transition-colors hover:border-white/20 hover:text-white"
          >
            ( Close )
          </button>
          <button
            type="button"
            onClick={() => void exportBoth()}
            className="rounded-full bg-white px-4 py-1.5 font-mono text-xs font-medium text-black transition-transform hover:scale-[1.03]"
          >
            ( Export SVG / PNG )
          </button>
        </div>
      </div>
    </div>
  )
}
