'use client'

import { useCallback, useEffect, useState } from 'react'
import { getDashboardKmHorimetro } from '../actions'
import type { EquipamentoAtivo, LeituraBruta } from '@/lib/horimetro-km-calc'

export type DadosDashboard = {
  equipamentos: EquipamentoAtivo[]
  leituras: LeituraBruta[]
  rfAtual: { ano: number; mes: number; inicio: string; fim: string } | null
}

// Cache em memória por intervalo (o projeto não usa React Query/SWR). Vale enquanto a
// página está aberta; é descartado quando uma leitura nova é registrada ou o sync termina.
const TTL_MS = 5 * 60_000
const cache = new Map<string, { em: number; dados: DadosDashboard }>()

/** Frotas ativas + leituras entre `desde` e `fim` (busca no banco, com cache). */
export function useLeiturasDashboard(desde: string, fim: string, ativo: boolean) {
  const chave = `${desde}|${fim}`
  const [dados, setDados] = useState<DadosDashboard | null>(() => cache.get(chave)?.dados ?? null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)

  const recarregar = useCallback(() => { cache.clear(); setVersao(v => v + 1) }, [])

  useEffect(() => {
    const invalida = () => recarregar()
    window.addEventListener('horimetro-leitura-registrada', invalida)
    window.addEventListener('offline-sync-completed', invalida)
    return () => {
      window.removeEventListener('horimetro-leitura-registrada', invalida)
      window.removeEventListener('offline-sync-completed', invalida)
    }
  }, [recarregar])

  useEffect(() => {
    if (!ativo) return
    let vivo = true
    const emCache = cache.get(chave)
    if (emCache && Date.now() - emCache.em < TTL_MS) { setDados(emCache.dados); setErro(null); return }
    setCarregando(true)
    setErro(null)
    getDashboardKmHorimetro(desde, fim)
      .then(res => {
        if (!vivo) return
        if ('error' in res) { setErro(res.error); return }
        cache.set(chave, { em: Date.now(), dados: res })
        setDados(res)
      })
      .catch(e => { if (vivo) setErro(e instanceof Error ? e.message : 'Falha ao carregar as leituras.') })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [chave, desde, fim, ativo, versao])

  return { dados, carregando, erro, recarregar }
}
