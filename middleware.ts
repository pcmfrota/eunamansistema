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
}

// ── Rotas públicas que não precisam de auth ────────────────────────────────────
const PUBLIC_PATHS = ['/login', '/api/', '/manifest.json', '/sw.js']

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

  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user

  // 1. Redireciona não-autenticados para login e limpa o cookie
  if (!user) {
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

  // 2. Autenticado tentando acessar login → redireciona para home
  if (pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // 3. Determina role e filial — usa metadata (sem query extra ao banco)
  let userRole = 'visitante'
  let userFilial = 'MATRIZ'
  if (user.email?.includes('marcos.rocha')) {
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
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, filial_id')
            .eq('id', user.id)
            .single()
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
          // mantém defaults
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
      const { data: rolePerm } = await supabase
        .from('role_permissions')
        .select('allowed_tabs')
        .eq('role', userRole)
        .single()
      
      if (rolePerm?.allowed_tabs) {
        userPerms = rolePerm.allowed_tabs.map((t: string) => t === '/' ? '/dashboard' : t)
        response.cookies.set('x-user-permissions', userPerms.join(','), {
          maxAge: 3600, httpOnly: false, sameSite: 'lax', path: '/',
        })
      }
    } catch {
      // Fallbacks locais de segurança se der erro de conexão
      const allTabs = ['/dashboard', '/os', '/preventivas', '/pneus', '/afiacao', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens', '/captacao', '/documentos', '/checklist-mecanicos'];
      if (userRole === 'visitante') userPerms = ['/dashboard', '/preventivas', '/backlog', '/calendario', '/documentos'];
      else if (userRole === 'mecanico') userPerms = ['/dashboard', '/os', '/preventivas', '/pneus', '/afiacao', '/backlog', '/programacao-preventiva', '/calendario', '/captacao', '/documentos', '/checklist-mecanicos'];
      else if (userRole === 'motorista') userPerms = ['/dashboard', '/pneus', '/calendario', '/lavagens', '/captacao', '/documentos'];
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
