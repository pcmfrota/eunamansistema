// Shim local do utils/supabase/client.ts do app principal. Duas diferenças de
// propósito em relação ao original:
// 1. Lê import.meta.env.VITE_* em vez de process.env.NEXT_PUBLIC_* (convenção do Vite,
//    não do Next.js). Ver vite.config.ts — o alias "@/utils/supabase/client" redireciona
//    pra este arquivo sempre que um módulo reaproveitado de lib/ importa o caminho original.
// 2. Usa createClient() do @supabase/supabase-js puro, NÃO createBrowserClient() do
//    @supabase/ssr — este último também tenta sincronizar a sessão via COOKIE (pensado
//    pro Next.js ler no servidor), e cookie não funciona direito numa página file://.
//    CONFIRMADO NA FASE 0: com createBrowserClient, o login funcionava mas toda consulta
//    seguinte saía sem o token do usuário (RLS devolvia 0 linhas silenciosamente); trocando
//    pro client puro (sessão só via localStorage, sem depender de cookie) resolveu.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let client: any = null;

export const createClient = () => {
  if (client) return client;

  client = createSupabaseClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // SPA local (file://), não há redirect OAuth por URL
      },
    }
  );

  return client;
};
