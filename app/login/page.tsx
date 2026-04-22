"use client";

import { login } from './actions'
import { KeyRound, Mail, AlertCircle, TrendingUp, Loader2 } from 'lucide-react'
import { useFormStatus } from 'react-dom'

// Renderizamos aqui a UI Premium para Login
export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-zinc-50 dark:bg-black p-4 items-center justify-center overflow-hidden">
      {/* Decorações do Fundo com degradês interativos - "Vibrant premium feeling" */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="absolute top-[-10%] h-[50rem] w-[50rem] rounded-full bg-blue-500/10 blur-[120px] dark:bg-blue-600/10" />
        <div className="absolute right-[-10%] top-[20%] h-[35rem] w-[35rem] rounded-full bg-indigo-500/10 blur-[100px] dark:bg-purple-600/10" />
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
            Gestão de Frota e Controle de Manutenção
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-xl p-8 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900/60 transition-all duration-300">
          <h2 className="mb-6 text-xl font-semibold text-zinc-800 dark:text-zinc-200 text-center">
            Bem-vindo de volta
          </h2>
          
          <form className="space-y-5">
            <div className="space-y-2">
              <label 
                htmlFor="email" 
                className="text-sm font-medium leading-none text-zinc-700 dark:text-zinc-300"
              >
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="voce@exemplo.com"
                  required
                  className="w-full rounded-xl border border-zinc-300 bg-white px-10 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label 
                  htmlFor="password" 
                  className="text-sm font-medium leading-none text-zinc-700 dark:text-zinc-300"
                >
                  Senha
                </label>
                <a 
                  href="/login/forgot-password" 
                  className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  Esqueci minha senha
                </a>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
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

            <LoginButton />
          </form>
        </div>
        
        <p className="mt-8 text-center text-xs text-zinc-500">
          Esta é uma área restrita. O acesso não autorizado é proibido.
        </p>
      </div>
    </div>
  )
}

function LoginButton() {
  const { pending } = useFormStatus();
  
  return (
    <button
      type="submit"
      formAction={login}
      disabled={pending}
      className="group relative w-full overflow-hidden rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 dark:focus:ring-offset-zinc-900"
    >
      <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
        <div className="relative h-full w-8 bg-white/20" />
      </div>
      <span className="relative z-10 flex items-center justify-center gap-2">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Entrando...
          </>
        ) : (
          "Entrar no Sistema"
        )}
      </span>
    </button>
  );
}
