import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// --- Configuração de Permissões (Point #5 do Blueprint) ---
const MODULO_PERMISSOES: Record<string, string[]> = {
  '/base-frotas': ['admin', 'gestor'],
  '/usuarios': ['admin'],
  '/pcm': ['admin', 'gestor', 'tecnico'],
  '/preventivas': ['admin', 'gestor', 'tecnico', 'visitante'],
  '/os': ['admin', 'gestor', 'tecnico', 'visitante'],
  '/pneus': ['admin', 'gestor', 'tecnico', 'visitante'],
  '/horimetro': ['admin', 'gestor', 'tecnico', 'visitante'],
  '/backlog': ['admin', 'gestor', 'tecnico', 'visitante'],
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // 1. Redirecionamento Base (Login / Auth)
  if (!user && !pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // 2. Controle de Autorização por Módulo (Point #5)
  if (user) {
    const userRole = (user.user_metadata?.role || 'visitante').toLowerCase()
    
    // Verifica se a rota atual está no mapa de permissões
    const moduloBase = Object.keys(MODULO_PERMISSOES).find(route => pathname.startsWith(route))
    
    if (moduloBase) {
      const rolesPermitidos = MODULO_PERMISSOES[moduloBase]
      if (!rolesPermitidos.includes(userRole)) {
        // Redireciona para unauthorized ou home com aviso
        const url = request.nextUrl.clone()
        url.pathname = '/'
        // Poderíamos adicionar um searchParam ?error=unauthorized
        return NextResponse.redirect(url)
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

