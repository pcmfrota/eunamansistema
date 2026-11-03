'use client'

import React, { useState, useEffect } from 'react'
import {
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Calendar,
  Layers,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth-context'
import { Card } from '../../ui/primitives/ListRow'
import { EmptyState } from '../../ui/primitives/EmptyState'
import { ActionSheet, ActionSheetItem } from '../../ui/primitives/ActionSheet'
import { Edit3, Trash2 } from 'lucide-react'

interface BacklogTableProps {
  items: any[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onEdit: (item: any) => void
  onDelete: (id: string) => void
  view: 'Geral' | 'Detalhamento'
}

// Paleta sempre escura de propósito — tailwind.config deste projeto usa darkMode:"class"
// e nada aqui nunca aplica a classe "dark" no <html> (field-app é sempre escuro), então
// variantes "dark:" nunca ativavam: o visual real antes do redesenho era sempre a versão
// clara. Cores abaixo já são a versão final (sem variante condicional).
function StatusBadge({ status, statusProg }: { status: string, statusProg?: string }) {
  let mappedStatus = 'PENDENTE'
  const statusLower = String(status || '').toLowerCase()
  const progLower = String(statusProg || '').toLowerCase()
  if (statusLower === 'encerrada' || statusLower === 'concluída' || statusLower === 'concluido' || statusLower === 'encerrado') {
    mappedStatus = 'ENCERRADO'
  } else if (progLower === 'programado' || statusLower === 'programada' || statusLower === 'programado') {
    mappedStatus = 'PROGRAMADO'
  }

  const styles: Record<string, string> = {
    'PENDENTE': 'bg-amber-500/15 text-amber-400',
    'PROGRAMADO': 'bg-emerald-500/15 text-emerald-400',
    'ENCERRADO': 'bg-zinc-800 text-zinc-400'
  }

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0", styles[mappedStatus] || styles['PENDENTE'])}>
      {mappedStatus}
    </span>
  )
}

function CritBadge({ crit }: { crit: string }) {
  const critUpper = String(crit || 'B').toUpperCase().trim();
  let mapped = 'B';
  if (critUpper === 'A' || critUpper === 'INTERDIÇÃO' || critUpper === 'INTERDICAO' || critUpper === 'ALTA') {
    mapped = 'A';
  }

  const styles: Record<string, string> = {
    'A': 'bg-red-500/15 text-red-400',
    'B': 'bg-blue-500/15 text-blue-400',
  }

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0", styles[mapped] || styles['B'])}>
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

  const [currentPage, setCurrentPage] = useState(1);
  const [actionItem, setActionItem] = useState<any>(null);
  const itemsPerPage = 25;

  useEffect(() => {
    setCurrentPage(1);
  }, [items]);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const paginatedItems = React.useMemo(() => {
    return items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [items, currentPage]);

  if (items.length === 0) {
    return <EmptyState icon={Layers} title="Nenhum item encontrado no backlog" description="Sua lista de pendências está vazia" />
  }

  const actionSheetItems: ActionSheetItem[] = actionItem ? [
    { key: 'editar', label: 'Editar', icon: Edit3, onSelect: () => onEdit(actionItem) },
    ...(isVisitante ? [] : [{ key: 'excluir', label: 'Excluir', icon: Trash2, destructive: true, onSelect: () => onDelete(actionItem.id) } as ActionSheetItem]),
  ] : [];

  return (
    <div className="space-y-2">
      {!isVisitante && items.length > 0 && (
        <label className="flex items-center gap-2.5 px-1 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            onChange={onToggleSelectAll}
            checked={items.length > 0 && selectedIds.size === items.length}
          />
          Selecionar todos ({items.length})
        </label>
      )}

      {paginatedItems.map((item) => (
        <Card key={item.id} className="p-3.5 flex items-start gap-3">
          {!isVisitante && (
            <input
              type="checkbox"
              onClick={e => e.stopPropagation()}
              onChange={() => onToggleSelect(item.id)}
              checked={selectedIds.has(item.id)}
              className="mt-1 w-4 h-4 shrink-0 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          )}

          <button type="button" onClick={() => onEdit(item)} className="flex-1 min-w-0 text-left">
            {view === 'Geral' ? (
              <>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-black text-zinc-50">{item.frota}</span>
                  {item._isPendingSync && (
                    <RefreshCw size={10} className="animate-spin text-amber-500" />
                  )}
                  <CritBadge crit={item.criticidade} />
                  <StatusBadge status={item.status} statusProg={item.status_programacao} />
                </div>
                <p className="text-xs font-bold text-zinc-300 mt-1 line-clamp-2">{item.descricao || '—'}</p>
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5 text-[10px] text-zinc-500 font-semibold">
                  <Calendar size={11} className="opacity-60" />
                  {item.data_evidencia ? item.data_evidencia.split('T')[0].split('-').reverse().join('/') : '—'}
                  {item.modulo && <span>· {item.modulo}</span>}
                  {item.tag && <span className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 font-black">{item.tag}</span>}
                  {item.tempo_execucao && <span>· {item.tempo_execucao}</span>}
                </div>
                {item.colaborador && (
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tight mt-1">👤 {item.colaborador}</p>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-black text-zinc-50">{item.frota}</span>
                  {item._isPendingSync && (
                    <RefreshCw size={10} className="animate-spin text-amber-500" />
                  )}
                  <CritBadge crit={item.criticidade} />
                </div>
                <p className="text-[11px] font-bold text-zinc-400 mt-1 line-clamp-2">{item.descricao}</p>
                {item.colaborador && (
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-tight mt-0.5">👤 {item.colaborador}</p>
                )}
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5 text-[10px] text-zinc-500 font-semibold">
                  <span>📍 {item.campo_base || 'Local Indef.'}{item.modulo ? ` · ${item.modulo}` : ''}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[10px] font-black uppercase tracking-tight">
                  <span className={item.nr_rc ? "text-indigo-400" : "text-zinc-600"}>RC: {item.nr_rc || 'PENDENTE'}</span>
                  <span className={item.nr_ordem ? "text-emerald-400" : "text-zinc-600"}>OC: {item.nr_ordem || 'AGUARDANDO'}</span>
                </div>
                {item.data_programacao ? (
                  <p className="text-[10px] font-bold text-blue-400 mt-1">
                    Prog.: {item.data_programacao.split('T')[0].split('-').reverse().join('/')} · {item.status_programacao}
                  </p>
                ) : (
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest italic mt-1">Não Programado</p>
                )}
                {item.tempo_execucao && <p className="text-[10px] font-bold text-zinc-400 mt-1">Tempo est.: {item.tempo_execucao}</p>}
              </>
            )}
          </button>

          {!isVisitante && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActionItem(item); }}
              aria-label="Mais ações"
              className="shrink-0 flex items-center justify-center rounded-xl text-zinc-500 active:bg-zinc-800"
              style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
            >
              <MoreVertical size={18} />
            </button>
          )}
        </Card>
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 px-1">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-zinc-800 rounded-xl active:bg-zinc-900 disabled:opacity-40 text-zinc-300"
              style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-zinc-800 rounded-xl active:bg-zinc-900 disabled:opacity-40 text-zinc-300"
              style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {items.length >= 5000 && (
        <p className="text-center text-[10px] font-black text-zinc-600 uppercase tracking-widest pt-2">
          Exibindo 5000 registros mais recentes
        </p>
      )}

      <ActionSheet
        open={!!actionItem}
        onClose={() => setActionItem(null)}
        title={actionItem ? `${actionItem.frota || 'S/ FROTA'}` : undefined}
        items={actionSheetItems}
      />
    </div>
  )
}
