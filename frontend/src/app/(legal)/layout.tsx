import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="SIAFI" width={100} height={32} className="object-contain h-8 w-auto" />
          </Link>
          <span className="text-xs text-muted-foreground">Lidera Tecnologia e Gestão Ltda</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10">{children}</main>
      <footer className="border-t bg-white mt-10">
        <div className="max-w-3xl mx-auto px-4 py-4 text-xs text-muted-foreground flex flex-wrap gap-4">
          <Link href="/termos-de-uso" className="hover:underline">Termos de Uso</Link>
          <Link href="/politica-de-privacidade" className="hover:underline">Política de Privacidade</Link>
          <Link href="/politica-de-cookies" className="hover:underline">Política de Cookies</Link>
          <span className="ml-auto">© {new Date().getFullYear()} Lidera. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  )
}
