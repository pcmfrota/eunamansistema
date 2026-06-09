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
  role: 'admin' | 'pcm' | 'gestao' | 'visitante' | 'mecanico' | 'motorista'
}

type AuthContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  isVisitante: boolean
  signOut: () => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  refreshProfile: () => Promise<void>
  permissions: string[]
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Função auxiliar para carregar dados do cache de forma síncrona na inicialização
  const getInitialAuth = () => {
    if (typeof window === 'undefined') return { user: null, profile: null, permissions: [], loading: true };
    
    try {
      // 1. Tenta recuperar o Project Ref da URL para encontrar a chave do Supabase
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const projectRef = supabaseUrl.split('.')[0].split('//')[1];
      const supabaseKey = projectRef ? `sb-${projectRef}-auth-token` : null;
      
      let user: User | null = null;
      if (supabaseKey) {
        const sessionStr = localStorage.getItem(supabaseKey);
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          user = session.user || null;
        }
      }

      // 2. Se temos usuário, tentamos recuperar o perfil específico dele
      const lastId = user?.id || localStorage.getItem('eunaman_last_user_id');
      if (!lastId) {
        // Se não há ID nenhum, mas existe um token, podemos estar carregando
        return { user, profile: null, permissions: [], loading: !!user }; 
      }
      
      const cachedProfile = localStorage.getItem(`eunaman_profile_${lastId}`);
      const cachedPerms = localStorage.getItem(`eunaman_perms_${lastId}`);
      
      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        return {
          user,
          profile,
          permissions: cachedPerms ? JSON.parse(cachedPerms) : [],
          loading: false // SUCESSO: Carregamento instantâneo
        };
      }
    } catch (e) {
      console.warn('[Auth] Erro ao carregar cache inicial:', e);
    }
    return { user: null, profile: null, permissions: [], loading: true };
  };

  const initial = getInitialAuth();
  const [user, setUser] = useState<User | null>(initial.user)
  const [profile, setProfile] = useState<Profile | null>(initial.profile)
  const [permissions, setPermissions] = useState<string[]>(initial.permissions)
  const [loading, setLoading] = useState(initial.loading)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  const fetchProfile = useCallback(async (u: any, force = false, ignoreCache = false) => {
    if (!u?.id) return;
    
    // Atualiza o ID do último usuário para o próximo carregamento instantâneo
    if (typeof window !== 'undefined') {
      localStorage.setItem('eunaman_last_user_id', u.id);
    }

    const userEmailBase = u.email?.toLowerCase().trim() || '';
    const isMasterAdmin = 
      userEmailBase.includes('marcos.rocha') || 
      userEmailBase.includes('marcos.aurelio') ||
      userEmailBase.includes('marcos.aurelio.rocha') ||
      userEmailBase.includes('douglas.torres') ||
      userEmailBase.includes('jessica') ||
      userEmailBase.includes('pcmfrota') ||
      userEmailBase.includes('marcos.eunaman') ||
      userEmailBase.includes('eunaman.sistema') ||
      userEmailBase.endsWith('@eunaman.com.br');

    // Perfil inicial básico (obtém o cargo diretamente do token/metadata se disponível)
    const tokenRole = u.app_metadata?.role || u.user_metadata?.role;
    let currentProfile: Profile = {
      id: u.id,
      email: u.email || '',
      full_name: u.user_metadata?.full_name || userEmailBase.split('@')[0] || 'Usuário',
      role: (tokenRole as any) || (isMasterAdmin ? 'admin' : 'visitante'),
      avatar_url: u.user_metadata?.avatar_url || null
    };

    let skipLoading = false;

    // 1. TENTA CARREGAR DO CACHE IMEDIATAMENTE (FLUXO ULTRA RÁPIDO)
    if (!ignoreCache && !force) {
      const cachedProfile = typeof window !== 'undefined' ? localStorage.getItem(`eunaman_profile_${u.id}`) : null;
      const cachedPerms = typeof window !== 'undefined' ? localStorage.getItem(`eunaman_perms_${u.id}`) : null;

      if (cachedProfile) {
        try {
          const parsedProfile = JSON.parse(cachedProfile);
          const parsedPerms = cachedPerms ? JSON.parse(cachedPerms) : null;
          
          setProfile(parsedProfile);
          if (parsedPerms) setPermissions(parsedPerms);
          
          // Se temos cache, já liberamos o loader
          setLoading(false);
          skipLoading = true; 
          currentProfile = parsedProfile;
          
          console.log('[Auth] Perfil restaurado do cache (Instantâneo)');
          
          // Redirecionamento rápido se estiver na tela de login
          if (typeof window !== 'undefined' && (window.location.pathname === '/login' || window.location.pathname === '/auth/callback')) {
            router.replace('/');
          }

          // Se não for um carregamento forçado, podemos fazer a sincronização em background sem bloquear
          if (!force) {
            // Disparamos a sincronização mas não aguardamos aqui se já temos cache
            syncWithDatabase(u, isMasterAdmin, currentProfile);
            return;
          }
        } catch (e) {
          console.warn('[Auth] Erro ao ler cache');
        }
      }
    }

    if (!skipLoading) setLoading(true);
    await syncWithDatabase(u, isMasterAdmin, currentProfile);
  }, [supabase, router]);

  // Função isolada para sincronização com o banco (Background ou Foreground)
  const syncWithDatabase = async (u: any, isMasterAdmin: boolean, currentProfile: Profile) => {
    try {
      // 2. Busca profile e permissões em PARALELO (Otimizado)
      const [profileRes, permRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, avatar_url').eq('id', u.id).maybeSingle(),
        supabase.from('role_permissions').select('role, allowed_tabs')
      ]);

      const profileData = profileRes.data;
      const allPerms = permRes.data || [];

      // 3. Determinação da Role (tabela de perfis do banco -> app_metadata do token -> user_metadata -> fallback)
      let finalRole: 'admin' | 'pcm' | 'gestao' | 'visitante' | 'mecanico' | 'motorista' = 
        (profileData?.role as any) || 
        (u.app_metadata?.role as any) || 
        (u.user_metadata?.role as any) || 
        (isMasterAdmin ? 'admin' : 'visitante');

      const finalProfile: Profile = {
        id: u.id,
        email: u.email || '',
        full_name: profileData?.full_name || currentProfile.full_name,
        role: finalRole,
        avatar_url: profileData?.avatar_url || null
      };

      // 4. Determinação das Permissões
      const rolePerm = allPerms.find(p => p.role === finalRole);
      let finalPerms: string[] = [];

      const allTabs = ['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens', '/admin/usuarios'];
      if (rolePerm?.allowed_tabs && rolePerm.allowed_tabs.length > 0) {
        finalPerms = rolePerm.allowed_tabs;
      } else {
        if (finalRole === 'admin') finalPerms = allTabs;
        else if (finalRole === 'visitante') finalPerms = ['/', '/preventivas', '/backlog', '/calendario'];
        else if (finalRole === 'mecanico') finalPerms = ['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/calendario'];
        else if (finalRole === 'motorista') finalPerms = ['/', '/pneus', '/calendario', '/lavagens'];
        else finalPerms = allTabs.filter(t => t !== '/admin/usuarios');
      }

      // 5. Atualiza State e Cache
      setProfile(finalProfile);
      setPermissions(finalPerms);

      if (typeof window !== 'undefined') {
        localStorage.setItem(`eunaman_profile_${u.id}`, JSON.stringify(finalProfile));
        localStorage.setItem(`eunaman_perms_${u.id}`, JSON.stringify(finalPerms));
      }

      // 6. Redirecionamento final (se necessário)
      if (typeof window !== 'undefined' && (window.location.pathname === '/login' || window.location.pathname === '/auth/callback')) {
        router.replace('/');
      }

    } catch (err) {
      console.error('[Auth] Erro na sincronização:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      // Ao atualizar perfil, limpamos o cache local antes
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`eunaman_profile_${user.id}`);
      }
      await fetchProfile(user, true, true);
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
          // Não aguardamos o fetchProfile aqui para permitir que a inicialização termine rápido
          // O fetchProfile já lida com o estado interno (loading/profile)
          fetchProfile(session.user, false);
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
      console.log(`[Auth] Evento Supabase: ${event}`, session?.user?.email);

      if (!mounted) return;

      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        setUser(null);
        setProfile(null);
        setPermissions([]);
        setLoading(false);
        if (typeof window !== 'undefined') {
          localStorage.clear();
        }
        return;
      }

      if (session?.user) {
        // Se houver uma troca de usuário ou uma nova entrada, garantimos que o estado seja limpo
        const currentUser = session.user;
        
        if (event === 'SIGNED_IN') {
          console.log('[Auth] Novo login detectado, buscando perfil fresco...');
          setLoading(true); // Trava a UI para evitar dados antigos
          fetchProfile(currentUser, false, true); // ignoreCache = true
        } else if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          setUser(currentUser);
          fetchProfile(currentUser, false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, router]); // Removido user daqui para evitar loops e garantir registro único do listener

  const signOut = async () => {
    console.log('[Auth] Iniciando Logout...');
    try {
      // Limpeza forçada de tudo antes mesmo de chamar o Supabase (prevenção de travamento)
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        // Remove cookie de papel do usuário
        document.cookie = 'x-user-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
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
    <AuthContext.Provider value={{ user, profile, loading, isVisitante, signOut, updatePassword, refreshProfile, permissions }}>
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
