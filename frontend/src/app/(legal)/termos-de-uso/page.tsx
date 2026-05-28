import { LegalPage } from '@/components/lgpd/legal-page'
import { VERSAO, DATA_VIGENCIA, SECTIONS } from '@/lib/legal/termos-de-uso'

export const metadata = { title: 'Termos de Uso — SIAFI' }

export default function TermosDeUsoPage() {
  return (
    <LegalPage
      titulo="Termos de Uso"
      versao={VERSAO}
      dataVigencia={DATA_VIGENCIA}
      sections={SECTIONS}
    />
  )
}
