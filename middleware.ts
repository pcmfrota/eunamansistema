import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Sistema de uso interno — autenticação desativada
  // Libera todas as rotas diretamente, sem redirect para /login
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
