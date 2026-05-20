import { getSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function getPublicOrigin(request: NextRequest): string {
  // Nginx forwards these headers — use them to reconstruct the public URL
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('host') ?? 'financeiro.lidera.app.br'
  return `${proto}://${host}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const origin = getPublicOrigin(request)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_cancelado`)
  }

  if (code) {
    const supabase = await getSupabaseServerClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_falhou`)
}
