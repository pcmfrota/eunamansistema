import { createClient } from '@/utils/supabase/server'
import ProgPrevClient from './ProgPrevClient'
import { getProgPrevData } from './actions'
import { Settings2 } from 'lucide-react'

export default async function ProgramacaoPreventiva() {
  const supabase = createClient()
  const anoAtivo = new Date().getFullYear()

  const [progData, eqRes] = await Promise.all([
    getProgPrevData(anoAtivo),
    supabase.from('equipamentos').select('id, placa, categoria').order('placa'),
  ])

  return (
    <div className="flex flex-col max-w-[96rem] mx-auto w-full min-h-screen bg-[#060d0a]">
      <div className="flex items-center gap-4 px-6 py-5 border-b border-zinc-800">
        <div className="p-3 bg-green-900/40 text-green-400 rounded-xl shadow">
          <Settings2 size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-100">Programação Preventiva</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Lançamentos pela aba Programação Semanal · Dashboards calculados automaticamente
          </p>
        </div>
      </div>

      <ProgPrevClient
        progSemanais={progData.progSemanais}
        calendario={progData.calendario}
        equipamentos={(eqRes.data ?? []).map((e: any) => ({ id: e.id, placa: e.placa, categoria: e.categoria }))}
        anoAtivo={anoAtivo}
      />
    </div>
  )
}
