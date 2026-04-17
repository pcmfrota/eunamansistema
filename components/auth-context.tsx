'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { User } from '@supabase/supabase-js'

type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'pcm' | 'gestao' | 'visitante'
}

type AuthContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // 1. Iniciar com os dados da sessão atual (se houver)
    const initSession = async () => {
      console.log('[Auth] Iniciando initSession...')
      
      try {
        // Tenta pegar a sessão rápida (local storage) primeiro
        const { data: { session } } = await supabase.auth.getSession()
        let currentUser = session?.user || null

        if (currentUser) {
          console.log('[Auth] Usuário detectado via getSession:', currentUser.email)
          setUser(currentUser)
          
          // --- FEEDBACK MAIS INTELIGENTE ---
          // Define perfil provisório baseado no token
          let initialRole: any = currentUser.app_metadata?.role || 'visitante'
          
          // Hard-overrides para usuários chave (Administradores conhecidos)
          if (currentUser.email?.includes('marcos.rocha') || currentUser.email?.includes('douglas.torres')) {
            initialRole = 'admin'
          }
          
          const provisionalProfile: Profile = {
            id: currentUser.id,
            email: currentUser.email || '',
            full_name: currentUser.user_metadata?.full_name || 'Usuário',
            role: initialRole,
            avatar_url: currentUser.user_metadata?.avatar_url || null
          }
          
          setProfile(provisionalProfile)

          // Se o cargo já é Administrador ou PCM no token, libera a UI logo
          // Senão, esperamos um pouquinho pelo bando de dados pra não piscar "Visitante"
          if (initialRole !== 'visitante') {
            setLoading(false)
          }

          // --- BUSCA PERFIL REAL DO BANCO ---
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single()

          if (!error && profileData) {
            console.log('[Auth] Perfil sincronizado com o DB')
            let finalRole = profileData.role || currentUser.app_metadata?.role || 'visitante'
            
            // Garantir overrides críticos
            if (currentUser.email?.includes('marcos.rocha') || currentUser.email?.includes('douglas.torres')) {
              finalRole = 'admin'
            }

            setProfile({
              id: currentUser.id,
              email: currentUser.email || '',
              full_name: profileData.full_name || currentUser.user_metadata?.full_name || 'Usuário',
              role: finalRole as any,
              avatar_url: profileData.avatar_url || currentUser.user_metadata?.avatar_url || null
            })
          }
        }
        
        // Finaliza o loading em qualquer caso (se ainda estiver ativo)
        setLoading(false)

      } catch (err) {
        console.error('[Auth] Erro na sessão inicial:', err)
        setLoading(false)
      }
    }

    initSession()

    // 2. Ouvir mudanças (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      console.log('[Auth] Mudança de estado:', _event)
      
      if (session) {
        const currentUser = session.user
        setUser(currentUser)
        
        // Define papel inicial
        let initialRole: any = currentUser.app_metadata?.role || 'visitante'
        if (currentUser.email?.includes('marcos.rocha') || currentUser.email?.includes('douglas.torres')) {
          initialRole = 'admin'
        }

        // Tenta buscar o perfil do banco IMEDIATAMENTE antes de tirar o loading se for visitante
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role, full_name, avatar_url')
          .eq('id', currentUser.id)
          .single()

        const finalRole = profileData?.role || initialRole

        setProfile({
          id: currentUser.id,
          email: currentUser.email || '',
          full_name: profileData?.full_name || currentUser.user_metadata?.full_name || 'Usuário',
          role: finalRole as any,
          avatar_url: profileData?.avatar_url || currentUser.user_metadata?.avatar_url || null
        })
        
        setLoading(false)
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.assign('/login')
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      // Forçar recarregamento total para limpar o estado do cliente e redirecionar
      window.location.assign('/login')
    } catch (error) {
      console.error('Erro ao sair:', error)
      window.location.assign('/login')
    }
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
