'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'pcm' | 'gestao' | 'visitante'
}

type AuthContextType = {
  user: any
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // 1. Iniciar com os dados da sessão atual (se houver)
    const initSession = async () => {
      try {
        // getUser() é mais seguro pois valida no servidor
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (user) {
          console.log('[Auth] Usuário detectado via getUser:', user.email)
          setUser(user)
          
          // Buscar perfil do DB
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          if (profileError) {
            console.warn('[Auth] Erro ao buscar perfil na tabela:', profileError.message)
          }

          // Estratégia de Role: Banco de Dados > Metadados do Token > Default
          const finalRole = profileData?.role || user.app_metadata?.role || 'visitante'
          
          const profileWithRole = profileData ? { ...profileData, role: finalRole } : {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || 'Usuário',
            role: finalRole,
            avatar_url: user.user_metadata?.avatar_url || null
          }

          console.log('[Auth] Role Final definida como:', finalRole)
          setProfile(profileWithRole)
        }
      } catch (err) {
        console.error('Erro na sessão inicial:', err)
      } finally {
        setLoading(false)
      }
    }

    initSession()

    // 2. Ouvir mudanças (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      console.log('[Auth] Mudança de estado:', _event)
      if (session) {
        setUser(session.user)
        
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        const finalRole = profileData?.role || session.user.app_metadata?.role || 'visitante'
        
        setProfile(profileData ? { ...profileData, role: finalRole } : {
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name || 'Usuário',
          role: finalRole,
          avatar_url: session.user.user_metadata?.avatar_url || null
        })
      } else {
        setUser(null)
        setProfile(null)
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.assign('/login')
        }
      }
      setLoading(false)
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

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
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
