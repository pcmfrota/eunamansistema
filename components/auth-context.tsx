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
    // 1. Carrega perfil do cache para exibir algo rápido se disponível
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('eunaman_profile');
      if (cached) {
        try {
          setProfile(JSON.parse(cached));
          // Não tiramos o loading ainda, pois o cache pode estar obsoleto
        } catch (e) {}
      }
    }

    const fetchProfile = async (u: User) => {
      console.log('[Auth] Buscando perfil para:', u.email);
      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', u.id)
          .single();

        let role = (profileData?.role || u.app_metadata?.role || 'visitante').toLowerCase();
        
        // Regra especial para administradores conhecidos
        if (u.email?.includes('marcos.rocha') || u.email?.includes('douglas.torres')) {
          role = 'admin';
        }

        const finalProfile: Profile = {
          id: u.id,
          email: u.email || '',
          full_name: profileData?.full_name || u.user_metadata?.full_name || 'Usuário',
          role: role as any,
          avatar_url: profileData?.avatar_url || u.user_metadata?.avatar_url || null
        };

        setProfile(finalProfile);
        localStorage.setItem('eunaman_profile', JSON.stringify(finalProfile));
      } catch (err) {
        console.error('[Auth] Erro ao carregar perfil:', err);
      } finally {
        setLoading(false);
      }
    };

    // 2. Ouvir mudanças de estado (Login, Logout, Session Restore)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Evento:', event);

      if (event === 'PASSWORD_RECOVERY') {
        window.location.assign('/login/reset-password');
        return;
      }

      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
        localStorage.removeItem('eunaman_profile');
        setLoading(false);

        // Redirecionamento se não estiver em rotas públicas
        if (typeof window !== 'undefined') {
          const isAtLogin = window.location.pathname.startsWith('/login');
          const isAtApi = window.location.pathname.startsWith('/api');
          if (!isAtLogin && !isAtApi) {
            window.location.assign('/login');
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

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
