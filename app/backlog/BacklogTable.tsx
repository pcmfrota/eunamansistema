'use client'

import React from 'react'
import { 
  ChevronRight, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  MoreVertical, 
  Trash2, 
  Edit3,
  Calendar,
  Layers,
  MapPin,
  Tag,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth-context'

interface BacklogTableProps {
  items: any[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onEdit: (item: any) => void
  onDelete: (id: string) => void
  view: 'Geral' | 'Detalhamento'
}

function StatusBadge({ status, statusProg }: { status: string, statusProg?: string }) {
  // Normalize Status
  let mappedStatus = 'PENDENTE'
  const statusLower = String(status || '').toLowerCase()
  const progLower = String(statusProg || '').toLowerCase()
  if (statusLower === 'encerrada' || statusLower === 'concluída' || statusLower === 'concluido' || statusLower === 'encerrado') {
    mappedStatus = 'ENCERRADO'
  } else if (progLower === 'programado' || statusLower === 'programada' || statusLower === 'programado') {
    mappedStatus = 'PROGRAMADO'
  }

  const styles: Record<string, string> = {
    'PENDENTE': 'bg-[#fef9c3] text-[#ca8a04] dark:bg-yellow-950/40 dark:text-yellow-400 border-[#fef08a] dark:border-yellow-900/50',
    'PROGRAMADO': 'bg-[#dcfce7] text-[#16a34a] dark:bg-emerald-950/40 dark:text-emerald-400 border-[#bbf7d0] dark:border-emerald-900/50',
    'ENCERRADO': 'bg-[#e2e8f0] text-[#475569] dark:bg-zinc-800 dark:text-zinc-400 border-[#cbd5e1] dark:border-zinc-700'
  }

  return (
    <span className={cn("px-2.5 py-1 rounded border text-[8px] font-black uppercase tracking-widest shadow-sm", styles[mappedStatus] || styles['PENDENTE'])}>
      {mappedStatus}
    </span>
  )
}

function CritBadge({ crit }: { crit: string }) {
  const critUpper = String(crit || 'B').toUpperCase().trim();
  
  // Normalize priority to A / B
  let mapped = 'B';
  if (critUpper === 'A' || critUpper === 'INTERDIÇÃO' || critUpper === 'INTERDICAO' || critUpper === 'ALTA') {
    mapped = 'A';
  }

  const styles: Record<string, string> = {
    'A': 'bg-[#fde8e8] text-[#e74c3c] dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-900/50',
    'B': 'bg-[#ebf5fb] text-[#2563eb] dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
  }

  return (
    <span className={cn("px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest border shadow-sm", styles[mapped] || styles['B'])}>
      {mapped}
    </span>
  )
}

export default function BacklogTable({ 
  items, 
  selectedIds, 
  onToggleSelect, 
  onToggleSelectAll, 
  onEdit, 
  onDelete,
  view
}: BacklogTableProps) {
  const { profile } = useAuth();
  const isVisitante = profile?.role === 'visitante';
  
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
         <Layers size={48} className="text-zinc-200 dark:text-zinc-800 mb-4" />
         <p className="text-zinc-500 font-bold">Nenhum item encontrado no backlog</p>
         <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-1">Sua lista de pendências está vazia</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-in fade-in duration-500">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-900">
              <th className="px-6 py-4 w-10">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  onChange={onToggleSelectAll} 
                  checked={items.length > 0 && selectedIds.size === items.length} 
                />
              </th>
              {view === 'Geral' ? (
                <>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Frota</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Criticidade</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Evidência</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Descrição</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">TAG</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Detalhes</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Local / Módulo</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">RC / Ordem</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Prog. Prevista</th>
                </>
              )}
              {!isVisitante && (
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Ações</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
            {items.map((item) => (
              <tr key={item.id} className={cn(
                "hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-all group",
                selectedIds.has(item.id) && "bg-indigo-50/50 dark:bg-indigo-900/10"
              )}>
                <td className="px-6 py-4">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={selectedIds.has(item.id)} 
                    onChange={() => onToggleSelect(item.id)} 
                  />
                </td>
                
                {view === 'Geral' ? (
                  <>
                    <td className="px-4 py-4">
                       <span className="flex items-center gap-1.5">
                         <span className="text-sm font-black text-zinc-900 dark:text-zinc-50 tracking-tight">{item.frota}</span>
                         {item._isPendingSync && (
                           <span className="inline-flex items-center gap-1 text-[9px] text-amber-500 font-bold" title="Pendente de sincronização offline">
                             <RefreshCw size={9} className="animate-spin" /> (Off)
                           </span>
                         )}
                       </span>
                       <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{item.modulo || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                       <CritBadge crit={item.criticidade} />
                    </td>
                    <td className="px-4 py-4">
                       <StatusBadge status={item.status} statusProg={item.status_programacao} />
                    </td>
                    <td className="px-4 py-4">
                       <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                         <Calendar size={14} className="opacity-40" />
                         {item.data_evidencia ? item.data_evidencia.split('T')[0].split('-').reverse().join('/') : '-'}
                       </div>
                    </td>
                    <td className="px-4 py-4 max-w-xs">
                       <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 line-clamp-1">{item.descricao}</p>
                       <span className="text-[10px] text-zinc-400 opacity-60 font-medium">{item.tipo}</span>
                    </td>
                    <td className="px-4 py-4">
                       <span className="text-[10px] px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-black text-zinc-500 dark:text-zinc-400">{item.tag || '---'}</span>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-4">
                       <div className="flex items-start gap-4">
                          <CritBadge crit={item.criticidade} />
                          <div>
                            <span className="flex items-center gap-1.5">
                              <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">{item.frota}</p>
                              {item._isPendingSync && (
                                <span className="inline-flex items-center gap-1 text-[9px] text-amber-500 font-bold" title="Pendente de sincronização offline">
                                  <RefreshCw size={9} className="animate-spin" /> (Off)
                                </span>
                              )}
                            </span>
                            <p className="text-[10px] font-bold text-zinc-400 line-clamp-1 max-w-[200px]">{item.descricao}</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-4 py-4">
                       <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1.5 text-xs font-black text-zinc-600 dark:text-zinc-400">
                            <MapPin size={12} className="text-indigo-500" /> {item.campo_base || 'Local Indef.'}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-400 ml-5">{item.modulo}</span>
                       </div>
                    </td>
                    <td className="px-4 py-4">
                       <div className="flex flex-col gap-1 font-black uppercase tracking-tighter">
                          <span className={cn("text-[10px]", item.nr_rc ? "text-indigo-500" : "text-zinc-300 dark:text-zinc-800")}>
                            RC: {item.nr_rc || 'PENDENTE'}
                          </span>
                          <span className={cn("text-[10px]", item.nr_ordem ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-800")}>
                            OC: {item.nr_ordem || 'AGUARDANDO'}
                          </span>
                       </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                       {item.data_programacao ? (
                         <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">{item.data_programacao.split('T')[0].split('-').reverse().join('/')}</span>
                            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{item.status_programacao}</span>
                         </div>
                       ) : (
                         <span className="text-[9px] font-black text-zinc-300 dark:text-zinc-800 uppercase tracking-widest italic">Não Programado</span>
                       )}
                    </td>
                  </>
                )}

                {!isVisitante && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onEdit(item)}
                        className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-zinc-400 hover:text-indigo-600 rounded-xl transition-all"
                        title="Editar"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => onDelete(item.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-600 rounded-xl transition-all"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {items.length >= 5000 && (
         <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-900 text-center">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center justify-center gap-2">
              <Clock size={12} /> Exibindo 5000 registros mais recentes
            </span>
         </div>
      )}
    </div>
  )
}
