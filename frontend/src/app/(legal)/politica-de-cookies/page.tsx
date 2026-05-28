import { LegalPage } from '@/components/lgpd/legal-page'
import { VERSAO, DATA_VIGENCIA, SECTIONS } from '@/lib/legal/politica-de-cookies'

export const metadata = { title: 'Política de Cookies — SIAFI' }

export default function PoliticaCookiesPage() {
  return (
    <LegalPage
      titulo="Política de Cookies"
      versao={VERSAO}
      dataVigencia={DATA_VIGENCIA}
      sections={SECTIONS}
    />
  )
}
