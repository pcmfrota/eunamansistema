'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { logout as serverLogout } from '@/app/login/actions'

type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'pcm' | 'gestao' | 'visitante' | 'mecanico' | 'motorista' | 'afiador'
  filial_id: string          // ID da filial do usuário (ex: 'MATRIZ', 'ACAILANDIA')
  filial_nome: string        // Nome exibido (ex: 'FILIAL AÇAILÂNDIA')
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
  filialId: string           // Atalho direto para profile.filial_id
  filialNome: string         // Atalho direto para profile.filial_nome
  isAdmin: boolean           // Atalho direto para profile.role === 'admin'
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
        let permissions = cachedPerms ? JSON.parse(cachedPerms) : [];
        if (Array.isArray(permissions) && !permissions.includes('/lubrificacao')) {
          permissions.push('/lubrificacao');
        }
        return {
          user,
          profile,
          permissions,
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

  const fetchProfile = useCallback(async (u: any, force = false, ignoreCache = false, silentBackground = false) => {
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
      avatar_url: u.user_metadata?.avatar_url || null,
      filial_id: 'MATRIZ',
      filial_nome: 'MATRIZ',
    };

    let skipLoading = false;

    // 1. TENTA CARREGAR DO CACHE IMEDIATAMENTE (FLUXO ULTRA RÁPIDO)
    if (!ignoreCache && !force) {
      const cachedProfile = typeof window !== 'undefined' ? localStorage.getItem(`eunaman_profile_${u.id}`) : null;
      const cachedPerms = typeof window !== 'undefined' ? localStorage.getItem(`eunaman_perms_${u.id}`) : null;

      if (cachedProfile) {
        try {
          const parsedProfile = JSON.parse(cachedProfile);
          let parsedPerms = cachedPerms ? JSON.parse(cachedPerms) : [];
          if (Array.isArray(parsedPerms) && !parsedPerms.includes('/lubrificacao')) {
            parsedPerms.push('/lubrificacao');
          }
          
          setProfile(parsedProfile);
          setPermissions(parsedPerms);
          
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

    // silentBackground = true: nunca mostrar o loader (ex: TOKEN_REFRESHED do câmera)
    if (!skipLoading && !silentBackground) setLoading(true);
    await syncWithDatabase(u, isMasterAdmin, currentProfile);
  }, [supabase, router]);

  // Função isolada para sincronização com o banco (Background ou Foreground)
  const syncWithDatabase = async (u: any, isMasterAdmin: boolean, currentProfile: Profile) => {
    let profileData = null;
    let allPerms = [];

    try {
      // Busca profile e permissões em PARALELO com Timeout de 5s para evitar travar na tela de "Carregando Acessos"
      // caso o banco esteja em pausa (cold start) ou a rede do usuário esteja instável.
      const dbPromise = Promise.all([
        supabase.from('profiles').select('id, full_name, role, avatar_url, filial_id, filiais(nome)').eq('id', u.id).maybeSingle(),
        supabase.from('role_permissions').select('role, allowed_tabs')
      ]);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de 5 segundos ao conectar ao banco')), 5000)
      );

      const [profileRes, permRes] = await Promise.race([dbPromise, timeoutPromise]);

      if (profileRes && !profileRes.error) profileData = profileRes.data;
      if (permRes && !permRes.error) allPerms = permRes.data || [];
    } catch (err) {
      console.warn('[Auth] Erro ou Timeout na sincronização com o Supabase. Usando fallbacks locais:', err);
    }

    try {

      // 3. Determinação da Role (tabela de perfis do banco -> app_metadata do token -> user_metadata -> fallback)
      let finalRole: 'admin' | 'pcm' | 'gestao' | 'visitante' | 'mecanico' | 'motorista' | 'afiador' = 
        (profileData?.role as any) || 
        (u.app_metadata?.role as any) || 
        (u.user_metadata?.role as any) || 
        (isMasterAdmin ? 'admin' : 'visitante');

      const filialId = (profileData as any)?.filial_id || 'MATRIZ'
      const filialNome = (profileData as any)?.filiais?.nome || filialId

      const finalProfile: Profile = {
        id: u.id,
        email: u.email || '',
        full_name: profileData?.full_name || currentProfile.full_name,
        role: finalRole,
        avatar_url: profileData?.avatar_url || null,
        filial_id: filialId,
        filial_nome: filialNome,
      };

      // 4. Determinação das Permissões
      const rolePerm = allPerms.find((p: any) => p.role === finalRole);
      let finalPerms: string[] = [];

      const allTabs = ['/dashboard', '/os', '/preventivas', '/pneus', '/afiacao', '/lubrificacao', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens', '/captacao', '/documentos', '/checklist-mecanicos', '/admin/usuarios'];
      if (rolePerm?.allowed_tabs && rolePerm.allowed_tabs.length > 0) {
        // Map '/' to '/dashboard' for backward compatibility
        finalPerms = rolePerm.allowed_tabs.map((t: string) => t === '/' ? '/dashboard' : t);
      } else {
        if (finalRole === 'admin') finalPerms = allTabs;
        else if (finalRole === 'visitante') finalPerms = ['/dashboard', '/preventivas', '/backlog', '/calendario', '/documentos'];
        else if (finalRole === 'mecanico') finalPerms = ['/dashboard', '/os', '/preventivas', '/pneus', '/afiacao', '/lubrificacao', '/backlog', '/programacao-preventiva', '/calendario', '/captacao', '/documentos', '/checklist-mecanicos'];
        else if (finalRole === 'motorista') finalPerms = ['/dashboard', '/pneus', '/calendario', '/lavagens', '/captacao', '/documentos'];
        else if (finalRole === 'afiador') finalPerms = ['/dashboard', '/afiacao'];
        else finalPerms = allTabs.filter(t => t !== '/admin/usuarios');
      }

      // Garantir que /lubrificacao seja sempre incluída para perfis autorizados
      if (['admin', 'pcm', 'gestao', 'mecanico', 'tecnico', 'gestor'].includes(finalRole) && !finalPerms.includes('/lubrificacao')) {
        finalPerms.push('/lubrificacao');
      }

      // 5. Atualiza State e Cache
      setProfile(finalProfile);
      setPermissions(finalPerms);

      if (typeof window !== 'undefined') {
        localStorage.setItem(`eunaman_profile_${u.id}`, JSON.stringify(finalProfile));
        localStorage.setItem(`eunaman_perms_${u.id}`, JSON.stringify(finalPerms));

        // Sincroniza cookies para o middleware
        document.cookie = `x-user-role=${finalRole}; path=/; max-age=3600; SameSite=Lax;`;
        document.cookie = `x-user-filial=${filialId}; path=/; max-age=3600; SameSite=Lax;`;
        document.cookie = `x-user-permissions=${finalPerms.join(',')}; path=/; max-age=3600; SameSite=Lax;`;
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
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
          // Só exibe loader em SIGNED_IN (login real), não em renovações de token
          setLoading(true); // Trava a UI para evitar dados antigos
          fetchProfile(currentUser, false, true); // ignoreCache = true
        } else if (event === 'TOKEN_REFRESHED') {
          // Renovação automática do token (ex: câmera no celular, volta ao foco)
          // NÃO ativar o loading aqui — causaria o PremiumLoader destruir o modal de OS aberto
          setUser(currentUser);
          // fetchProfile em background sem afetar o estado de loading (silentBackground=true)
          fetchProfile(currentUser, false, false, true);
        } else if (event === 'INITIAL_SESSION') {
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
      // Se estiver no aplicativo nativo (WebView com EunamanApp), chama o logout nativo
      if (typeof window !== 'undefined' && (window as any).EunamanApp?.logout) {
        console.log('[Auth] Ponte nativa EunamanApp encontrada. Acionando expurgo de cache nativo...');
        (window as any).EunamanApp.logout();
        return; // Retorna pois o Android cuidará do expurgo e do reload da URL
      }

      // Limpeza forçada de tudo antes mesmo de chamar o Supabase (prevenção de travamento)
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        // Remove cookie de papel do usuário
        document.cookie = 'x-user-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
      }
      
      setUser(null);
      setProfile(null);
      setPermissions([]);

      // Tenta deslogar no Supabase client-side
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('[Auth] Erro ao deslogar no cliente:', e);
      }

      // Chama a Server Action de logout para limpar os cookies no servidor e redirecionar
      try {
        await serverLogout();
      } catch (e) {
        // Erro esperado devido ao throw de redirect da Server Action, ignoramos
      }
    } catch (err) {
      console.error('[Auth] Erro no signOut:', err);
    } finally {
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
  const isAdmin = profile?.role?.toLowerCase().trim() === 'admin' || profile?.role?.toLowerCase().trim() === 'administrador'
  const filialId = profile?.filial_id ?? 'MATRIZ'
  const filialNome = profile?.filial_nome ?? 'MATRIZ'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isVisitante, signOut, updatePassword, refreshProfile, permissions, filialId, filialNome, isAdmin }}>
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
