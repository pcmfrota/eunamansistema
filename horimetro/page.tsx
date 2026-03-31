import { createClient } from '@/utils/supabase/server'
import { Clipboard, Clock } from 'lucide-react'
import HorimetroForm from './HorimetroForm'

export default async function HorimetroPage() {
  const supabase = createClient()

  // Buscar equipamentos para o dropdown do form
  const { data: equipamentos } = await supabase
    .from('equipamentos')
    .select('id, placa, modelo')

  // Buscar o histórico recente de apontamentos
  const { data: historico } = await supabase
    .from('horimetros')
    .select('*, equipamentos(placa, modelo)')
    .order('data_referencia', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="p-4 md:p-8 flex flex-col gap-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded-lg">
          <Clipboard size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registro de Horímetro</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Apontamento diário de horas trabalhadas por equipamento e integrações com PCM.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Lado Esquerdo: Formulário */}
        <div className="lg:col-span-3">
          <HorimetroForm equipamentos={equipamentos || []} />
        </div>

        {/* Lado Direito: Histórico de Apontamentos Recentes */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock size={18} className="text-zinc-500" />
              Últimos Registros
            </h2>
            
            <div className="flex flex-col gap-4">
              {historico?.map((reg) => (
                <div key={reg.id} className="bg-white dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-sm bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                      {reg.equipamentos?.placa || 'Desconhecido'}
                    </span>
                    <span className="text-xs text-zinc-500 font-medium">
                      {(() => {
                        if (!reg.data_referencia) return "-";
                        const clean = reg.data_referencia.slice(0, 16);
                        const parts = clean.split('T')[0].split('-');
                        return `${parts[2]}/${parts[1]}/${parts[0]}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-1">
                    <div className="flex flex-col">
                      <span className="text-xs text-zinc-500">Inicial</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{reg.horimetro_inicial}h</span>
                    </div>
                    <div className="text-zinc-300 dark:text-zinc-700">→</div>
                    <div className="flex flex-col text-right">
                      <span className="text-xs text-zinc-500">Final</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">{reg.horimetro_final}h</span>
                    </div>
                  </div>
                  {(reg.horimetro_final - reg.horimetro_inicial > 0) && (
                    <div className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 flex justify-center rounded">
                      + {(reg.horimetro_final - reg.horimetro_inicial).toFixed(1)} hrs trabalhadas
                    </div>
                  )}
                </div>
              ))}

              {(!historico || historico.length === 0) && (
                <p className="text-sm text-zinc-500 text-center py-4">Nenhum registro encontrado ainda.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
