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
    const userEmail = u.email?.toLowerCase() || '';
    console.log('[Auth] Iniciando busca de perfil para:', userEmail);
    
    try {
      console.log('[Auth] Verificando privilégios para:', userEmail);
      
      // 1. Regra de Ouro: Administradores Mestre sempre ganham (bypass DB se necessário)
      const isMasterAdmin = userEmail.includes('marcos.rocha') || 
                            userEmail.includes('marcos.aurelio') ||
                            userEmail.includes('douglas.torres') ||
                            userEmail.includes('jessica') ||
                            userEmail.includes('pcmfrota') ||
                            (userEmail.startsWith('marcos.') && userEmail.endsWith('@eunaman.com.br')) ||
                            u.app_metadata?.role === 'admin';

      // 2. Busca da tabela profiles
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', u.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('[Auth] Erro ao buscar profile:', error);
      }

      // 3. Determinação da Role e Nome com fallbacks
      const role = isMasterAdmin ? 'admin' : (profileData?.role || 'visitante');
      const fullName = profileData?.full_name || 
                       u.user_metadata?.full_name || 
                       u.user_metadata?.name || 
                       userEmail.split('@')[0] || 
                       'Usuário';

      const finalProfile: Profile = {
        id: u.id,
        email: userEmail,
        full_name: fullName,
        role: role as any,
        avatar_url: profileData?.avatar_url || u.user_metadata?.avatar_url || null
      };

      console.log('[Auth] Perfil final determinado:', finalProfile.role);
      
      setProfile(finalProfile);
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
    // Limpeza forçada de caches antigos na montagem
    if (typeof window !== 'undefined') {
      localStorage.removeItem('eunaman_profile');
      console.log('[Auth] Cache antigo removido para garantir permissões frescas.');
    }
  }, []);

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
          // Busca dados frescos sempre para evitar cache de cargo antigo
          await fetchProfile(session.user, false);
        } else {
          setLoading(false);
          // Se não estiver na página de login, redireciona
          if (pathname !== '/login') {
            router.push('/login');
          }
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
        setLoading(false);
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return;
      }

      if (session?.user) {
        setUser(session.user);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          await fetchProfile(session.user, false);
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
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('[Auth] Erro ao sair:', err);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
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
