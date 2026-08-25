'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, AlertCircle, TrendingUp, Save, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

type Status = 'checking' | 'ready' | 'invalid'

export default function ResetPasswordClient() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // O link de redefinição do Supabase entrega o token na própria URL (fragmento #...),
  // que só o navegador enxerga — o servidor nunca recebe essa parte. Por isso a detecção
  // da sessão de recuperação precisa acontecer aqui no cliente, ouvindo o evento
  // PASSWORD_RECOVERY do próprio SDK (que já processa esse fragmento automaticamente).
  useEffect(() => {
    const supabase = createClient()
    let resolved = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any) => {
      if (event === 'PASSWORD_RECOVERY') {
        resolved = true
        setStatus('ready')
      }
    })

    // Se o evento já tiver disparado antes deste listener montar, uma sessão válida
    // já deve estar disponível — cobre esse caso também.
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session && !resolved) {
        resolved = true
        setStatus('ready')
      }
    })

    const timeout = setTimeout(() => {
      if (!resolved) setStatus('invalid')
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => router.replace('/login?message=Senha atualizada com sucesso'), 1800)
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-zinc-50 dark:bg-black p-4 items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="absolute top-[-10%] h-[50rem] w-[50rem] rounded-full bg-blue-500/10 blur-[120px] dark:bg-blue-600/10" />
      </div>

      <div className="z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center justify-center space-y-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl mb-4">
            <TrendingUp size={32} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            EUNAMAN
          </h1>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Redefinição de Senha
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-xl p-8 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900/60 transition-all duration-300">
          {status === 'checking' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Verificando o link de redefinição...</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                <AlertCircle size={24} />
              </div>
              <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Link inválido ou expirado</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Solicite um novo link de redefinição de senha e abra o e-mail mais recente.
              </p>
              <a href="/login/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500 pt-2">
                Solicitar novo link
              </a>
            </div>
          )}

          {status === 'ready' && (
            success ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={24} />
                </div>
                <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Senha atualizada!</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Redirecionando para o login...</p>
              </div>
            ) : (
              <>
                <h2 className="mb-6 text-xl font-semibold text-zinc-800 dark:text-zinc-200 text-center">
                  Defina sua nova senha
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium leading-none text-zinc-700 dark:text-zinc-300">
                      Nova Senha
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                      <input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        minLength={6}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white px-10 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-sm font-medium leading-none text-zinc-700 dark:text-zinc-300">
                      Confirme a Nova Senha
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                      <input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white px-10 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                      <AlertCircle className="h-4 w-4" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full overflow-hidden rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 disabled:opacity-60"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      {loading ? "Salvando..." : "Salvar Nova Senha"}
                    </span>
                  </button>
                </form>
              </>
            )
          )}
        </div>
      </div>
    </div>
  )
}
