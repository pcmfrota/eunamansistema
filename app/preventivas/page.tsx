import { createClient } from '@/utils/supabase/server'
import { Gauge, ShieldAlert } from 'lucide-react'
import NovaPreventivaModal from './NovoModal'
import ControleHorimetrosTabs from './ControleHorimetrosTabs'

export default async function ControleHorimetrosPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  const isVisitante = profile?.role === 'visitante'

  const { data: equipamentos } = await supabase
    .from('equipamentos')
    .select('*, horimetros(horimetro_final)')

  const eqTransformados = equipamentos?.map(eq => {
    let lastH = 0;
    if (eq.horimetros && eq.horimetros.length > 0) {
      lastH = Math.max(...eq.horimetros.map((h: any) => h.horimetro_final));
    }
    return {
      id: eq.id,
      placa: eq.placa,
      modelo: eq.modelo || "",
      tipo: eq.tipo,
      modulo: eq.modulo,
      categoria: eq.categoria,
      ultimoHist: lastH > 0 ? lastH : (eq.horimetro || 0)
    }
  }) || [];

  const { data: preventivas } = await supabase
    .from('preventivas')
    .select('*, equipamentos(placa, tipo, categoria, modulo)')
    .order('data_atualizacao', { ascending: false })

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-[90rem] mx-auto w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-lg shadow-sm">
            <Gauge size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
              Controle de Horímetros
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
              Pesados (500h) • Leves (10.000 km) • Implemento Zocar (100/500/1.000h)
            </p>
          </div>
        </div>

        {!isVisitante ? (
          <NovaPreventivaModal equipamentos={eqTransformados} />
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 rounded-lg text-sm border border-amber-200 dark:border-amber-900/30 font-semibold shadow-sm">
            <ShieldAlert size={16} />
            <span>Acesso Restrito: Visualização</span>
          </div>
        )}
      </div>

      <ControleHorimetrosTabs data={preventivas || []} isVisitante={isVisitante} />
    </div>
  )
}
