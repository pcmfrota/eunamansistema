// Versão mínima pra Fase 0 (prova de conceito) — só confirma que login/sessão
// funcionam offline-first num app embutido. O port completo do components/auth-context.tsx
// do app principal (cache de perfil/permissões, checagem de status aprovado, timeout de
// 5s pra não travar offline) entra quando a Fase 1 precisar de verdade do controle de
// acesso por módulo/cargo.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";

type AuthState = {
  loading: boolean;
  userEmail: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // getSession() lê do localStorage primeiro — funciona mesmo offline, desde que já
    // tenha havido um login online alguma vez (mesma regra do AppSheet: precisa de UMA
    // conexão inicial antes do uso 100% offline).
    supabase.auth.getSession().then(({ data }: any) => {
      setUserEmail(data?.session?.user?.email ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ loading, userEmail, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Não importa LoginScreen aqui de propósito (evitaria um ciclo com AuthProvider, já
// que a tela de login usa useAuth) — quem decide o que renderizar quando !userEmail
// é o App.tsx, que já importa os dois.
export function RequireAuth({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { loading, userEmail } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
        Carregando...
      </div>
    );
  }

  if (!userEmail) return <>{fallback}</>;

  return <>{children}</>;
}
