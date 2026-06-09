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

  // 3. Determina role — usa metadata (sem query extra ao banco)
  let userRole = 'visitante'
  if (user.email?.includes('marcos.rocha')) {
    userRole = 'admin'
  } else {
    const metaRole = user.app_metadata?.role || user.user_metadata?.role
    if (metaRole) {
      userRole = String(metaRole).toLowerCase()
    } else {
      // Fallback ao banco apenas se não há metadata (cache via cookie de role evita isso)
      const roleCookie = request.cookies.get('x-user-role')?.value
      if (roleCookie) {
        userRole = roleCookie
      } else {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          if (profile?.role) {
            userRole = profile.role.toLowerCase()
            // Salva role em cookie leve (1h) para evitar query repetida
            response.cookies.set('x-user-role', userRole, {
              maxAge: 3600,
              httpOnly: true,
              sameSite: 'lax',
              path: '/',
            })
          }
        } catch {
          // mantém 'visitante'
        }
      }
    }
  }

  // 4. Verifica autorização na rota
  const moduloBase = Object.keys(MODULO_PERMISSOES).find(route => pathname.startsWith(route))
  if (moduloBase) {
    const rolesPermitidos = MODULO_PERMISSOES[moduloBase]
    if (!rolesPermitidos.includes(userRole)) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // Sincroniza o cookie x-user-role para evitar cookies desatualizados/órfãos
  const currentCookie = request.cookies.get('x-user-role')?.value;
  if (currentCookie !== userRole) {
    response.cookies.set('x-user-role', userRole, {
      maxAge: 3600,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
