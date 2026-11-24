'use client'

import { useCallback, useEffect, useState } from 'react'
import { buscarDadosDashboard, type DadosDashboard } from './buscarDados'

export type { DadosDashboard } from './buscarDados'

// Cache em memória por intervalo (o projeto não usa React Query/SWR). Vale enquanto a
// página está aberta; é descartado quando uma leitura nova é registrada ou o sync termina.
const TTL_MS = 5 * 60_000
const cache = new Map<string, { em: number; dados: DadosDashboard }>()
// Busca em andamento por intervalo: duas telas pedindo o mesmo intervalo dividem a mesma consulta.
const emAndamento = new Map<string, Promise<DadosDashboard>>()

function buscar(desde: string, fim: string): Promise<DadosDashboard> {
  const chave = `${desde}|${fim}`
  const ja = emAndamento.get(chave)
  if (ja) return ja
  const p = buscarDadosDashboard(desde, fim)
    .then(d => { cache.set(chave, { em: Date.now(), dados: d }); return d })
    .finally(() => emAndamento.delete(chave))
  emAndamento.set(chave, p)
  return p
}

/**
 * Frotas ativas + leituras entre `desde` e `fim` (com cache). Enquanto um intervalo novo carrega,
 * mantém os dados anteriores na tela (`carregando` = true) em vez de voltar pro esqueleto.
 */
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
    if (emCache && Date.now() - emCache.em < TTL_MS) {
      setDados(emCache.dados); setErro(null); setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    buscar(desde, fim)
      .then(res => { if (vivo) setDados(res) })
      .catch(e => { if (vivo) setErro(e instanceof Error ? e.message : 'Falha ao carregar as leituras.') })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [chave, desde, fim, ativo, versao])

  return { dados, carregando, erro, recarregar }
}
