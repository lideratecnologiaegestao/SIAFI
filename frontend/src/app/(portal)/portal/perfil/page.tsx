'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Loader2, ShieldCheck, ShieldAlert, Bell, KeyRound, Eye, EyeOff, LogOut, User } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { portalApi } from '@/lib/portal/portal-api'
import { formatCPF, formatPhone } from '@/lib/utils'
import { ScoreIndicatorLight } from '@/components/portal/score-indicator'
import { SkeletonLine } from '@/components/portal/skeleton-card'

const senhaSchema = z.object({
  atual: z.string().min(1, 'Informe a senha atual'),
  nova: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Precisa de letra maiúscula')
    .regex(/[0-9]/, 'Precisa de número')
    .regex(/[^A-Za-z0-9]/, 'Precisa de caractere especial'),
  confirmar: z.string(),
}).refine(d => d.nova === d.confirmar, { message: 'Senhas não coincidem', path: ['confirmar'] })

type SenhaForm = z.infer<typeof senhaSchema>

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  color: 'var(--portal-gray-950)',
  fontFamily: 'var(--font-dm-sans, sans-serif)',
  marginBottom: '14px',
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--portal-gray-600)',
  fontFamily: 'var(--font-dm-sans, sans-serif)',
  marginBottom: '2px',
}

const fieldValueStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--portal-gray-950)',
  fontFamily: 'var(--font-dm-sans, sans-serif)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: '8px',
  border: '1px solid var(--portal-gray-300)',
  background: 'var(--portal-white)',
  fontSize: '14px',
  fontFamily: 'var(--font-dm-sans, sans-serif)',
  color: 'var(--portal-gray-950)',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function PerfilPage() {
  const qc = useQueryClient()
  const [senhaOk, setSenhaOk] = useState(false)
  const [senhaErro, setSenhaErro] = useState<string | null>(null)
  const [showAtual, setShowAtual] = useState(false)
  const [showNova, setShowNova] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'perfil'],
    queryFn: portalApi.getPerfil,
    staleTime: 60_000,
  })

  const notifMutation = useMutation({
    mutationFn: (body: { notificacoesEmail?: boolean; notificacoesWhatsapp?: boolean }) =>
      portalApi.updateNotificacoes(body),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['portal', 'perfil'] })
      const prev = qc.getQueryData(['portal', 'perfil'])
      qc.setQueryData(['portal', 'perfil'], (old: any) => old ? { ...old, ...vars } : old)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['portal', 'perfil'], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['portal', 'perfil'] }),
  })

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<SenhaForm>({
    resolver: zodResolver(senhaSchema) as any,
  })

  async function onTrocarSenha(formData: SenhaForm) {
    setSenhaErro(null)
    setSenhaOk(false)
    try {
      const supabase = getSupabaseBrowserClient()
      if (!data?.email) throw new Error('Email não encontrado.')
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: data.email, password: formData.atual })
      if (signInErr) throw new Error('Senha atual incorreta.')
      const { error: updateErr } = await supabase.auth.updateUser({ password: formData.nova })
      if (updateErr) throw new Error(updateErr.message)
      reset()
      setSenhaOk(true)
    } catch (e: any) {
      setSenhaErro(e?.message ?? 'Erro ao trocar senha.')
    }
  }

  if (isLoading) {
    return (
      <div className="portal-page" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <SkeletonLine width="160px" height="28px" />
        <div className="pcard" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <SkeletonLine width="80px" height="80px" />
          </div>
          {[1, 2, 3].map(i => <SkeletonLine key={i} height="14px" />)}
        </div>
      </div>
    )
  }

  if (!data) return null

  const mfaRestantes = Math.max(0, 5 - data.mfaLoginCount)
  const inicialNome = data.nome ? data.nome[0].toUpperCase() : 'U'

  function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
    return (
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '999px',
          border: 'none',
          background: 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          position: 'relative',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        <span style={{
          display: 'block',
          width: '44px',
          height: '26px',
          borderRadius: '999px',
          background: checked ? 'var(--portal-blue-600)' : 'var(--portal-gray-300)',
          transition: 'background 200ms ease',
          position: 'relative',
          flexShrink: 0,
        }}>
          <span style={{
            position: 'absolute',
            top: '3px',
            left: checked ? '21px' : '3px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,.2)',
            transition: 'left 200ms ease',
          }} />
        </span>
      </button>
    )
  }

  return (
    <div className="portal-page" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
        Meu Perfil
      </h1>

      {/* ── Dados pessoais ──────────────────────────────── */}
      <div className="pcard" style={{ padding: '24px' }}>
        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'var(--portal-blue-600)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(27,79,216,.3)',
          }}>
            <span style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#fff',
              fontFamily: 'var(--font-dm-serif, serif)',
              lineHeight: 1,
            }}>
              {inicialNome}
            </span>
          </div>
          <p style={{ fontWeight: 700, fontSize: '16px', color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
            {data.nome}
          </p>
        </div>

        {/* Grid de dados */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <p style={fieldLabelStyle}>CPF</p>
            <p style={fieldValueStyle}>{data.cpf ? formatCPF(data.cpf) : '—'}</p>
          </div>
          <div>
            <p style={fieldLabelStyle}>WhatsApp</p>
            <p style={fieldValueStyle}>{data.whatsapp ? formatPhone(data.whatsapp) : '—'}</p>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <p style={fieldLabelStyle}>E-mail</p>
            <p style={{ ...fieldValueStyle, wordBreak: 'break-all' }}>{data.email || '—'}</p>
          </div>
          {data.cidade && (
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={fieldLabelStyle}>Localidade</p>
              <p style={fieldValueStyle}>{[data.cidade, data.estado].filter(Boolean).join(' — ')}</p>
            </div>
          )}
        </div>

        <div style={{
          padding: '10px 12px',
          borderRadius: '8px',
          background: 'var(--portal-amber-100)',
          border: '1px solid var(--portal-amber-600)',
          fontSize: '12px',
          color: 'var(--portal-amber-600)',
          fontFamily: 'var(--font-dm-sans, sans-serif)',
          lineHeight: 1.5,
        }}>
          Para alterar seus dados, entre em contato pelo{' '}
          <Link href="/portal/suporte/novo" style={{ color: 'var(--portal-amber-600)', fontWeight: 700 }}>
            suporte
          </Link>.
        </div>
      </div>

      {/* ── Score de pontualidade ──────────────────────── */}
      {data.score !== undefined && (
        <div className="pcard" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={sectionTitleStyle}>Score de pontualidade</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ScoreIndicatorLight score={data.score} />
            <span style={{ fontSize: '14px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
              {data.score}/100
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { icon: '✅', text: 'Parcelas pagas no prazo: +5 pts' },
              { icon: '✅', text: 'Contratos quitados: +10 pts' },
              { icon: '⚠️', text: 'Parcelas atrasadas: −3 pts' },
              { icon: '⚠️', text: 'Reparcelamentos: −5 pts' },
            ].map(row => (
              <div key={row.text} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px' }}>{row.icon}</span>
                <p style={{ fontSize: '12px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                  {row.text}
                </p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: '12px', color: 'var(--portal-blue-600)', fontFamily: 'var(--font-dm-sans, sans-serif)', fontStyle: 'italic' }}>
            Pague em dia para manter seu score alto e ter prioridade em novos empréstimos.
          </p>
        </div>
      )}

      {/* ── Notificações ──────────────────────────────── */}
      <div className="pcard" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Bell size={18} color="var(--portal-gray-950)" />
          <p style={sectionTitleStyle}>Notificações</p>
        </div>

        {[
          {
            label: 'WhatsApp',
            desc: 'Lembretes de vencimento e confirmações',
            checked: data.notificacoesWhatsapp,
            onChange: () => notifMutation.mutate({ notificacoesWhatsapp: !data.notificacoesWhatsapp }),
          },
          {
            label: 'E-mail',
            desc: 'Confirmações de pagamento e comunicados',
            checked: data.notificacoesEmail,
            onChange: () => notifMutation.mutate({ notificacoesEmail: !data.notificacoesEmail }),
          },
        ].map(item => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: '1px solid var(--portal-gray-100)',
            }}
          >
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                {item.label}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--portal-gray-600)', fontFamily: 'var(--font-dm-sans, sans-serif)', marginTop: '2px' }}>
                {item.desc}
              </p>
            </div>
            <Toggle checked={item.checked} onChange={item.onChange} disabled={notifMutation.isPending} />
          </div>
        ))}
      </div>

      {/* ── Segurança ─────────────────────────────────── */}
      <div className="pcard" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          {data.mfaEnabled
            ? <ShieldCheck size={18} color="var(--portal-green-600)" />
            : <ShieldAlert size={18} color="var(--portal-amber-600)" />
          }
          <p style={sectionTitleStyle}>Segurança</p>
        </div>

        {/* MFA */}
        <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--portal-gray-100)', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)', marginBottom: '6px' }}>
            Autenticação de dois fatores
          </p>
          {data.mfaEnabled ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="var(--portal-green-600)" />
              <p style={{ fontSize: '13px', color: 'var(--portal-green-600)', fontFamily: 'var(--font-dm-sans, sans-serif)', fontWeight: 500 }}>
                Google Authenticator ativo
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '12px', color: 'var(--portal-amber-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                ⚠️ Não configurado. Você tem {mfaRestantes} acesso(s) antes de se tornar obrigatório.
              </p>
              <Link href="/portal/mfa-setup" style={{ textDecoration: 'none', display: 'inline-block', alignSelf: 'flex-start' }}>
                <button style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--portal-amber-600)',
                  background: 'var(--portal-amber-100)',
                  color: 'var(--portal-amber-600)',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-dm-sans, sans-serif)',
                  cursor: 'pointer',
                }}>
                  <ShieldCheck size={14} />
                  Configurar agora
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* Alterar senha */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <KeyRound size={15} color="var(--portal-gray-950)" />
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--portal-gray-950)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
              Alterar senha
            </p>
          </div>

          <form onSubmit={handleSubmit(onTrocarSenha)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { id: 'atual', label: 'Senha atual', show: showAtual, toggle: () => setShowAtual(v => !v), register: register('atual'), error: errors.atual, autocomplete: 'current-password' },
              { id: 'nova', label: 'Nova senha', show: showNova, toggle: () => setShowNova(v => !v), register: register('nova'), error: errors.nova, autocomplete: 'new-password' },
            ].map(field => (
              <div key={field.id}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--portal-gray-800)', fontFamily: 'var(--font-dm-sans, sans-serif)', display: 'block', marginBottom: '5px' }}>
                  {field.label}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={field.show ? 'text' : 'password'}
                    autoComplete={field.autocomplete}
                    placeholder="••••••••"
                    {...field.register}
                    style={{ ...inputStyle, paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={field.toggle}
                    tabIndex={-1}
                    style={{
                      position: 'absolute',
                      right: '4px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--portal-gray-600)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '40px',
                      height: '40px',
                      padding: 0,
                    }}
                  >
                    {field.show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {field.error && (
                  <p style={{ fontSize: '11px', color: 'var(--portal-red-600)', marginTop: '3px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                    {field.error.message}
                  </p>
                )}
              </div>
            ))}

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--portal-gray-800)', fontFamily: 'var(--font-dm-sans, sans-serif)', display: 'block', marginBottom: '5px' }}>
                Confirmar nova senha
              </label>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Repita a nova senha"
                {...register('confirmar')}
                style={inputStyle}
              />
              {errors.confirmar && (
                <p style={{ fontSize: '11px', color: 'var(--portal-red-600)', marginTop: '3px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                  {errors.confirmar.message}
                </p>
              )}
            </div>

            {senhaErro && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--portal-red-100)', border: '1px solid var(--portal-red-600)' }}>
                <p style={{ fontSize: '12px', color: 'var(--portal-red-600)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                  {senhaErro}
                </p>
              </div>
            )}

            {senhaOk && (
              <p style={{ fontSize: '12px', color: 'var(--portal-green-600)', fontWeight: 600, fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
                ✅ Senha alterada com sucesso!
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: isSubmitting ? 'var(--portal-gray-300)' : 'var(--portal-blue-600)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: 'var(--font-dm-sans, sans-serif)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'background 200ms ease',
              }}
            >
              {isSubmitting && <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />}
              Salvar nova senha
            </button>
          </form>
        </div>
      </div>

      {/* Espaço extra para bottom nav */}
      <div style={{ height: '8px' }} />
    </div>
  )
}
