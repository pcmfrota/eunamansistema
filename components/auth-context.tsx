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
    const userEmailBase = u.email?.toLowerCase().trim() || '';
    
    // Tenta carregar do cache local primeiro para resposta instantânea
    if (typeof window !== 'undefined' && !profile) {
      const cached = localStorage.getItem(`eunaman_profile_${u.id}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          console.log('[Auth] Carregando Perfil do Cache Local:', parsed);
          setProfile(parsed);
          setLoading(false); // Já temos algo para mostrar
          skipLoading = true; // Não mostramos o loader global no refresh de fundo
        } catch (e) {
          console.error('[Auth] Erro ao ler cache de perfil:', e);
        }
      }
    }

    if (!skipLoading) setLoading(true);
    
    console.group(`[Auth] Carregando Perfil do Banco: ${userEmailBase}`);
    
    try {
      // 1. Regra de Ouro: Administradores Mestre (Bypass DB)
      const isMasterAdmin = 
        userEmailBase.includes('marcos.rocha') || 
        userEmailBase.includes('marcos.aurelio') ||
        userEmailBase.includes('marcos.aurelio.rocha') ||
        userEmailBase.includes('douglas.torres') ||
        userEmailBase.includes('jessica') ||
        userEmailBase.includes('pcmfrota') ||
        userEmailBase.includes('marcos.eunaman') ||
        userEmailBase.includes('eunaman.sistema') ||
        userEmailBase.endsWith('@eunaman.com.br') || 
        u.app_metadata?.role === 'admin';

      // 2. Busca da tabela profiles - Otimizada: seleciona apenas o necessário
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .eq('id', u.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[Auth] Erro ao buscar profile:', error);
      }

      // 3. Determinação da Role e Nome
      let finalRole: 'admin' | 'pcm' | 'gestao' | 'visitante' = 'visitante';
      if (isMasterAdmin) {
        finalRole = 'admin';
      } else if (profileData?.role) {
        finalRole = profileData.role as any;
      }

      const fullName = profileData?.full_name || 
                       u.user_metadata?.full_name || 
                       u.user_metadata?.name || 
                       userEmailBase.split('@')[0] || 
                       'Usuário';

      const finalProfile: Profile = {
        id: u.id,
        email: userEmailBase,
        full_name: fullName,
        role: finalRole,
        avatar_url: profileData?.avatar_url || u.user_metadata?.avatar_url || null
      };

      // 4. Salva no Cache Local para o próximo acesso
      if (typeof window !== 'undefined') {
        localStorage.setItem(`eunaman_profile_${u.id}`, JSON.stringify(finalProfile));
      }

      setProfile(finalProfile);

      if (typeof window !== 'undefined' && (window.location.pathname === '/login' || window.location.pathname === '/')) {
        router.push('/');
      }

    } catch (err) {
      console.error('[Auth] Erro crítico no fetchProfile:', err);
    } finally {
      console.groupEnd();
      setLoading(false);
    }
  }, [supabase, router, profile]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user, true);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    // Limpeza de caches obsoletos
    if (typeof window !== 'undefined') {
      const keysToRemove = ['eunaman_profile', 'supabase.auth.token', 'sb-token'];
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user, false);
        } else {
          setLoading(false);
          if (pathname !== '/login' && pathname !== '/auth/callback') {
            router.push('/login');
          }
        }
      } catch (err) {
        console.error('[Auth] Erro na inicialização:', err);
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Evento Supabase: ${event}`);

      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        window.location.href = '/login';
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
      subscription.unsubscribe();
    };
  }, [supabase, router, pathname, fetchProfile]);

  const signOut = async () => {
    console.log('[Auth] Iniciando Logout...');
    try {
      // Limpeza forçada de tudo antes mesmo de chamar o Supabase (prevenção de travamento)
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      setUser(null);
      setProfile(null);

      // Tenta deslogar no Supabase, mas não espera se demorar (timeout de 1s)
      await Promise.race([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);

      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      }
    } catch (err) {
      console.error('[Auth] Erro no signOut, forçando redirecionamento:', err);
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
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
