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
    
    // 1. Determinação OTIMISTA de Role e Nome (Sem DB)
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

    // Perfil inicial (otimista)
    let initialProfile: Profile = {
      id: u.id,
      email: userEmailBase,
      full_name: u.user_metadata?.full_name || u.user_metadata?.name || userEmailBase.split('@')[0] || 'Usuário',
      role: isMasterAdmin ? 'admin' : 'visitante',
      avatar_url: u.user_metadata?.avatar_url || null
    };

    // 2. Tenta carregar do cache local primeiro para resposta instantânea
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`eunaman_profile_${u.id}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          console.log('[Auth] Carregando Perfil do Cache Local:', parsed);
          setProfile(parsed);
          setLoading(false); // Já libera a UI
          skipLoading = true; 
          initialProfile = parsed;
        } catch (e) {
          console.error('[Auth] Erro ao ler cache de perfil:', e);
        }
      }
    }

    // 3. SE NÃO TEM CACHE, USAMOS O PERFIL OTIMISTA (METADATA) PARA NÃO TRAVAR A UI
    if (!skipLoading) {
      console.log('[Auth] Usando Perfil Otimista (Metadata) para evitar trava de UI');
      setProfile(initialProfile);
      setLoading(false); // LIBERA A UI IMEDIATAMENTE PARA TODOS
    }
    
    console.group(`[Auth] Buscando Perfil Real no Banco: ${userEmailBase}`);
    
    try {
      // 3. Busca da tabela profiles - Otimizada: seleciona apenas o necessário
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .eq('id', u.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[Auth] Erro ao buscar profile:', error);
      }

      // 4. Determinação Final da Role e Nome
      let finalRole: 'admin' | 'pcm' | 'gestao' | 'visitante' = isMasterAdmin ? 'admin' : 'visitante';
      if (profileData?.role) {
        finalRole = profileData.role as any;
      }

      const fullName = profileData?.full_name || initialProfile.full_name;

      const finalProfile: Profile = {
        id: u.id,
        email: userEmailBase,
        full_name: fullName,
        role: finalRole,
        avatar_url: profileData?.avatar_url || initialProfile.avatar_url
      };

      // 5. Salva no Cache Local para o próximo acesso
      if (typeof window !== 'undefined') {
        localStorage.setItem(`eunaman_profile_${u.id}`, JSON.stringify(finalProfile));
      }

      setProfile(finalProfile);

      // 6. Redirecionamento inteligente apenas se estiver na tela de login
      if (typeof window !== 'undefined' && (window.location.pathname === '/login' || window.location.pathname === '/auth/callback')) {
        console.log('[Auth] Redirecionando para Dashboard após login bem-sucedido');
        router.replace('/');
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
  }, [supabase, router]); // Removido fetchProfile e pathname para evitar loops e re-inicializações

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
