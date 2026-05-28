import type { LegalSection } from '@/lib/legal/termos-de-uso'

interface LegalPageProps {
  titulo: string
  versao: string
  dataVigencia: string
  sections: LegalSection[]
}

export function LegalPage({ titulo, versao, dataVigencia, sections }: LegalPageProps) {
  return (
    <article className="prose prose-sm max-w-none">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">{titulo}</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Versão {versao} · Vigência: {dataVigencia} · Lidera Tecnologia e Gestão Ltda
      </p>
      <hr className="mb-8" />
      {sections.map((s) => (
        <section key={s.titulo} className="mb-8">
          <h2 className="text-base font-semibold text-gray-800 mb-3">{s.titulo}</h2>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{s.conteudo}</div>
        </section>
      ))}
    </article>
  )
}
