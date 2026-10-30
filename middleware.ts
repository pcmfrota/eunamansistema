import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// ── Permissões por módulo ──────────────────────────────────────────────────────
const MODULO_PERMISSOES: Record<string, string[]> = {
  '/admin':                    ['admin'],
  '/base-frotas':              ['admin', 'pcm', 'gestao'],
  '/pcm':                      ['admin', 'pcm'],
  '/preventivas':              ['admin', 'pcm', 'gestao', 'visitante', 'mecanico', 'motorista'],
  '/programacao-preventiva':   ['admin', 'pcm', 'gestao', 'mecanico'],
  '/os':                       ['admin', 'pcm', 'gestao', 'mecanico', 'motorista'],
  '/pneus':                    ['admin', 'pcm', 'gestao', 'mecanico', 'motorista'],
  '/lavagens':                 ['admin', 'pcm', 'gestao', 'mecanico', 'motorista'],
  '/backlog':                  ['admin', 'pcm', 'gestao', 'visitante', 'mecanico', 'motorista'],
  '/base-dados':               ['admin', 'pcm', 'gestao'],
  '/calendario':               ['admin', 'pcm', 'gestao', 'visitante', 'mecanico', 'motorista'],
  '/perfil':                   ['admin', 'pcm', 'gestao', 'visitante', 'mecanico', 'motorista'],
  '/checklist-mecanicos':      ['admin', 'pcm', 'gestao', 'mecanico'],
  '/documentos':               ['admin', 'pcm', 'gestao', 'visitante', 'mecanico', 'motorista'],
  '/controladoria-frota':      ['admin', 'pcm', 'gestao'],
  '/checklist-frota':        ['admin', 'pcm', 'gestao', 'mecanico', 'motorista'],
  '/controle-filtros':       ['admin', 'pcm', 'gestao', 'mecanico', 'supervisor_manutencao'],
}

// ── Rotas públicas que não precisam de auth ────────────────────────────────────
const PUBLIC_PATHS = ['/login', '/api/', '/manifest.json', '/sw.js', '/offline.html', '/privacidade']

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

  // 5. Verifica autorização na rota de forma dinâmica usando banco/cookie de permissões
  let userPerms: string[] = []
  const currentRoleCookie = request.cookies.get('x-user-role')?.value;
  // Só usa o cookie se o cargo não mudou nesta requisição
  const permsCookie = currentRoleCookie === userRole ? request.cookies.get('x-user-permissions')?.value : null

  if (permsCookie) {
    userPerms = permsCookie.split(',')
  } else if (userRole !== 'admin') {
    // Busca do banco se o cookie não estiver presente e não for admin
    try {
      const { data: rolePerm } = await comTimeout(
        supabase
          .from('role_permissions')
          .select('allowed_tabs')
          .eq('role', userRole)
          .single(),
        4000
      )

      if (rolePerm?.allowed_tabs) {
        userPerms = rolePerm.allowed_tabs.map((t: string) => t === '/' ? '/dashboard' : t)
        response.cookies.set('x-user-permissions', userPerms.join(','), {
          maxAge: 3600, httpOnly: false, sameSite: 'lax', path: '/',
        })
      }
    } catch {
      // Fallbacks locais de segurança se der erro de conexão
      const allTabs = ['/dashboard', '/os', '/preventivas', '/pneus', '/afiacao', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens', '/captacao', '/documentos', '/checklist-mecanicos', '/controladoria-frota', '/checklist-frota', '/controle-filtros'];
      if (userRole === 'visitante') userPerms = ['/dashboard', '/preventivas', '/backlog', '/calendario', '/documentos'];
      else if (userRole === 'mecanico') userPerms = ['/dashboard', '/os', '/preventivas', '/pneus', '/afiacao', '/backlog', '/programacao-preventiva', '/calendario', '/captacao', '/documentos', '/checklist-mecanicos', '/checklist-frota', '/controle-filtros'];
      else if (userRole === 'supervisor_manutencao') userPerms = ['/dashboard', '/os', '/preventivas', '/pneus', '/afiacao', '/backlog', '/programacao-preventiva', '/calendario', '/captacao', '/documentos', '/checklist-mecanicos', '/checklist-frota', '/controle-filtros'];
      else if (userRole === 'motorista') userPerms = ['/dashboard', '/pneus', '/calendario', '/lavagens', '/captacao', '/documentos', '/checklist-frota'];
      else if (userRole === 'financeiro') userPerms = ['/dashboard', '/custos'];
      else userPerms = allTabs;
    }
  }

  // Se for admin, pula verificação de rotas (acesso total)
  if (userRole !== 'admin') {
    // Rotas sempre permitidas para qualquer autenticado
    const routesSemprePermitidas = ['/', '/perfil'];
    const isPublicOrProfile = routesSemprePermitidas.some(route => pathname === route || pathname.startsWith('/perfil'));
    
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
      maxAge: 3600, httpOnly: true, sameSite: 'lax', path: '/',
    })
    // Força limpeza do cookie de permissões antigas
    response.cookies.delete('x-user-permissions')
  }
  const currentFilialCookie = request.cookies.get('x-user-filial')?.value;
  if (currentFilialCookie !== userFilial) {
    response.cookies.set('x-user-filial', userFilial, {
      maxAge: 3600, httpOnly: false, sameSite: 'lax', path: '/',
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
