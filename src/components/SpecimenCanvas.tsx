import { useEffect, useRef } from 'react'
import type { CornerWeights, RenderSettings } from '../utils/polarMath'
import { renderPlate } from '../utils/renderPlate'

interface SpecimenCanvasProps {
  weights: CornerWeights
  size: number
  settings: RenderSettings
}

export function SpecimenCanvas({ weights, size, settings }: SpecimenCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.filter = 'none'
    renderPlate(ctx, size, weights, settings)
  }, [weights, size, settings])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="pointer-events-none block"
    />
  )
}
