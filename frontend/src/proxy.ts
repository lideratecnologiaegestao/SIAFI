import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api', '/_next', '/favicon.ico']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasRefreshToken = request.cookies.has('refresh_token')

  if (isPublicPath(pathname)) {
    if (pathname === '/login' && hasRefreshToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  if (!hasRefreshToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
