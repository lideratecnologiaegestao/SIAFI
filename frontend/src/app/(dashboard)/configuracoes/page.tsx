'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw, Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'

interface Setting { chave: string; valor: string }
type SettingsMap = Record<string, string>

const SETTING_GROUPS = [
  {
    title: 'Informações do Sistema',
    keys: [
      { key: 'app_name', label: 'Nome do Sistema', placeholder: 'SIAFI' },
      { key: 'app_url', label: 'URL do Sistema', placeholder: 'https://financeiro.lidera.app.br' },
      { key: 'empresa_nome', label: 'Nome da Empresa', placeholder: 'Lidera' },
      { key: 'empresa_email', label: 'E-mail de Contato', placeholder: 'contato@empresa.com' },
    ],
  },
  {
    title: 'WhatsApp (Evolution API)',
    keys: [
      { key: 'whatsapp_api_url', label: 'URL da API', placeholder: 'https://evolution.api.com' },
      { key: 'whatsapp_api_key', label: 'API Key', placeholder: 'sua-api-key' },
      { key: 'whatsapp_instance', label: 'Instância', placeholder: 'nome-instancia' },
    ],
  },
  {
    title: 'Mercado Pago',
    keys: [
      { key: 'mp_access_token', label: 'Access Token', placeholder: 'APP_USR-...' },
      { key: 'mp_webhook_secret', label: 'Webhook Secret', placeholder: 'secret' },
    ],
  },
  {
    title: 'E-mail (SMTP)',
    keys: [
      { key: 'mail_host', label: 'Servidor SMTP', placeholder: 'smtp.gmail.com' },
      { key: 'mail_port', label: 'Porta', placeholder: '587' },
      { key: 'mail_user', label: 'Usuário', placeholder: 'email@gmail.com' },
      { key: 'mail_pass', label: 'Senha', placeholder: '••••••••' },
      { key: 'mail_from_name', label: 'Nome do Remetente', placeholder: 'SIAFI' },
    ],
  },
  {
    title: 'Configurações de Empréstimo',
    keys: [
      { key: 'taxa_juros_padrao', label: 'Taxa de Juros Padrão (%)', placeholder: '5' },
      { key: 'modo_taxa_padrao', label: 'Modalidade Padrão', placeholder: 'mensal' },
      { key: 'dias_tolerancia', label: 'Dias de Tolerância para Atraso', placeholder: '0' },
    ],
  },
]

export default function ConfiguracoesPage() {
  const qc = useQueryClient()
  const [values, setValues] = useState<SettingsMap>({})
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Setting[]>('/settings').then((r) => r.data),
  })

  useEffect(() => {
    if (data) {
      const map: SettingsMap = {}
      data.forEach((s) => { map[s.chave] = s.valor })
      setValues(map)
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings', { entries: Object.entries(values).map(([chave, valor]) => ({ chave, valor })) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Settings className="size-6" />Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Parâmetros do sistema</p>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2">
          <Save className="size-4" />{mutation.isPending ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configurações'}
        </Button>
      </div>

      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          Configurações salvas com sucesso!
        </div>
      )}

      {mutation.isError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Erro ao salvar configurações.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
      ) : (
        SETTING_GROUPS.map((group) => (
          <Card key={group.title}>
            <CardHeader><CardTitle className="text-base">{group.title}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.keys.map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <Label htmlFor={item.key}>{item.label}</Label>
                  <Input
                    id={item.key}
                    type={item.key.includes('pass') || item.key.includes('secret') || item.key.includes('token') ? 'password' : 'text'}
                    placeholder={item.placeholder}
                    value={values[item.key] ?? ''}
                    onChange={(e) => handleChange(item.key, e.target.value)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
