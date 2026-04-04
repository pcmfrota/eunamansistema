'use client'

import { useState } from 'react'
import { 
  FileSpreadsheet, 
  Search, 
  Trash2, 
  Edit3, 
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download
} from 'lucide-react'
import { excluirHorimetro } from './actions'
import * as XLSX from 'xlsx'

interface HorimetroTableProps {
  data: any[]
  onEdit: (item: any) => void
}

export default function HorimetroTable({ data, onEdit }: HorimetroTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Filter logic
  const filteredData = data.filter(item => 
    item.equipamentos?.placa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.observacoes?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleDelete = async (id: string, placa: string) => {
    if (confirm(`Atenção: Deseja realmente excluir o apontamento de ${placa}? Esta ação é irreversível.`)) {
      const result = await excluirHorimetro(id)
      if ('error' in result) alert(result.error)
    }
  }

  const handleExport = () => {
    const exportData = filteredData.map(item => ({
      'Placa': item.equipamentos?.placa,
      'Modelo': item.equipamentos?.modelo,
      'Data Referência': item.data_referencia?.split('T')[0],
      'Horímetro Inicial': item.horimetro_inicial,
      'Horímetro Final': item.horimetro_final,
      'Horas Trabalhadas': (item.horimetro_final - item.horimetro_inicial).toFixed(1),
      'Observações': item.observacoes
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Horimetros')
    XLSX.writeFile(wb, `relatorio_horimetros_${new Date(Date.now() - 3 * 3600 * 1000).toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
      
      {/* Search and Action Bar */}
      <div className="p-4 md:p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Buscar por placa ou observação..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-500"
          />
        </div>
        
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 transition-all shadow-sm shrink-0"
        >
          <Download size={16} />
          Exportar Relatório
        </button>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-zinc-50/80 dark:bg-zinc-900/80">
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Equipamento</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-center">Data ref.</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">Inicial</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">Final</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-center">Horas totais</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-[80px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {paginatedData.map((reg) => (
              <tr 
                key={reg.id} 
                className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div>
                    <span className="font-bold text-sm block">{reg.equipamentos?.placa || '???'}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-500 font-medium">{reg.equipamentos?.modelo || 'Sem modelo'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    {reg.data_referencia ? reg.data_referencia.split('T')[0].split('-').reverse().join('/') : '-'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {reg.horimetro_inicial.toFixed(1)}h
                </td>
                <td className="px-6 py-4 text-right text-sm font-bold text-blue-600 dark:text-blue-400">
                  {reg.horimetro_final.toFixed(1)}h
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-lg">
                    + {(reg.horimetro_final - reg.horimetro_inicial).toFixed(1)} hrs
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onEdit(reg)}
                      className="p-2 text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                      title="Editar"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(reg.id, reg.equipamentos?.placa)}
                      className="p-2 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredData.length === 0 && (
          <div className="p-12 flex flex-col items-center text-center">
            <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-full mb-4">
              <Search size={32} className="text-zinc-400" />
            </div>
            <h3 className="font-bold text-zinc-700 dark:text-zinc-300">Nenhum registro encontrado</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-500 max-w-xs mt-1">
              Tente ajustar seus critérios de busca ou filtrar por outra placa.
            </p>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 md:p-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/30">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-50 transition-all font-bold"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-50 transition-all font-bold"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
