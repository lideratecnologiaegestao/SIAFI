export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-700 to-blue-900 flex-col items-center justify-center p-12 text-white">
        <div className="max-w-md text-center">
          <div className="mb-6">
            <span className="text-5xl font-bold tracking-tight">SIAFI</span>
          </div>
          <p className="text-lg font-medium text-blue-100 mb-2">
            Sistema Integrado de Apoio Financeiro
          </p>
          <p className="text-sm text-blue-200">
            Gestão financeira inteligente para sua empresa
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4 text-left">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-100">Controle total</p>
              <p className="text-xs text-blue-200 mt-1">Empréstimos, parcelas e pagamentos em um só lugar</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-100">Relatórios</p>
              <p className="text-xs text-blue-200 mt-1">Análises financeiras detalhadas em tempo real</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-100">Seguro</p>
              <p className="text-xs text-blue-200 mt-1">Acesso por perfis com auditoria completa</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-100">Conciliação</p>
              <p className="text-xs text-blue-200 mt-1">Integração com Mercado Pago e PIX</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        {children}
      </div>
    </div>
  )
}
