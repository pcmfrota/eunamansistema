import { forgotPassword } from './actions'
import { Mail, AlertCircle, TrendingUp, ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string, success?: string }
}) {
  const isSuccess = searchParams?.success === 'true';

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
            Recuperação de Acesso
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-xl p-8 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900/60 transition-all duration-300">
          {isSuccess ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                <CheckCircle2 size={24} />
              </div>
              <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
                E-mail Enviado!
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha em instantes.
              </p>
              <Link 
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors pt-4"
              >
                <ArrowLeft size={16} /> Voltar para o Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-6 text-xl font-semibold text-zinc-800 dark:text-zinc-200 text-center">
                Recuperar Senha
              </h2>
              
              <form className="space-y-5">
                <div className="space-y-2">
                  <label 
                    htmlFor="email" 
                    className="text-sm font-medium leading-none text-zinc-700 dark:text-zinc-300"
                  >
                    E-mail da sua conta
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="seu-email@eunaman.com.br"
                      required
                      className="w-full rounded-xl border border-zinc-300 bg-white px-10 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                    />
                  </div>
                </div>

                {searchParams?.error && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                    <AlertCircle className="h-4 w-4" />
                    <span>{searchParams.error}</span>
                  </div>
                )}

                <button
                  formAction={forgotPassword}
                  className="group relative w-full overflow-hidden rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                >
                  <span className="relative z-10">Enviar Link de Recuperação</span>
                </button>

                <div className="pt-2 text-center">
                  <Link 
                    href="/login"
                    className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                  >
                    <ArrowLeft size={14} /> Voltar para o Login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
