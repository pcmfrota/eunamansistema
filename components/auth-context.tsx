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
    
    const userEmailBase = u.email?.toLowerCase().trim() || '';
    console.group(`[Auth] Carregando Perfil: ${userEmailBase}`);
    
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
        userEmailBase.endsWith('@eunaman.com.br') || // Qualquer email do domínio eunaman é admin por segurança agora
        u.app_metadata?.role === 'admin';

      console.log('[Auth] É Master Admin?', isMasterAdmin);

      // 2. Busca da tabela profiles
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', u.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.warn('[Auth] Perfil não encontrado no banco, usando fallback.');
        } else {
          console.error('[Auth] Erro ao buscar profile:', error);
        }
      }

      // 3. Determinação da Role e Nome
      // PRIORIDADE: Regra de Ouro > Banco de Dados > 'visitante'
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

      console.log('[Auth] Perfil Final:', finalProfile);
      setProfile(finalProfile);

      // 4. Redirecionamento Automático pós-login bem sucedido
      if (typeof window !== 'undefined' && (window.location.pathname === '/login' || window.location.pathname === '/')) {
        console.log('[Auth] Redirecionando para Dashboard...');
        router.push('/');
      }

    } catch (err) {
      console.error('[Auth] Erro crítico no fetchProfile:', err);
    } finally {
      console.groupEnd();
      setLoading(false);
    }
  }, [supabase, router]);

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
