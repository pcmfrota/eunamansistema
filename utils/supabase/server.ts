import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const createClient = () => {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      // O Supabase faz suas chamadas via fetch() por baixo dos panos, e o Next.js 14
      // cacheia automaticamente qualquer fetch() GET (é o caso de todo .select()) por
      // tempo indeterminado, mesmo dentro de uma Server Action — sem isso, dashboards
      // e listagens podiam continuar mostrando dados desatualizados do banco mesmo
      // muito tempo depois de um registro mudar, sem nenhum jeito confiável de saber
      // quando os dados exibidos deixaram de refletir o banco real.
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
};
