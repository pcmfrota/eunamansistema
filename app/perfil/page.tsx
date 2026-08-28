'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/components/auth-context'
import { useOffline } from '@/components/offline-provider'
import { createClient } from '@/utils/supabase/client'
import { 
  User, 
  Camera, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Shield,
  Mail,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function PerfilPage() {
  const { profile, user, loading: authLoading, updatePassword, refreshProfile } = useAuth()
  const { isOnline } = useOffline()
  const [loading, setLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setAvatarUrl(profile.avatar_url)
    }
  }, [profile])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!isOnline) {
      setMessage({ type: 'error', text: 'Esta ação exige conexão com a internet. Tente novamente ao reconectar.' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error
      
      // Sincroniza também com o metadata do Auth para evitar inconsistências
      await supabase.auth.updateUser({
        data: { full_name: fullName }
      })
      
      // Atualiza o contexto global
      await refreshProfile()
      
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao atualizar perfil' })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: 'As senhas não coincidem' })
      return
    }
    if (newPassword.length < 6) {
      setPwMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres' })
      return
    }
    if (!isOnline) {
      setPwMessage({ type: 'error', text: 'Esta ação exige conexão com a internet. Tente novamente ao reconectar.' })
      return
    }

    setPwLoading(true)
    setPwMessage(null)

    try {
      await updatePassword(newPassword)
      setPwMessage({ type: 'success', text: 'Senha alterada com sucesso!' })
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      setPwMessage({ type: 'error', text: error.message || 'Erro ao alterar senha' })
    } finally {
      setPwLoading(false)
    }
  }

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0 || !user) return
      if (!isOnline) {
        setMessage({ type: 'error', text: 'Esta ação exige conexão com a internet. Tente novamente ao reconectar.' })
        return
      }
      setLoading(true)
      
      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const filePath = `${user.id}-${Math.random()}.${fileExt}`

      // Upload para o bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Pegar URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setAvatarUrl(publicUrl)
      
      // Atualizar perfil imediatamente com a nova URL
      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id || '')

      await refreshProfile()

      setMessage({ type: 'success', text: 'Foto atualizada!' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro no upload' })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Meu Perfil</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Gerencie suas informações e foto de perfil</p>
          </div>
          </div>
        </div>

        {/* Main Card */}
        <div
          className="rounded-3xl overflow-hidden shadow-2xl"
          style={{
            background: 'var(--bg-card)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div className="h-32 bg-gradient-to-r from-green-700 to-emerald-600" />
          
          <div className="px-8 pb-8">
            <div className="relative -mt-16 mb-8 flex justify-center sm:justify-start">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center shadow-lg">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} className="text-slate-400" />
                  )}
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="absolute bottom-0 right-0 p-2.5 rounded-full bg-blue-600 text-white border-4 border-white dark:border-slate-800 hover:bg-blue-700 transition-all hover:scale-110 shadow-lg"
                >
                  <Camera size={18} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleUploadAvatar} 
                  className="hidden" 
                  accept="image/*"
                />
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                    <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all outline-none font-medium"
                    style={{
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      borderColor: 'var(--border-input)',
                    }}
                  />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                    E-mail (Login)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-500 cursor-not-allowed outline-none"
                    />
                  </div>
                </div>
              </div>

              <div
                className="p-4 rounded-2xl flex items-center gap-4"
                style={{
                  background: 'rgba(21, 128, 61, 0.08)',
                  border: '1px solid rgba(21, 128, 61, 0.2)',
                }}
              >
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(21, 128, 61, 0.15)' }}
                >
                  <Shield size={20} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Seu Cargo / Nível de Acesso</p>
                  <p className="text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>{profile?.role || 'Visitante'}</p>
                </div>
              </div>

              {message && (
                <div className={cn(
                  "p-4 rounded-2xl flex items-center gap-3 border animate-in fade-in slide-in-from-top-2 duration-300",
                  message.type === 'success' 
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                    : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                )}>
                  {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  <p className="text-sm font-semibold">{message.text}</p>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-500/25"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save size={20} />}
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Change Password Card */}
        <div
          className="rounded-3xl p-8 space-y-6"
          style={{
            background: 'var(--bg-card)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          }}
        >
          <div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Segurança</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Altere sua senha de acesso ao sistema</p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                  Nova Senha
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-green-500/25 outline-none font-medium transition-all"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: 'var(--border-input)' }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-green-500/25 outline-none font-medium transition-all"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: 'var(--border-input)' }}
                />
              </div>
            </div>

            {pwMessage && (
              <div className={cn(
                "p-4 rounded-xl flex items-center gap-3 border",
                pwMessage.type === 'success' 
                  ? "bg-green-50 dark:bg-green-950/20 border-green-200 text-green-700"
                  : "bg-red-50 dark:bg-red-950/20 border-red-200 text-red-700"
              )}>
                {pwMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <p className="text-sm font-medium">{pwMessage.text}</p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pwLoading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold transition-all hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50"
              >
                {pwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield size={18} />}
                Atualizar Senha
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 flex gap-4">
          <div className="text-amber-500 shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-1">Nota de Segurança</h4>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              O seu cargo é definido pelo administrador do sistema. Se você precisar de permissões adicionais (como Admin ou PCM), entre em contato com o gestor responsável.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
