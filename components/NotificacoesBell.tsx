'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useAuth } from './auth-context'
import { cn } from '@/lib/utils'
import { getMinhasNotificacoes, marcarNotificacaoLida, marcarTodasNotificacoesLidas } from '@/app/notificacoes/actions'

type Notificacao = {
  id: string
  tipo: string
  titulo: string
  mensagem: string | null
  link: string | null
  lida: boolean
  criado_em: string
}

// Sino de notificações in-app — hoje só usado pelo Controle de OS pra avisar admin e
// supervisor_manutencao assim que uma OS lançada/editada por mecânico entra pendente de
// validação, mas genérico o bastante pra outros módulos reaproveitarem depois.
export default function NotificacoesBell() {
  const { profile } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const wrapperRef = useRef<HTMLDivElement>(null)

  const podeReceber = profile?.role === 'admin' || profile?.role === 'supervisor_manutencao'

  const carregar = async () => {
    const res: any = await getMinhasNotificacoes(20)
    if (!res.error) setNotificacoes(res.data || [])
  }

  useEffect(() => {
    if (!podeReceber) return
    carregar()
    const interval = setInterval(carregar, 60000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeReceber])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!podeReceber) return null

  const naoLidas = notificacoes.filter(n => !n.lida).length

  const abrirNotificacao = async (n: Notificacao) => {
    if (!n.lida) {
      await marcarNotificacaoLida(n.id)
      setNotificacoes(prev => prev.map(x => (x.id === n.id ? { ...x, lida: true } : x)))
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <div className="relative shrink-0" ref={wrapperRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-zinc-500 dark:text-zinc-300"
        title="Notificações"
      >
        <Bell size={18} />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[9px] font-black">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[200]">
          <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-950">
            <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Notificações</span>
            {naoLidas > 0 && (
              <button
                onClick={async () => {
                  await marcarTodasNotificacoesLidas()
                  setNotificacoes(prev => prev.map(x => ({ ...x, lida: true })))
                }}
                className="text-[10px] font-bold text-blue-600 hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          {notificacoes.length === 0 ? (
            <p className="p-6 text-center text-xs text-zinc-400">Nenhuma notificação.</p>
          ) : (
            <div className="divide-y divide-zinc-50 dark:divide-zinc-900">
              {notificacoes.map(n => (
                <button
                  key={n.id}
                  onClick={() => abrirNotificacao(n)}
                  className={cn(
                    'w-full text-left p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors',
                    !n.lida && 'bg-amber-50/50 dark:bg-amber-950/10'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.lida && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{n.titulo}</p>
                      {n.mensagem && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{n.mensagem}</p>}
                      <p className="text-[9px] text-zinc-400 mt-1">{new Date(n.criado_em).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
