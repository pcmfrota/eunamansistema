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
    // 0. Tenta carregar perfil do cache para exibição instantânea
    if (typeof window !== 'undefined') {
      const cachedProfile = localStorage.getItem('eunaman_profile')
      if (cachedProfile) {
        try {
          const parsed = JSON.parse(cachedProfile)
          setProfile(parsed)
          // Se temos cache, podemos até tirar o loading logo pra UI não travar
          setLoading(false)
        } catch (e) {}
      }
    }

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
          
          // --- FEEDBACK IMEDIATO ---
          // Prioriza o cargo do token ou mantêm o do cache se for compatível
          let initialRole: any = currentUser.app_metadata?.role || 'visitante'
          if (currentUser.email?.includes('marcos.rocha') || currentUser.email?.includes('douglas.torres')) {
            initialRole = 'admin'
          }

          // Se o perfil atual (do cache) não bate com o user logado, limpa
          if (profile && profile.id !== currentUser.id) {
            setProfile(null)
          }

          setLoading(false) // Libera a UI rápido

          // --- BUSCA PERFIL REAL DO BANCO ---
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single()

          if (!error && profileData) {
            console.log('[Auth] Perfil sincronizado com o DB')
            let finalRole = profileData.role || currentUser.app_metadata?.role || 'visitante'
            
            if (currentUser.email?.includes('marcos.rocha') || currentUser.email?.includes('douglas.torres')) {
              finalRole = 'admin'
            }

            const updatedProfile: Profile = {
              id: currentUser.id,
              email: currentUser.email || '',
              full_name: profileData.full_name || currentUser.user_metadata?.full_name || 'Usuário',
              role: finalRole as any,
              avatar_url: profileData.avatar_url || currentUser.user_metadata?.avatar_url || null
            }
            
            setProfile(updatedProfile)
            localStorage.setItem('eunaman_profile', JSON.stringify(updatedProfile))
          }
        } else {
          setLoading(false)
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
        
        let initialRole: any = currentUser.app_metadata?.role || 'visitante'
        if (currentUser.email?.includes('marcos.rocha') || currentUser.email?.includes('douglas.torres')) {
          initialRole = 'admin'
        }

        // Tenta buscar o perfil do banco sem travar
        supabase
          .from('profiles')
          .select('role, full_name, avatar_url')
          .eq('id', currentUser.id)
          .single()
          .then(({ data: profileData }) => {
            const finalRole = profileData?.role || initialRole
            const newProfile: Profile = {
              id: currentUser.id,
              email: currentUser.email || '',
              full_name: profileData?.full_name || currentUser.user_metadata?.full_name || 'Usuário',
              role: finalRole as any,
              avatar_url: profileData?.avatar_url || currentUser.user_metadata?.avatar_url || null
            }
            setProfile(newProfile)
            localStorage.setItem('eunaman_profile', JSON.stringify(newProfile))
            setLoading(false)
          })
      } else {
        setUser(null)
        setProfile(null)
        localStorage.removeItem('eunaman_profile')
        setLoading(false)
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
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
