import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/mfa-challenge', '/mfa-setup', '/api', '/_next', '/favicon.ico', '/auth']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

function hasActiveSession(request: NextRequest): boolean {
  // NestJS username/password session (httpOnly cookie set by backend after login)
  if (request.cookies.has('refresh_token')) return true
  // Supabase session — Google OAuth (cookie set by /auth/callback route handler)
  return request.cookies.getAll().some((c) => c.name.includes('-auth-token'))
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    if (pathname === '/login' && hasActiveSession(request)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  if (!hasActiveSession(request)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
