'use client'

import React, { useState } from 'react'
import { 
  X, 
  Lock, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2,
  KeyRound
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'

export default function AlterarSenhaModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
       setError("A senha deve ter pelo menos 6 caracteres.")
       return
    }

    if (password !== confirmPassword) {
       setError("As senhas não coincidem.")
       return
    }

    setLoading(true)
    const supabase = createClient()
    
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    })

    if (updateError) {
       setError(updateError.message)
    } else {
       setSuccess(true)
       setTimeout(() => {
          setSuccess(false)
          setPassword("")
          setConfirmPassword("")
          onClose()
       }, 2000)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in duration-300">
        
        {/* Header */}
        <div className="p-8 text-center border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors">
            <X size={20} />
          </button>
          
          <div className="inline-flex p-4 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 rounded-3xl mb-4 shadow-inner">
             <KeyRound size={32} />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">Segurança da Conta</h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Alteração de Senha de Acesso</p>
        </div>

        {/* Content */}
        <div className="p-8">
          {success ? (
             <div className="flex flex-col items-center justify-center py-8 gap-4 animate-in zoom-in">
                <div className="p-4 bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 rounded-full">
                   <CheckCircle2 size={48} />
                </div>
                <div className="text-center">
                   <p className="text-lg font-black text-zinc-900 dark:text-zinc-50">Senha Atualizada!</p>
                   <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Sincronizado com EUNAMAN Cloud</p>
                </div>
             </div>
          ) : (
            <form onSubmit={handleUpdate} className="space-y-6">
              {error && (
                 <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400">
                    <AlertCircle size={18} className="shrink-0" />
                    <p className="text-[11px] font-black uppercase tracking-tight">{error}</p>
                 </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nova Senha</label>
                   <div className="relative group">
                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-12 pr-12 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                        placeholder="••••••••"
                        required
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                         {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Confirmar Senha</label>
                   <div className="relative group">
                      <ShieldCheck size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                        placeholder="••••••••"
                        required
                      />
                   </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/50 flex gap-3">
                 <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                 <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300 leading-relaxed uppercase tracking-tighter">
                   Ao alterar sua senha, você precisará realizar um novo login em todos os dispositivos para manter a segurança da sua conta.
                 </p>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? (
                   <RefreshCcw size={18} className="animate-spin" />
                ) : (
                   <>
                     <Lock size={18} />
                     Atualizar Senha
                   </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function RefreshCcw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  )
}
