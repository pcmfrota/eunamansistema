'use client'

import { useState } from 'react'
import { Plus, Clipboard, Search, FileSpreadsheet } from 'lucide-react'
import HorimetroTable from './HorimetroTable'
import HorimetroModal from './HorimetroModal'

interface HorimetroClientProps {
  equipamentos: any[]
  historico: any[]
}

export default function HorimetroClient({ equipamentos, historico }: HorimetroClientProps) {
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editData, setEditData] = useState<any>(null)

  const handleOpenNew = () => {
    setEditData(null)
    setIsModalOpen(true)
  }

  const handleEdit = (item: any) => {
    setEditData(item)
    setIsModalOpen(true)
  }

  const filteredHistory = historico.filter(h => 
    h.placa?.toLowerCase().includes(search.toLowerCase()) || 
    h.operador?.toLowerCase().includes(search.toLowerCase())
  )

  const handleClearFilters = () => {
    setSearch("")
  }

  return (
    <div className="flex flex-col gap-6 h-full pb-8">
      {/* Header with Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-950 p-6 md:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
         {/* Background decoration */}
         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors" />
         
         <div className="flex items-center gap-4 relative z-10">
            <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
              <Clipboard size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Registro de Horímetros</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                Gestão centralizada de apontamentos de horas trabalhadas.
              </p>
            </div>
         </div>

         <div className="flex gap-2 relative z-10 flex-wrap">
            <div className="relative group">
               <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
               <input 
                 type="text" 
                 placeholder="BUSCAR EQUIPAMENTO..." 
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="pl-12 pr-6 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase tracking-widest focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all w-60"
               />
            </div>
            {search && (
              <button 
                onClick={handleClearFilters}
                className="px-4 py-3 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl transition-all"
              >
                Limpar Filtros
              </button>
            )}
            <button 
              onClick={handleOpenNew}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/30 transition-all active:scale-95 group"
            >
              <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
              Novo Apontamento
            </button>
         </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 min-h-[500px]">
        <HorimetroTable 
          data={filteredHistory} 
          onEdit={handleEdit} 
        />
      </div>

      {/* Unified Modal */}
      <HorimetroModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        equipamentos={equipamentos}
        editData={editData}
        onSuccess={() => {
            // refresh data handled by revalidatePath in actions
        }}
      />
    </div>
  )
}
