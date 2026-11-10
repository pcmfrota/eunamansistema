import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// ── Rotas públicas que não precisam de auth ────────────────────────────────────
const PUBLIC_PATHS = ['/login', '/api/', '/manifest.json', '/sw.js', '/offline.html', '/privacidade']

// Rotas sempre permitidas para qualquer autenticado ativo, além do que está em
// user_module_permissions (mesma lista usada no lib/modulos.ts do lado cliente).
const ROTAS_SEMPRE_PERMITIDAS = ['/', '/perfil']

// O middleware roda em TODA navegação do app (quase todas as rotas, ver `matcher` abaixo)
// — sem isso, uma chamada ao Supabase que trava (banco lento/instável) trava a navegação
// inteira em silêncio: o usuário clica num card e nada acontece, sem nenhum erro visível
// (foi exatamente o que aconteceu durante a instabilidade do Supabase). Mesmo raciocínio
// de timeout já usado em app/login/page.tsx e components/auth-context.tsx.
function comTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout de ${ms}ms`)), ms)
  )
  return Promise.race([Promise.resolve(promise), timeout])
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const pathname = request.nextUrl.pathname

  // Ignora rotas de API internas e arquivos estáticos
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  let session: { user: any } | null = null
  let sessaoTimeout = false
  try {
    const result = await comTimeout(supabase.auth.getSession(), 4000)
    session = result.data.session
  } catch {
    sessaoTimeout = true
  }
  const user = session?.user

  // 1. Redireciona não-autenticados para login e limpa o cookie
  if (!user) {
    // Supabase lento/instável (sessaoTimeout): se já existe um cookie de role de uma sessão
    // válida recente, segue com ele (pulando a checagem de sessão) em vez de forçar logout
    // de alguém que já estava autenticado — evita derrubar todo mundo do sistema por causa
    // de uma instabilidade passageira do banco (mesmo raciocínio de app/login/page.tsx).
    const roleCookieFallback = request.cookies.get('x-user-role')?.value
    const podeUsarCache = sessaoTimeout && !!roleCookieFallback && pathname !== '/login'

    if (!podeUsarCache) {
      if (pathname === '/login') {
        response.cookies.delete('x-user-role')
        return response
      }
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const redirectResponse = NextResponse.redirect(url)
      redirectResponse.cookies.delete('x-user-role')
      return redirectResponse
    }
    // podeUsarCache === true: segue adiante tratando como autenticado via cookie em cache
    // (passos 3+ abaixo já sabem lidar com `user` nulo nesse caso).
  }

  // 2. Autenticado tentando acessar login → redireciona para home
  if (pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // 3. Determina role e filial — usa metadata (sem query extra ao banco)
  let userRole = 'visitante'
  let userFilial = 'MATRIZ'
  if (!user) {
    // Sessão deu timeout mas já tem cookie de role em cache (ver passo 1) — usa ele direto,
    // sem tentar o banco de novo (também travaria do mesmo jeito).
    userRole = request.cookies.get('x-user-role')!.value
    const filialCookie = request.cookies.get('x-user-filial')?.value
    if (filialCookie) userFilial = filialCookie
  } else if (user.email?.includes('marcos.rocha')) {
    userRole = 'admin'
  } else {
    const metaRole = user.app_metadata?.role || user.user_metadata?.role
    if (metaRole) {
      userRole = String(metaRole).toLowerCase()
      // Lê filial do cookie se disponível
      const filialCookie = request.cookies.get('x-user-filial')?.value
      if (filialCookie) userFilial = filialCookie
    } else {
      // Fallback ao banco apenas se não há metadata (cache via cookie de role evita isso)
      const roleCookie = request.cookies.get('x-user-role')?.value
      const filialCookie = request.cookies.get('x-user-filial')?.value
      if (roleCookie) {
        userRole = roleCookie
        if (filialCookie) userFilial = filialCookie
      } else {
        try {
          const { data: profile } = await comTimeout(
            supabase
              .from('profiles')
              .select('role, filial_id, status')
              .eq('id', user.id)
              .single(),
            4000
          )

          // Reforço: cadastro autoservido (status pendente/rejeitado) não navega em nenhuma
          // rota protegida, mesmo com uma sessão do Supabase Auth válida — a tela de login
          // já desloga nesse caso, isso aqui é só o cinto de segurança caso já exista sessão.
          if (profile?.status && profile.status !== 'aprovado') {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            const redirectResponse = NextResponse.redirect(url)
            redirectResponse.cookies.delete('x-user-role')
            redirectResponse.cookies.delete('x-user-permissions')
            return redirectResponse
          }

          if (profile?.role) {
            userRole = profile.role.toLowerCase()
            userFilial = profile.filial_id || 'MATRIZ'
            // Salva role e filial em cookie leve (1h) para evitar query repetida
            response.cookies.set('x-user-role', userRole, {
              maxAge: 3600, httpOnly: true, sameSite: 'lax', path: '/',
            })
            response.cookies.set('x-user-filial', userFilial, {
              maxAge: 3600, httpOnly: false, sameSite: 'lax', path: '/',
            })
          }
        } catch {
          // Timeout ou erro real do banco: mantém defaults (visitante/MATRIZ) em vez de
          // travar a navegação esperando uma resposta que pode nunca chegar.
        }
      }
    }
  }

  // 4. Normaliza role: qualquer variante de 'admin' ou 'administrador' vira 'admin'
  if (userRole === 'administrador') userRole = 'admin'

  // Duração curta de propósito (era 1h) — isso é o que faz um bloqueio de usuário (camada 1/2)
  // valer rápido mesmo sem reload manual, complementando o bloqueio imediato de verdade que
  // já acontece na camada 3 (RLS: user_is_active()/user_has_module() são avaliadas a cada
  // consulta real ao banco, não dependem de cookie).
  const COOKIE_MAX_AGE = 300

  // 5. Verifica autorização na rota via permissões INDIVIDUAIS do usuário
  // (user_module_permissions — substitui o antigo role_permissions por cargo).
  let userPerms: string[] = []
  const currentRoleCookie = request.cookies.get('x-user-role')?.value;
  // Só usa o cookie se o cargo não mudou nesta requisição
  const permsCookie = currentRoleCookie === userRole ? request.cookies.get('x-user-permissions')?.value : null

  if (permsCookie) {
    userPerms = permsCookie.split(',').filter(Boolean)
  } else if (userRole !== 'admin' && user) {
    try {
      const { data: perms } = await comTimeout(
        supabase
          .from('user_module_permissions')
          .select('modulo')
          .eq('user_id', user.id),
        4000
      )

      userPerms = (perms || []).map((p: any) => p.modulo)
      response.cookies.set('x-user-permissions', userPerms.join(','), {
        maxAge: COOKIE_MAX_AGE, httpOnly: false, sameSite: 'lax', path: '/',
      })
    } catch {
      // Timeout/erro de conexão: nenhum fallback hardcoded por cargo (ficaria sempre
      // desatualizado em relação a permissões por indivíduo) — falha fechado, só as
      // rotas sempre permitidas ficam acessíveis até a próxima requisição conseguir
      // consultar o banco.
      userPerms = []
    }
  }

  // Se for admin, pula verificação de rotas (acesso total)
  if (userRole !== 'admin') {
    const isPublicOrProfile = ROTAS_SEMPRE_PERMITIDAS.some(route => pathname === route || pathname.startsWith('/perfil'));

    if (!isPublicOrProfile) {
      // Verifica se a rota requisitada começa com alguma das rotas permitidas do usuário
      const hasAccess = userPerms.some(allowedRoute => {
        if (allowedRoute === '/') return pathname === '/';
        return pathname.startsWith(allowedRoute);
      });

      if (!hasAccess) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    }
  }

  // Sincroniza os cookies x-user-role, x-user-filial e limpa/atualiza permissões se mudou o cargo
  if (currentRoleCookie !== userRole) {
    response.cookies.set('x-user-role', userRole, {
      maxAge: COOKIE_MAX_AGE, httpOnly: true, sameSite: 'lax', path: '/',
    })
    // Força limpeza do cookie de permissões antigas
    response.cookies.delete('x-user-permissions')
  }
  const currentFilialCookie = request.cookies.get('x-user-filial')?.value;
  if (currentFilialCookie !== userFilial) {
    response.cookies.set('x-user-filial', userFilial, {
      maxAge: COOKIE_MAX_AGE, httpOnly: false, sameSite: 'lax', path: '/',
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
