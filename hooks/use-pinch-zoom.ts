'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

export interface PinchZoomTransform {
  scale: number
  x: number
  y: number
}

interface UsePinchZoomOptions {
  // Zoom máximo permitido (1 = tamanho normal). Padrão: 4x.
  maxScale?: number
  // Disparado quando o gesto foi um toque simples (sem arrastar, sem pinça) com o conteúdo
  // ainda no zoom normal — usado pra fechar um lightbox ao tocar fora da imagem, por exemplo.
  // Enquanto ampliado (scale > 1), um toque de um dedo é sempre tratado como arrastar, nunca
  // como toque simples, então isso não dispara por engano ao mover a foto ampliada.
  onTap?: () => void
}

// Zoom por pinça (dois dedos) + arrastar (um dedo, só quando já ampliado) — usado tanto na
// pré-visualização da ficha quanto na foto ampliada (lightbox) do FichaPreviewModal. Usa
// addEventListener nativo com { passive: false } em vez de onTouchMove do React: um listener
// passivo (o padrão) não deixa chamar preventDefault(), e sem isso o gesto de pinça vazava
// pro scroll/zoom nativo da página por baixo.
export function usePinchZoom(ref: RefObject<HTMLElement | null>, options?: UsePinchZoomOptions) {
  const maxScale = options?.maxScale ?? 4
  const onTap = options?.onTap
  const [transform, setTransform] = useState<PinchZoomTransform>({ scale: 1, x: 0, y: 0 })
  const stateRef = useRef({
    scale: 1,
    x: 0,
    y: 0,
    mode: null as 'pinch' | 'pan' | null,
    pinchStartDist: 0,
    pinchStartScale: 1,
    panStartX: 0,
    panStartY: 0,
    panOriginX: 0,
    panOriginY: 0,
    tapStartX: 0,
    tapStartY: 0,
    moveu: false,
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const distancia = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

    const onStart = (e: TouchEvent) => {
      const s = stateRef.current
      s.moveu = false
      if (e.touches.length === 2) {
        s.mode = 'pinch'
        s.pinchStartDist = distancia(e.touches)
        s.pinchStartScale = s.scale
      } else if (e.touches.length === 1) {
        s.tapStartX = e.touches[0].clientX
        s.tapStartY = e.touches[0].clientY
        if (s.scale > 1.01) {
          s.mode = 'pan'
          s.panStartX = e.touches[0].clientX
          s.panStartY = e.touches[0].clientY
          s.panOriginX = s.x
          s.panOriginY = s.y
        }
      }
    }

    const onMove = (e: TouchEvent) => {
      const s = stateRef.current
      if (s.mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault()
        const nova = Math.min(maxScale, Math.max(1, s.pinchStartScale * (distancia(e.touches) / s.pinchStartDist)))
        s.scale = nova
        if (nova <= 1.01) {
          s.scale = 1
          s.x = 0
          s.y = 0
        }
        setTransform({ scale: s.scale, x: s.x, y: s.y })
      } else if (s.mode === 'pan' && e.touches.length === 1) {
        e.preventDefault()
        s.x = s.panOriginX + (e.touches[0].clientX - s.panStartX)
        s.y = s.panOriginY + (e.touches[0].clientY - s.panStartY)
        setTransform({ scale: s.scale, x: s.x, y: s.y })
      } else if (!s.mode && e.touches.length === 1) {
        const dx = e.touches[0].clientX - s.tapStartX
        const dy = e.touches[0].clientY - s.tapStartY
        if (Math.hypot(dx, dy) > 10) s.moveu = true
      }
    }

    const onEnd = (e: TouchEvent) => {
      const s = stateRef.current
      const eraTapSimples = !s.mode && !s.moveu && s.scale <= 1.01
      if (e.touches.length < 2 && s.mode === 'pinch') s.mode = null
      if (e.touches.length < 1 && s.mode === 'pan') s.mode = null
      if (e.touches.length === 0 && eraTapSimples) onTap?.()
    }

    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: false })
    el.addEventListener('touchcancel', onEnd, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [ref, maxScale, onTap])

  const reset = () => {
    stateRef.current.scale = 1
    stateRef.current.x = 0
    stateRef.current.y = 0
    stateRef.current.mode = null
    setTransform({ scale: 1, x: 0, y: 0 })
  }

  return { transform, reset, estaAmpliado: transform.scale > 1.01 }
}
