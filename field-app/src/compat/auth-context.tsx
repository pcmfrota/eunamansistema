// Port de components/auth-context.tsx (app principal) pro app de campo. Mesma lógica
// de perfil/permissões/cache — só sem as partes que dependiam do Next.js/middleware:
// - process.env.NEXT_PUBLIC_* -> import.meta.env.VITE_* (convenção do Vite)
// - useRouter()/usePathname() removidos: aqui não há rotas de verdade, "mostrar login
//   ou mostrar o app" é só renderização condicional (ver App.tsx), não navegação.
// - Chamada à Server Action de logout (app/login/actions) removida: sem servidor pra
//   limpar cookie nenhum, supabase.auth.signOut() (client) já basta.
// - Sincronização de cookies pro middleware removida: não existe middleware aqui.
// - Checagem de profiles.status !== 'aprovado' ADICIONADA: no app principal isso só
//   era feito no middleware; aqui, sem servidor, precisa entrar no próprio fetchProfile.
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "admin" | "pcm" | "gestao" | "financeiro" | "visitante" | "mecanico" | "motorista" | "afiador" | "supervisor_manutencao";
  filial_id: string;
  filial_nome: string;
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isVisitante: boolean;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  permissions: string[];
  filialId: string;
  filialNome: string;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const getInitialAuth = () => {
    if (typeof window === "undefined") return { user: null, profile: null, permissions: [] as string[], loading: true };

    try {
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "";
      const projectRef = supabaseUrl.split(".")[0].split("//")[1];
      const supabaseKey = projectRef ? `sb-${projectRef}-auth-token` : null;

      let user: User | null = null;
      if (supabaseKey) {
        const sessionStr = localStorage.getItem(supabaseKey);
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          user = session.user || null;
        }
      }

      const lastId = user?.id || localStorage.getItem("eunaman_last_user_id");
      if (!lastId) return { user, profile: null, permissions: [] as string[], loading: !!user };

      const cachedProfile = localStorage.getItem(`eunaman_profile_${lastId}`);
      const cachedPerms = localStorage.getItem(`eunaman_perms_${lastId}`);

      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        let permissions = cachedPerms ? JSON.parse(cachedPerms) : [];
        if (Array.isArray(permissions) && !permissions.includes("/lubrificacao")) permissions.push("/lubrificacao");
        return { user, profile, permissions, loading: false };
      }
    } catch (e) {
      console.warn("[Auth] Erro ao carregar cache inicial:", e);
    }
    return { user: null, profile: null, permissions: [] as string[], loading: true };
  };

  const initial = getInitialAuth();
  const [user, setUser] = useState<User | null>(initial.user);
  const [profile, setProfile] = useState<Profile | null>(initial.profile);
  const [permissions, setPermissions] = useState<string[]>(initial.permissions);
  const [loading, setLoading] = useState(initial.loading);
  const supabase = createClient();

  const fetchProfile = useCallback(async (u: any, force = false, ignoreCache = false, silentBackground = false) => {
    if (!u?.id) return;
    if (typeof window !== "undefined") localStorage.setItem("eunaman_last_user_id", u.id);

    const userEmailBase = u.email?.toLowerCase().trim() || "";
    const isMasterAdmin =
      userEmailBase.includes("marcos.rocha") ||
      userEmailBase.includes("marcos.aurelio") ||
      userEmailBase.includes("marcos.aurelio.rocha") ||
      userEmailBase.includes("douglas.torres") ||
      userEmailBase.includes("jessica") ||
      userEmailBase.includes("pcmfrota") ||
      userEmailBase.includes("marcos.eunaman") ||
      userEmailBase.includes("eunaman.sistema") ||
      userEmailBase.endsWith("@eunaman.com.br");

    const tokenRole = u.app_metadata?.role || u.user_metadata?.role;
    let currentProfile: Profile = {
      id: u.id,
      email: u.email || "",
      full_name: u.user_metadata?.full_name || userEmailBase.split("@")[0] || "Usuário",
      role: (tokenRole as any) || (isMasterAdmin ? "admin" : "visitante"),
      avatar_url: u.user_metadata?.avatar_url || null,
      filial_id: "MATRIZ",
      filial_nome: "MATRIZ",
    };

    let skipLoading = false;

    if (!ignoreCache && !force) {
      const cachedProfile = typeof window !== "undefined" ? localStorage.getItem(`eunaman_profile_${u.id}`) : null;
      const cachedPerms = typeof window !== "undefined" ? localStorage.getItem(`eunaman_perms_${u.id}`) : null;

      if (cachedProfile) {
        try {
          const parsedProfile = JSON.parse(cachedProfile);
          let parsedPerms = cachedPerms ? JSON.parse(cachedPerms) : [];
          if (Array.isArray(parsedPerms) && !parsedPerms.includes("/lubrificacao")) parsedPerms.push("/lubrificacao");

          setProfile(parsedProfile);
          setPermissions(parsedPerms);
          setLoading(false);
          skipLoading = true;
          currentProfile = parsedProfile;

          if (!force) {
            syncWithDatabase(u, isMasterAdmin, currentProfile);
            return;
          }
        } catch (e) {
          console.warn("[Auth] Erro ao ler cache");
        }
      }
    }

    if (!skipLoading && !silentBackground) setLoading(true);
    await syncWithDatabase(u, isMasterAdmin, currentProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const syncWithDatabase = async (u: any, isMasterAdmin: boolean, currentProfile: Profile) => {
    let profileData: any = null;
    let allPerms: any[] = [];

    try {
      const dbPromise = Promise.all([
        supabase.from("profiles").select("id, full_name, role, avatar_url, filial_id, status, filiais(nome)").eq("id", u.id).maybeSingle(),
        supabase.from("role_permissions").select("role, allowed_tabs"),
      ]);
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout de 5 segundos ao conectar ao banco")), 5000));
      const [profileRes, permRes]: any = await Promise.race([dbPromise, timeoutPromise]);

      if (profileRes && !profileRes.error) profileData = profileRes.data;
      if (permRes && !permRes.error) allPerms = permRes.data || [];
    } catch (err) {
      console.warn("[Auth] Erro ou Timeout na sincronização com o Supabase. Usando fallbacks locais:", err);
    }

    // Cadastro autoservido ainda pendente/rejeitado não entra no app de campo — mesma
    // regra que o middleware.ts do app principal aplica em toda rota protegida.
    if (profileData?.status && profileData.status !== "aprovado") {
      console.warn("[Auth] Cadastro não aprovado — encerrando sessão.");
      await signOutInternal();
      return;
    }

    try {
      let finalRole: Profile["role"] =
        (profileData?.role as any) || (u.app_metadata?.role as any) || (u.user_metadata?.role as any) || (isMasterAdmin ? "admin" : "visitante");

      const filialId = (profileData as any)?.filial_id || "MATRIZ";
      const filialNome = (profileData as any)?.filiais?.nome || filialId;

      const finalProfile: Profile = {
        id: u.id,
        email: u.email || "",
        full_name: profileData?.full_name || currentProfile.full_name,
        role: finalRole,
        avatar_url: profileData?.avatar_url || null,
        filial_id: filialId,
        filial_nome: filialNome,
      };

      const rolePerm = allPerms.find((p: any) => p.role === finalRole);
      let finalPerms: string[] = [];
      const allTabs = ["/dashboard", "/os", "/preventivas", "/pneus", "/afiacao", "/lubrificacao", "/backlog", "/programacao-preventiva", "/base-frotas", "/base-dados", "/calendario", "/lavagens", "/captacao", "/documentos", "/checklist-mecanicos", "/admin/usuarios"];
      if (rolePerm?.allowed_tabs && rolePerm.allowed_tabs.length > 0) {
        finalPerms = rolePerm.allowed_tabs.map((t: string) => (t === "/" ? "/dashboard" : t));
      } else {
        if (finalRole === "admin") finalPerms = allTabs;
        else if (finalRole === "visitante") finalPerms = ["/dashboard", "/preventivas", "/backlog", "/calendario", "/documentos"];
        else if (finalRole === "mecanico") finalPerms = ["/dashboard", "/os", "/preventivas", "/pneus", "/afiacao", "/lubrificacao", "/backlog", "/programacao-preventiva", "/calendario", "/captacao", "/documentos", "/checklist-mecanicos"];
        else if (finalRole === "supervisor_manutencao") finalPerms = ["/dashboard", "/os", "/preventivas", "/pneus", "/backlog", "/programacao-preventiva", "/calendario", "/captacao", "/documentos", "/afiacao", "/checklist-mecanicos"];
        else if (finalRole === "motorista") finalPerms = ["/dashboard", "/pneus", "/calendario", "/lavagens", "/captacao", "/documentos"];
        else if (finalRole === "afiador") finalPerms = ["/dashboard", "/afiacao"];
        else if (finalRole === "financeiro") finalPerms = ["/dashboard", "/custos"];
        else finalPerms = allTabs.filter((t) => t !== "/admin/usuarios");
      }

      if (["admin", "pcm", "gestao", "mecanico", "tecnico", "gestor", "supervisor_manutencao"].includes(finalRole) && !finalPerms.includes("/lubrificacao")) {
        finalPerms.push("/lubrificacao");
      }

      setProfile(finalProfile);
      setPermissions(finalPerms);

      if (typeof window !== "undefined") {
        localStorage.setItem(`eunaman_profile_${u.id}`, JSON.stringify(finalProfile));
        localStorage.setItem(`eunaman_perms_${u.id}`, JSON.stringify(finalPerms));
      }
    } catch (err) {
      console.error("[Auth] Erro na sincronização:", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      if (typeof window !== "undefined") localStorage.removeItem(`eunaman_profile_${user.id}`);
      await fetchProfile(user, true, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetchProfile]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      ["eunaman_profile", "supabase.auth.token", "sb-token"].forEach((k) => localStorage.removeItem(k));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout de 5 segundos ao obter sessão")), 5000));
        const { data: { session } }: any = await Promise.race([sessionPromise, timeoutPromise]);

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user, false);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("[Auth] Erro na inicialização:", err);
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) {
        setUser(null);
        setProfile(null);
        setPermissions([]);
        setLoading(false);
        return;
      }

      if (session?.user) {
        const currentUser = session.user;
        if (event === "SIGNED_IN") {
          // BUG no original (components/auth-context.tsx): este branch nunca chama
          // setUser(currentUser) — lá isso é mascarado porque o login de verdade navega
          // pra outra página (remonta o AuthProvider via INITIAL_SESSION, que já seta o
          // user certo). Aqui não há navegação nenhuma, então sem este setUser a tela de
          // login some e volta em branco mesmo com o login tendo funcionado (perfil e
          // permissões chegam a ser salvos no cache, só o estado "user" nunca é setado).
          // Reportar o bug original separadamente, fora do escopo desta fase.
          setUser(currentUser);
          setLoading(true);
          fetchProfile(currentUser, false, true);
        } else if (event === "TOKEN_REFRESHED") {
          setUser(currentUser);
          fetchProfile(currentUser, false, false, true);
        } else if (event === "INITIAL_SESSION") {
          setUser(currentUser);
          fetchProfile(currentUser, false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Fecha a sessão sem o reload pra tela de login (usado internamente quando o cadastro
  // não está aprovado) — a diferença pro signOut público é só essa, pra não forçar uma
  // navegação de URL que não existe neste app.
  const signOutInternal = async () => {
    if (typeof window !== "undefined") { localStorage.clear(); sessionStorage.clear(); }
    setUser(null);
    setProfile(null);
    setPermissions([]);
    try { await supabase.auth.signOut(); } catch (e) { console.warn("[Auth] Erro ao deslogar no cliente:", e); }
  };

  const signOut = async () => {
    try {
      if (typeof window !== "undefined" && (window as any).EunamanApp?.logout) {
        (window as any).EunamanApp.logout();
        return;
      }
      await signOutInternal();
    } catch (err) {
      console.error("[Auth] Erro no signOut:", err);
    }
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  const isVisitante = profile?.role === "visitante";
  const isAdmin = profile?.role?.toLowerCase().trim() === "admin";
  const filialId = profile?.filial_id ?? "MATRIZ";
  const filialNome = profile?.filial_nome ?? "MATRIZ";

  return (
    <AuthContext.Provider value={{ user, profile, loading, isVisitante, signOut, updatePassword, refreshProfile, permissions, filialId, filialNome, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
