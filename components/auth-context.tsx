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
          
          // --- FEEDBACK INSTANTÂNEO ---
          // Define perfil provisório baseado no token para não travar a UI
          let initialRole: any = currentUser.app_metadata?.role || 'visitante'
          if (currentUser.email?.includes('marcos.rocha')) initialRole = 'admin'
          
          const provisionalProfile: Profile = {
            id: currentUser.id,
            email: currentUser.email || '',
            full_name: currentUser.user_metadata?.full_name || 'Usuário',
            role: initialRole,
            avatar_url: currentUser.user_metadata?.avatar_url || null
          }
          
          setProfile(provisionalProfile)
          setLoading(false) // Libera a UI IMEDIATAMENTE se já temos o usuário

          // --- ENRIQUECIMENTO EM BACKGROUND ---
          // Busca dados reais do banco sem travar a navegação
          supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single()
            .then(({ data: profileData, error }) => {
              if (!error && profileData) {
                console.log('[Auth] Perfil sincronizado com o DB')
                let finalRole = profileData.role || currentUser.app_metadata?.role || 'visitante'
                if (currentUser.email?.includes('marcos.rocha')) finalRole = 'admin'

                setProfile({
                  id: currentUser.id,
                  email: currentUser.email || '',
                  full_name: profileData.full_name || currentUser.user_metadata?.full_name || 'Usuário',
                  role: finalRole as any,
                  avatar_url: profileData.avatar_url || currentUser.user_metadata?.avatar_url || null
                })
              }
            })
        } else {
          // Se não tem sessão rápida, tenta verificar no servidor rapidamente
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            setUser(user)
            // Lógica similar de provisionamento rápido...
            setLoading(false)
          } else {
            setLoading(false)
          }
        }
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
        
        // --- FEEDBACK INSTANTÂNEO ---
        let initialRole: any = currentUser.app_metadata?.role || 'visitante'
        if (currentUser.email?.includes('marcos.rocha')) initialRole = 'admin'

        setProfile({
          id: currentUser.id,
          email: currentUser.email || '',
          full_name: currentUser.user_metadata?.full_name || 'Usuário',
          role: initialRole,
          avatar_url: currentUser.user_metadata?.avatar_url || null
        })
        setLoading(false)

        // --- ENRIQUECIMENTO EM BACKGROUND ---
        supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single()
          .then(({ data: profileData, error }) => {
            if (!error && profileData) {
              let finalRole = profileData.role || currentUser.app_metadata?.role || 'visitante'
              if (currentUser.email?.includes('marcos.rocha')) finalRole = 'admin'

              setProfile({
                id: currentUser.id,
                email: currentUser.email || '',
                full_name: profileData.full_name || currentUser.user_metadata?.full_name || 'Usuário',
                role: finalRole as any,
                avatar_url: profileData.avatar_url || currentUser.user_metadata?.avatar_url || null
              })
            }
          })
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
