import { createClient } from '@/utils/supabase/server'
import { Calendar, Search, Edit2, Trash2 } from 'lucide-react'
import NovaPreventivaModal from './NovoModal'
import { revalidatePath } from 'next/cache'

export default async function ProgramacaoPreventivaPage() {
  const supabase = createClient()

  // Buscar todos equipamentos e pre-calcular ultimo horimetro para o dropdown Modal
  const { data: equipamentos } = await supabase
    .from('equipamentos')
    .select('*, horimetros(horimetro_final)')
    
  // Transformar os equipamentos extraindo o último horimetro listado (se houver)
  const eqTransformados = equipamentos?.map(eq => {
    // Pegamos o horímetro final de maior valor que encontrar do equipamento como sendo o último registrado
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
      ultimoHist: lastH > 0 ? lastH : undefined
    }
  }) || [];

  // Buscar a listagem completa das preventivas
  const { data: preventivas } = await supabase
    .from('preventivas')
    .select('*, equipamentos(placa, tipo, categoria, modulo)')
    .order('data_atualizacao', { ascending: false })

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-[90rem] mx-auto w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded-lg">
            <Calendar size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Programação Preventiva</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Controle das manutenções preventivas programadas
            </p>
          </div>
        </div>

        <div>
          <NovaPreventivaModal equipamentos={eqTransformados} />
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col mt-4">
        
        {/* Header da Tabela (Título e Filtros) */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
          <h2 className="text-base font-semibold">Manutenções Preventivas</h2>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por placa..." 
                className="w-full pl-9 pr-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex gap-4">
              <select className="border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-900 text-sm outline-none text-zinc-700 dark:text-zinc-300 min-w-36">
                <option>Todos Status</option>
                <option>NO PRAZO</option>
                <option>ATENÇÃO</option>
                <option>ATRASADO</option>
              </select>
              <select className="border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-900 text-sm outline-none text-zinc-700 dark:text-zinc-300 min-w-36">
                <option>Todos Tipos</option>
                <option>CARRO</option>
                <option>COMBOIO</option>
                <option>PIPA</option>
                <option>ESCAVADEIRA</option>
              </select>
            </div>
          </div>
        </div>

        {/* Listagem */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium">
              <tr>
                <th className="px-6 py-4">Placa</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Módulo</th>
                <th className="px-6 py-4">Último</th>
                <th className="px-6 py-4">Atual</th>
                <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">Próxima</th>
                <th className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">Falta ↑</th>
                <th className="px-6 py-4">Última Atualização</th>
                <th className="px-6 py-4">Status ↑</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              
              {preventivas?.map(prev => {
                const eq = prev.equipamentos;
                const proxima = prev.ultimo_horimetro + prev.intervalo_horas;
                const falta = proxima - prev.horimetro_atual;
                
                let statusBadge = "NO PRAZO";
                let badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
                
                if (falta < 0) {
                  statusBadge = "ATRASADO";
                  badgeClass = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
                } else if (falta <= 100) {
                  statusBadge = "ATENÇÃO";
                  badgeClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
                }

                return (
                  <tr key={prev.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                    <td className="px-6 py-4 font-medium">{eq?.placa}</td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{eq?.tipo}</td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{eq?.categoria}</td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{eq?.modulo}</td>
                    <td className="px-6 py-4">{prev.ultimo_horimetro}h</td>
                    <td className="px-6 py-4">{prev.horimetro_atual}h</td>
                    <td className="px-6 py-4 font-medium">{proxima}h</td>
                    <td className={`px-6 py-4 font-semibold ${falta < 0 ? 'text-red-500' : falta <= 100 ? 'text-amber-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                      {falta}h
                    </td>
                    <td className="px-6 py-4 text-zinc-500">
                      {(() => {
                        if (!prev.data_atualizacao) return "-";
                        const clean = prev.data_atualizacao.slice(0, 16);
                        const parts = clean.split('T')[0].split('-');
                        return `${parts[2]}/${parts[1]}/${parts[0]}`;
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${badgeClass}`}>
                        {statusBadge}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-3 text-zinc-400">
                        <button className="hover:text-blue-500 transition-colors" title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button className="hover:text-red-500 transition-colors" title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {(!preventivas || preventivas.length === 0) && (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-zinc-500">
                    Nenhuma manutenção preventiva listada. Registre uma através da opção "Nova Preventiva".
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
