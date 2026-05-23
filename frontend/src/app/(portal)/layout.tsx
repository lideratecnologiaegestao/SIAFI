import { DM_Serif_Display, DM_Sans, JetBrains_Mono } from 'next/font/google'
import '@/styles/portal-variables.css'
import '@/styles/portal-animations.css'
import '@/styles/portal-print.css'
import { PortalAuthProvider } from '@/contexts/portal-auth.context'
import { PortalLayoutContent } from './portal-layout-content'

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dm-serif',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${dmSerifDisplay.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      style={{ fontFamily: 'var(--font-dm-sans, DM Sans, Arial, sans-serif)', minHeight: '100dvh' }}
    >
      <PortalAuthProvider>
        <PortalLayoutContent>{children}</PortalLayoutContent>
      </PortalAuthProvider>
    </div>
  )
}
