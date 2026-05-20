import { redirect } from 'next/navigation'

// Handles the case where Supabase redirects OAuth code to the site root
// instead of /auth/callback (happens when the redirect URL isn't in Supabase's allow-list)
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>
}) {
  const params = await searchParams

  if (params.error) {
    redirect(`/login?error=oauth_cancelado`)
  }

  if (params.code) {
    redirect(`/auth/callback?code=${params.code}`)
  }

  redirect('/dashboard')
}
