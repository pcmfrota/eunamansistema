'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
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
  isVisitante: boolean
  signOut: () => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  const fetchProfile = useCallback(async (u: User, skipLoading = false) => {
    if (!skipLoading) setLoading(true);
    console.log('[Auth] Buscando perfil para:', u.email);
    
    try {
      // Tenta buscar da tabela profiles
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', u.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('[Auth] Erro ao buscar perfil:', error.message);
      }

      let role = (profileData?.role || u.app_metadata?.role || 'visitante').toLowerCase();
      
      // Regra especial para administradores conhecidos (fallback de emergência)
      if (u.email?.includes('marcos.rocha') || u.email?.includes('douglas.torres')) {
        role = 'admin';
      }

      // Fallback robusto para o nome: 
      // 1. Tabela profiles (full_name ou name)
      // 2. User Metadata (full_name ou name ou display_name)
      // 3. Email (primeira parte)
      const fullName = profileData?.full_name || 
                       (profileData as any)?.name || 
                       u.user_metadata?.full_name || 
                       u.user_metadata?.name || 
                       u.user_metadata?.display_name || 
                       u.email?.split('@')[0] || 
                       'Usuário';

      const finalProfile: Profile = {
        id: u.id,
        email: u.email || '',
        full_name: fullName,
        role: role as any,
        avatar_url: profileData?.avatar_url || u.user_metadata?.avatar_url || null
      };

      setProfile(finalProfile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('eunaman_profile', JSON.stringify(finalProfile));
      }
    } catch (err) {
      console.error('[Auth] Erro crítico ao carregar perfil:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user, true);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    // 1. Inicialização rápida
    const initAuth = async () => {
      try {
        // Tenta recuperar sessão existente imediatamente
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          
          let hasCached = false;
          // Tenta carregar do cache para tirar o loading rápido
          const cached = localStorage.getItem('eunaman_profile');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (parsed.id === session.user.id) {
                setProfile(parsed);
                setLoading(false); // Já temos algo para mostrar
                hasCached = true;
              }
            } catch (e) {}
          }
          
          // Busca dados frescos. Se já tem cache, faz em background.
          await fetchProfile(session.user, hasCached);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('[Auth] Erro na inicialização:', err);
        setLoading(false);
      }
    };

    initAuth();

    // Fail-safe: Se em 3 segundos ainda estiver carregando, força a saída do loading
    timeoutId = setTimeout(() => {
      if (mounted) {
        setLoading(current => {
          if (current) console.warn('[Auth] Timeout de carregamento atingido (3s). Forçando entrada.');
          return false;
        });
      }
    }, 3000);

    // 2. Ouvir mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Evento:', event);

      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('eunaman_profile');
        }
        setLoading(false);
        router.push('/login');
        return;
      }

      if (session?.user) {
        setUser(session.user);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          // Se já temos um perfil carregado, não ativa o loading visual
          const hasProfile = !!localStorage.getItem('eunaman_profile');
          await fetchProfile(session.user, hasProfile);
        }
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [supabase, router, fetchProfile]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('eunaman_profile');
      }
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  const isVisitante = profile?.role === 'visitante'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isVisitante, signOut, updatePassword, refreshProfile }}>
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
