import { createClient } from '@/utils/supabase/server'
import { Calendar, ShieldAlert } from 'lucide-react'
import NovaPreventivaModal from './NovoModal'
import PreventivasTable from './PreventivasTable'

export default async function ProgramacaoPreventivaPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  const isVisitante = profile?.role === 'visitante'

  // Buscar todos equipamentos e pre-calcular ultimo horimetro para o dropdown Modal
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
          <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded-lg shadow-sm">
            <Calendar size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Programação Preventiva</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
              Gestão automatizada e alertas de manutenção
            </p>
          </div>
        </div>

        {!isVisitante ? (
          <div className="flex gap-3">
            <NovaPreventivaModal equipamentos={eqTransformados} />
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 rounded-lg text-sm border border-amber-200 dark:border-amber-900/30 font-semibold shadow-sm">
            <ShieldAlert size={16} />
            <span>Acesso Restrito: Visualização</span>
          </div>
        )}
      </div>

      <PreventivasTable initialData={preventivas || []} isVisitante={isVisitante} />
    </div>
  )
}
