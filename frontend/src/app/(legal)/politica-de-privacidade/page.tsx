import { LegalPage } from '@/components/lgpd/legal-page'
import { VERSAO, DATA_VIGENCIA, SECTIONS } from '@/lib/legal/politica-de-privacidade'

export const metadata = { title: 'Política de Privacidade — SIAFI' }

export default function PoliticaPrivacidadePage() {
  return (
    <LegalPage
      titulo="Política de Privacidade"
      versao={VERSAO}
      dataVigencia={DATA_VIGENCIA}
      sections={SECTIONS}
    />
  )
}
