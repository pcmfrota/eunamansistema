'use client'

import React, { useState, useRef } from 'react'
import { Search, Edit2, Trash2, Upload, Download } from 'lucide-react'
import Script from 'next/script'
import { excluirPreventiva, importarPreventivas } from './actions'

interface PreventivasTableProps {
  initialData: any[]
  isVisitante: boolean
}

export default function PreventivasTable({ initialData, isVisitante }: PreventivasTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos Status')
  const [tipoFilter, setTipoFilter] = useState('Todos Tipos')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDelete = async (id: string, placa: string) => {
    if (confirm(`Tem certeza que deseja excluir a programação preventiva de ${placa}?`)) {
      const res = await excluirPreventiva(id)
      if ('error' in res) alert(res.error)
    }
  }

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const XLSX = (window as any).XLSX
    if (!XLSX) {
      alert("A biblioteca do Excel ainda está carregando.")
      return
    }

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(worksheet)
        
        const res = await importarPreventivas(json)
        if ('error' in res) {
          alert(`Erro na importação: ${res.error}`)
        } else {
          const erros = ('errors' in res && typeof res.errors === 'number') ? res.errors : 0
          const count = ('count' in res && typeof res.count === 'number') ? res.count : 0
          if (erros > 0) {
            alert(`Processado com ${erros} erros. Verifique os dados.`)
          } else {
            alert(`${count} programações processadas com sucesso!`)
          }
        }
      } catch (err) {
        console.error(err)
        alert("Erro ao processar arquivo Excel.")
      }
    }
    reader.readAsArrayBuffer(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const filteredData = initialData.filter(prev => {
    const eq = prev.equipamentos
    const matchesSearch = eq?.placa?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const proxima = prev.ultimo_horimetro + prev.intervalo_horas
    const falta = proxima - prev.horimetro_atual
    let status = "NO PRAZO"
    if (falta < 0) status = "ATRASADO"
    else if (falta <= 100) status = "ATENÇÃO"

    const matchesStatus = statusFilter === 'Todos Status' || status === statusFilter
    const matchesTipo = tipoFilter === 'Todos Tipos' || eq?.tipo === tipoFilter

    return matchesSearch && matchesStatus && matchesTipo
  })

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col mt-4">
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />
      
      <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold">Manutenções Preventivas</h2>
          {!isVisitante && (
            <div className="flex gap-2">
              <input type="file" accept=".xlsx,.xls" ref={fileInputRef} onChange={handleImportExcel} className="hidden" />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-sm"
              >
                <Upload size={14} /> Importar Excel
              </button>
            </div>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por placa..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-4">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-900 text-sm outline-none text-zinc-700 dark:text-zinc-300 min-w-36"
            >
              <option>Todos Status</option>
              <option>NO PRAZO</option>
              <option>ATENÇÃO</option>
              <option>ATRASADO</option>
            </select>
            <select 
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-900 text-sm outline-none text-zinc-700 dark:text-zinc-300 min-w-36"
            >
              <option>Todos Tipos</option>
              <option value="COMBOIO">COMBOIO</option>
              <option value="MUNCK">MUNCK</option>
              <option value="PIPA">PIPA</option>
              <option value="ESCAVADEIRA">ESCAVADEIRA</option>
            </select>
          </div>
        </div>
      </div>

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
              {!isVisitante && <th className="px-6 py-4 text-center">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredData.map(prev => {
              const eq = prev.equipamentos
              const proxima = prev.ultimo_horimetro + prev.intervalo_horas
              const falta = proxima - prev.horimetro_atual
              
              let statusBadge = "NO PRAZO"
              let badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              
              if (falta < 0) {
                statusBadge = "ATRASADO"
                badgeClass = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              } else if (falta <= 100) {
                statusBadge = "ATENÇÃO"
                badgeClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }

              return (
                <tr key={prev.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{eq?.placa}</td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{eq?.tipo}</td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{eq?.categoria}</td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{eq?.modulo}</td>
                  <td className="px-6 py-4 font-mono">{prev.ultimo_horimetro}h</td>
                  <td className="px-6 py-4 font-mono">{prev.horimetro_atual}h</td>
                  <td className="px-6 py-4 font-bold">{proxima}h</td>
                  <td className={`px-6 py-4 font-bold ${falta < 0 ? 'text-red-500' : falta <= 100 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {falta}h
                  </td>
                  <td className="px-6 py-4 text-zinc-500">
                    {prev.data_atualizacao ? prev.data_atualizacao.split('T')[0].split('-').reverse().join('/') : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
                      {statusBadge}
                    </span>
                  </td>
                  {!isVisitante && (
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-3 text-zinc-400">
                        <button className="hover:text-red-500 transition-colors" onClick={() => handleDelete(prev.id, eq?.placa)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}

            {filteredData.length === 0 && (
              <tr>
                <td colSpan={11} className="px-6 py-12 text-center text-zinc-500">
                  Nenhuma manutenção preventiva encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
