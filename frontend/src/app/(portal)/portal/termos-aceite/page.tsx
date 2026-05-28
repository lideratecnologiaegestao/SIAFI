'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { portalApi } from '@/lib/portal/portal-api'
import { SECTIONS as TERMOS_SECTIONS, VERSAO as TERMOS_VERSAO } from '@/lib/legal/termos-de-uso'
import { SECTIONS as POLITICA_SECTIONS, VERSAO as POLITICA_VERSAO } from '@/lib/legal/politica-de-privacidade'

function DocViewer({ sections }: { sections: Array<{ titulo: string; conteudo: string }> }) {
  return (
    <div style={{
      height: '260px',
      overflowY: 'auto',
      border: '1px solid var(--portal-gray-300)',
      borderRadius: '8px',
      padding: '14px 16px',
      background: 'var(--portal-gray-100)',
      fontSize: '12px',
      lineHeight: 1.7,
      color: 'var(--portal-gray-700)',
    }}>
      {sections.map((s) => (
        <div key={s.titulo} style={{ marginBottom: '14px' }}>
          <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--portal-gray-900)' }}>
            {s.titulo}
          </strong>
          <span style={{ whiteSpace: 'pre-wrap' }}>{s.conteudo}</span>
        </div>
      ))}
    </div>
  )
}

export default function TermosAceitePage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [termosAceito, setTermosAceito] = useState(false)
  const [politicaAceita, setPoliticaAceita] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'termos' | 'politica'>('termos')

  async function handleContinuar() {
    if (!termosAceito || !politicaAceita) return
    setLoading(true)
    try {
      await Promise.all([
        portalApi.registrarConsentimento({ tipo: 'termos_uso', versao: TERMOS_VERSAO, aceito: true }),
        portalApi.registrarConsentimento({ tipo: 'politica_privacidade', versao: POLITICA_VERSAO, aceito: true }),
      ])
      await portalApi.marcarPrimeiroAcesso()
      qc.setQueryData(['portal-perfil-layout'], (old: any) =>
        old ? { ...old, primeiroAcesso: false } : old,
      )
      router.replace('/portal')
    } catch {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--portal-gray-100)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: 'var(--portal-white)',
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0,0,0,.08)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0', textAlign: 'center' }}>
          <Image src="/logo.png" alt="SIAFI" width={120} height={36} className="object-contain mx-auto mb-4" style={{ height: '36px', width: 'auto' }} />
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--portal-blue-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <ShieldCheck size={28} color="var(--portal-blue-600)" />
          </div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)', marginBottom: '4px' }}>
            Antes de continuar
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)', marginBottom: '20px' }}>
            Para usar o portal, leia e aceite os documentos abaixo.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--portal-gray-200)', padding: '0 24px' }}>
          {(['termos', 'politica'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? 'var(--portal-blue-600)' : 'var(--portal-gray-600)',
                borderBottom: activeTab === tab ? '2px solid var(--portal-blue-600)' : '2px solid transparent',
                marginBottom: '-1px',
                background: 'none',
                border: 'none',
                borderBottomWidth: '2px',
                borderBottomStyle: 'solid',
                borderBottomColor: activeTab === tab ? 'var(--portal-blue-600)' : 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans, sans-serif)',
              }}
            >
              {tab === 'termos' ? 'Termos de Uso' : 'Política de Privacidade'}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div style={{ padding: '16px 24px 24px' }}>
          {activeTab === 'termos' ? (
            <DocViewer sections={TERMOS_SECTIONS} />
          ) : (
            <DocViewer sections={POLITICA_SECTIONS} />
          )}

          {/* Checkboxes */}
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={termosAceito}
                onChange={(e) => setTermosAceito(e.target.checked)}
                style={{ width: '16px', height: '16px', marginTop: '2px', flexShrink: 0, accentColor: 'var(--portal-blue-600)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--portal-gray-700)', fontFamily: 'var(--font-dm-sans, sans-serif)', lineHeight: 1.5 }}>
                Li e aceito os <strong>Termos de Uso</strong> (versão {TERMOS_VERSAO})
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={politicaAceita}
                onChange={(e) => setPoliticaAceita(e.target.checked)}
                style={{ width: '16px', height: '16px', marginTop: '2px', flexShrink: 0, accentColor: 'var(--portal-blue-600)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--portal-gray-700)', fontFamily: 'var(--font-dm-sans, sans-serif)', lineHeight: 1.5 }}>
                Li e aceito a <strong>Política de Privacidade</strong> (versão {POLITICA_VERSAO})
              </span>
            </label>
          </div>

          {/* Botão */}
          <button
            onClick={handleContinuar}
            disabled={!termosAceito || !politicaAceita || loading}
            style={{
              marginTop: '20px',
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              background: termosAceito && politicaAceita ? 'var(--portal-blue-600)' : 'var(--portal-gray-300)',
              color: termosAceito && politicaAceita ? '#fff' : 'var(--portal-gray-500)',
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: 'var(--font-dm-sans, sans-serif)',
              cursor: termosAceito && politicaAceita && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 200ms ease',
            }}
          >
            {loading && <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />}
            {loading ? 'Registrando...' : 'Continuar →'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--portal-gray-500)', marginTop: '12px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
            Versão dos documentos: {TERMOS_VERSAO} · {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  )
}
