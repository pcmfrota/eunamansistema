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
      
      // Global Safety Timeout - Se nada acontecer em 6s, libera a UI
      const globalTimeout = setTimeout(() => {
        setLoading(prev => {
          if (prev) console.warn('[Auth] Safety timeout global atingido!');
          return false;
        });
      }, 6000);

      try {
        // Tenta pegar a sessão rápida (local storage) primeiro
        const { data: { session } } = await supabase.auth.getSession()
        let currentUser = session?.user || null

        // Se não tiver local, tenta validar no servidor com timeout
        if (!currentUser) {
          try {
            const userPromise = supabase.auth.getUser()
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('TIMEOUT_AUTH')), 2500)
            )
            const { data: { user } } = await Promise.race([userPromise, timeoutPromise]) as any
            currentUser = user
          } catch (e) {
            console.warn('[Auth] Timeout ou erro ao buscar usuário no servidor.')
          }
        }
        
        if (currentUser) {
          console.log('[Auth] Usuário detectado:', currentUser.email)
          setUser(currentUser)
          
          let profileData = null
          try {
            const fetchPromise = supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUser.id)
              .single()
            
            const timeoutPromise = new Promise((_, reject) => 
               setTimeout(() => reject(new Error('TIMEOUT_DB')), 2500)
            )
            
            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any
            if (!error) profileData = data
          } catch (e) {
            console.warn('[Auth] Falha ou timeout no DB.')
          }

          let finalRole: any = currentUser.app_metadata?.role || profileData?.role

          // Hard-override de segurança
          if (currentUser.email?.includes('marcos.rocha')) {
            finalRole = 'admin'
          }

          if (!finalRole) finalRole = 'visitante'
          
          setProfile({
            id: currentUser.id,
            email: currentUser.email || '',
            full_name: profileData?.full_name || currentUser.user_metadata?.full_name || 'Usuário',
            role: finalRole,
            avatar_url: profileData?.avatar_url || currentUser.user_metadata?.avatar_url || null
          })
        }
      } catch (err) {
        console.error('[Auth] Erro na sessão inicial:', err)
      } finally {
        clearTimeout(globalTimeout)
        setLoading(false)
        console.log('[Auth] initSession concluído.')
      }
    }

    initSession()

    // 2. Ouvir mudanças (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      console.log('[Auth] Mudança de estado:', _event)
      if (session) {
        setUser(session.user)
        
        // Sincronização rápida em caso de eventos de login
        let finalRole = session.user.app_metadata?.role || 'visitante'
        if (session.user.email === 'marcos.rocha@eunaman.com.br') {
          finalRole = 'admin'
        }

        setProfile({
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.user_metadata?.full_name || 'Usuário',
          role: finalRole as any,
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
