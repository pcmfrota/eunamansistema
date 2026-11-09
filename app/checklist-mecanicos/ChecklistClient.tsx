'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, CheckCircle, XCircle, AlertTriangle, FileText, Download, Share2, X, Loader2 } from 'lucide-react'
import { localDb } from '@/lib/offline-db'
import { salvarChecklist, excluirChecklist } from './actions'
import { getComboioConfig, getPipaConfig, getMultifuncionalConfig, getMunckConfig, ChecklistGroup, ChecklistItem } from './checklistConfig'
import { baixarOuCompartilharPdf, preCarregarHtml2Pdf } from '@/lib/pdf-share'

export default function ChecklistClient({ initialChecklists, userRole, userId }: { initialChecklists: any[], userRole: string, userId: string }) {
  const [checklists, setChecklists] = useState(initialChecklists)
  const [frota, setFrota] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [viewChecklist, setViewChecklist] = useState<any>(null)
  const [exportandoPdf, setExportandoPdf] = useState<"download" | "share" | null>(null)

  useEffect(() => {
    preCarregarHtml2Pdf()
  }, [])
  
  // States do formulário
  const [tipo, setTipo] = useState('')
  const [placa, setPlaca] = useState('')
  const [co, setCo] = useState('')
  const [local, setLocal] = useState('')
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [pendencias, setPendencias] = useState('')

  useEffect(() => {
    localDb.getAll('equipamentos').then(eqs => setFrota(eqs))
  }, [])

  const handlePlacaChange = (val: string) => {
    setPlaca(val)
    const eq = frota.find(e => e.placa.toLowerCase() === val.toLowerCase() || e.placa.replace('-', '').toLowerCase() === val.toLowerCase())
    if (eq) {
      setCo(eq.categoria || eq.co || '')
      setLocal(eq.local || eq.area || '')
    } else {
      setCo('')
      setLocal('')
    }
  }

  const getConfig = () => {
    switch (tipo) {
      case 'Comboio': return getComboioConfig()
      case 'Pipa': return getPipaConfig()
      case 'Multifuncional': return getMultifuncionalConfig()
      case 'Munck': return getMunckConfig()
      default: return []
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tipo || !placa) {
      alert("Preencha o Tipo e a Placa")
      return
    }

    setLoading(true)
    const formData = new FormData()
    formData.append('tipo_caminhao', tipo)
    formData.append('placa', placa)
    formData.append('co', co)
    formData.append('local', local)
    formData.append('respostas', JSON.stringify(respostas))
    formData.append('pendencias_adicionais', pendencias)

    // Passar também os labels para criar o backlog bonitinho
    const configGroups = getConfig()
    const labelsMap: Record<string, string> = {}
    configGroups.forEach(g => {
      g.items.forEach(i => {
        labelsMap[i.id] = i.label
        if (i.subItems) {
          i.subItems.forEach(si => {
            labelsMap[`${i.id}_${si.id}`] = `${i.label} - ${si.label}`
          })
        }
      })
    })
    formData.append('questionsLabels', JSON.stringify(labelsMap))

    const result = await salvarChecklist(formData)
    setLoading(false)

    if (result?.error) {
      alert(result.error)
    } else {
      alert("Checklist Fechado! OS e Backlog gerados.")
      setChecklists([result.data, ...checklists])
      setIsModalOpen(false)
      setTipo('')
      setPlaca('')
      setCo('')
      setLocal('')
      setRespostas({})
      setPendencias('')
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Deseja realmente excluir este checklist? As OS e Backlogs gerados por ele não serão excluídos automaticamente.")) {
      const res = await excluirChecklist(id)
      if (res?.success) {
        alert("Excluído com sucesso")
        setChecklists(checklists.filter(c => c.id !== id))
      }
    }
  }

  const handleExportPDF = (checklist: any, modo: "download" | "share" = "download") => {
    setViewChecklist(checklist)
    setExportandoPdf(modo)
    setTimeout(async () => {
      try {
        const element = document.getElementById('ficha-checklist-print')
        if (!element) {
          alert('Erro ao localizar a ficha para gerar o PDF.')
          return
        }
        const filename = `Checklist_${checklist.tipo_caminhao}_${checklist.placa}_${String(checklist.id).padStart(5, '0')}.pdf`
        await baixarOuCompartilharPdf(
          element,
          filename,
          `Checklist Mecânico — ${checklist.placa}`,
          `Checklist Mecânico (${checklist.tipo_caminhao}) da placa ${checklist.placa}`,
          modo
        )
      } finally {
        setExportandoPdf(null)
      }
    }, 500)
  }

  const handleView = (checklist: any) => {
    setViewChecklist(checklist)
  }

  const handleAnswer = (key: string, value: string) => {
    setRespostas(prev => ({ ...prev, [key]: value }))
  }

  const renderItem = (item: ChecklistItem, readOnlyObj: Record<string, string> | null = null) => {
    const isReadOnly = readOnlyObj !== null
    const resps = readOnlyObj || respostas

    if (item.type === 'pneus') {
      const posicoes = ['DD', 'DE', 'TD1E', 'TD1I', 'TD2E', 'TD2I', 'TE1E', 'TE1I', 'TE2E', 'TE2I']
      return (
        <div key={item.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg col-span-full">
          <span className="text-sm font-bold dark:text-zinc-200 block mb-3 border-b pb-1 border-zinc-200 dark:border-zinc-700">{item.label}</span>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {posicoes.map(pos => (
              <div key={pos} className="flex flex-col items-center bg-white dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                <span className="text-xs font-bold mb-1">{pos}</span>
                <div className="flex gap-1">
                  <label className={`text-[10px] flex flex-col items-center ${isReadOnly ? '' : 'cursor-pointer'}`}>
                    <input type="radio" name={`pneu_${item.id}_${pos}`} checked={resps[`pneu_${pos}`] === 'N'} onChange={() => !isReadOnly && handleAnswer(`pneu_${pos}`, 'N')} disabled={isReadOnly} />
                    <span className="mt-1 text-green-600 font-bold">N</span>
                  </label>
                  <label className={`text-[10px] flex flex-col items-center ${isReadOnly ? '' : 'cursor-pointer'}`}>
                    <input type="radio" name={`pneu_${item.id}_${pos}`} checked={resps[`pneu_${pos}`] === 'M'} onChange={() => !isReadOnly && handleAnswer(`pneu_${pos}`, 'M')} disabled={isReadOnly} />
                    <span className="mt-1 text-yellow-600 font-bold">M</span>
                  </label>
                  <label className={`text-[10px] flex flex-col items-center ${isReadOnly ? '' : 'cursor-pointer'}`}>
                    <input type="radio" name={`pneu_${item.id}_${pos}`} checked={resps[`pneu_${pos}`] === 'F'} onChange={() => !isReadOnly && handleAnswer(`pneu_${pos}`, 'F')} disabled={isReadOnly} />
                    <span className="mt-1 text-red-600 font-bold">F</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <input type="text" placeholder="Obs..." value={resps[`${item.id}_obs`] || ''} onChange={(e) => !isReadOnly && handleAnswer(`${item.id}_obs`, e.target.value)} disabled={isReadOnly} className="mt-2 w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs outline-none" />
        </div>
      )
    }

    if (item.type === 'barras') {
      const lados = ['Lateral Direita', 'Lateral Esquerda', 'Traseira']
      return (
        <div key={item.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg col-span-full">
          <span className="text-sm font-bold dark:text-zinc-200 block mb-2">{item.label}</span>
          <div className="flex flex-wrap gap-4">
            {lados.map(lado => {
              const key = `barras_${lado.replace(' ', '_').toLowerCase()}`
              return (
                <div key={lado} className="flex items-center gap-2">
                  <span className="text-xs w-24">{lado}:</span>
                  <label className="text-xs"><input type="radio" checked={resps[key] === 'C'} onChange={() => !isReadOnly && handleAnswer(key, 'C')} disabled={isReadOnly} /> <span className="text-green-600 font-bold">C</span></label>
                  <label className="text-xs"><input type="radio" checked={resps[key] === 'NC'} onChange={() => !isReadOnly && handleAnswer(key, 'NC')} disabled={isReadOnly} /> <span className="text-red-600 font-bold">NC</span></label>
                  <label className="text-xs"><input type="radio" checked={resps[key] === 'NA'} onChange={() => !isReadOnly && handleAnswer(key, 'NA')} disabled={isReadOnly} /> <span className="text-zinc-500 font-bold">NA</span></label>
                </div>
              )
            })}
          </div>
          <input type="text" placeholder="Obs..." value={resps[`${item.id}_obs`] || ''} onChange={(e) => !isReadOnly && handleAnswer(`${item.id}_obs`, e.target.value)} disabled={isReadOnly} className="mt-2 w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs outline-none" />
        </div>
      )
    }

    if (item.type === 'cinto') {
      const lados = ['Motorista', 'Passageiro']
      return (
        <div key={item.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg col-span-full">
          <span className="text-sm font-bold dark:text-zinc-200 block mb-2">{item.label}</span>
          <div className="flex flex-wrap gap-4">
            {lados.map(lado => {
              const key = `cinto_${lado.toLowerCase()}`
              return (
                <div key={lado} className="flex items-center gap-2">
                  <span className="text-xs w-20">{lado}:</span>
                  <label className="text-xs"><input type="radio" checked={resps[key] === 'C'} onChange={() => !isReadOnly && handleAnswer(key, 'C')} disabled={isReadOnly} /> <span className="text-green-600 font-bold">C</span></label>
                  <label className="text-xs"><input type="radio" checked={resps[key] === 'NC'} onChange={() => !isReadOnly && handleAnswer(key, 'NC')} disabled={isReadOnly} /> <span className="text-red-600 font-bold">NC</span></label>
                  <label className="text-xs"><input type="radio" checked={resps[key] === 'NA'} onChange={() => !isReadOnly && handleAnswer(key, 'NA')} disabled={isReadOnly} /> <span className="text-zinc-500 font-bold">NA</span></label>
                </div>
              )
            })}
          </div>
          <input type="text" placeholder="Obs..." value={resps[`${item.id}_obs`] || ''} onChange={(e) => !isReadOnly && handleAnswer(`${item.id}_obs`, e.target.value)} disabled={isReadOnly} className="mt-2 w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs outline-none" />
        </div>
      )
    }

    if (item.type === 'iluminacao') {
      const luzes = ['Lado Direito Dianteiro', 'Lado Esquerdo Dianteiro', 'Lado Direito Traseiro', 'Lado Esquerdo Traseiro']
      return (
        <div key={item.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg col-span-full">
          <span className="text-sm font-bold dark:text-zinc-200 block mb-2">{item.label}</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {luzes.map(luz => {
              const key = `luz_${luz.replace(/ /g, '_').toLowerCase()}`
              return (
                <div key={luz} className="flex justify-between items-center bg-white dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-medium">{luz}</span>
                  <div className="flex gap-2">
                    <label className="text-xs"><input type="radio" checked={resps[key] === 'C'} onChange={() => !isReadOnly && handleAnswer(key, 'C')} disabled={isReadOnly} /> <span className="text-green-600 font-bold">C</span></label>
                    <label className="text-xs"><input type="radio" checked={resps[key] === 'NC'} onChange={() => !isReadOnly && handleAnswer(key, 'NC')} disabled={isReadOnly} /> <span className="text-red-600 font-bold">NC</span></label>
                    <label className="text-xs"><input type="radio" checked={resps[key] === 'NA'} onChange={() => !isReadOnly && handleAnswer(key, 'NA')} disabled={isReadOnly} /> <span className="text-zinc-500 font-bold">NA</span></label>
                  </div>
                </div>
              )
            })}
          </div>
          <input type="text" placeholder="Obs..." value={resps[`${item.id}_obs`] || ''} onChange={(e) => !isReadOnly && handleAnswer(`${item.id}_obs`, e.target.value)} disabled={isReadOnly} className="mt-2 w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs outline-none" />
        </div>
      )
    }

    if (item.type === 'multi' && item.subItems) {
      return (
        <div key={item.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg col-span-full">
          <span className="text-sm font-bold dark:text-zinc-200 block mb-2">{item.label}</span>
          <div className="flex flex-wrap gap-2 md:gap-4 mb-2">
            {item.subItems.map(sub => {
              const key = `${item.id}_${sub.id}`
              return (
                <div key={sub.id} className="flex items-center gap-2 bg-white dark:bg-zinc-950 p-1 px-2 rounded border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-semibold">{sub.label}:</span>
                  <label className="text-[10px]"><input type="radio" checked={resps[key] === 'C'} onChange={() => !isReadOnly && handleAnswer(key, 'C')} disabled={isReadOnly} /> <span className="text-green-600 font-bold">C</span></label>
                  <label className="text-[10px]"><input type="radio" checked={resps[key] === 'NC'} onChange={() => !isReadOnly && handleAnswer(key, 'NC')} disabled={isReadOnly} /> <span className="text-red-600 font-bold">NC</span></label>
                  <label className="text-[10px]"><input type="radio" checked={resps[key] === 'NA'} onChange={() => !isReadOnly && handleAnswer(key, 'NA')} disabled={isReadOnly} /> <span className="text-zinc-500 font-bold">NA</span></label>
                </div>
              )
            })}
          </div>
          <input type="text" placeholder="Obs..." value={resps[`${item.id}_obs`] || ''} onChange={(e) => !isReadOnly && handleAnswer(`${item.id}_obs`, e.target.value)} disabled={isReadOnly} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs outline-none" />
        </div>
      )
    }

    // Standard
    return (
      <div key={item.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg col-span-full md:col-span-1 flex flex-col justify-between">
        <span className="text-sm font-medium dark:text-zinc-200 mb-2 leading-tight">{item.label}</span>
        <div className="flex items-center gap-3 mb-2">
          <label className={`flex items-center gap-1 text-xs ${isReadOnly ? '' : 'cursor-pointer'}`}>
            <input type="radio" name={item.id + (isReadOnly ? '_v' : '')} value="C" onChange={() => !isReadOnly && handleAnswer(item.id, 'C')} checked={resps[item.id] === 'C'} disabled={isReadOnly} /> <span className="text-green-600 font-bold">C</span>
          </label>
          <label className={`flex items-center gap-1 text-xs ${isReadOnly ? '' : 'cursor-pointer'}`}>
            <input type="radio" name={item.id + (isReadOnly ? '_v' : '')} value="NC" onChange={() => !isReadOnly && handleAnswer(item.id, 'NC')} checked={resps[item.id] === 'NC'} disabled={isReadOnly} /> <span className="text-red-600 font-bold">NC</span>
          </label>
          <label className={`flex items-center gap-1 text-xs ${isReadOnly ? '' : 'cursor-pointer'}`}>
            <input type="radio" name={item.id + (isReadOnly ? '_v' : '')} value="NA" onChange={() => !isReadOnly && handleAnswer(item.id, 'NA')} checked={resps[item.id] === 'NA'} disabled={isReadOnly} /> <span className="text-zinc-500 font-bold">NA</span>
          </label>
        </div>
        <input type="text" placeholder="Obs..." value={resps[`${item.id}_obs`] || ''} onChange={(e) => !isReadOnly && handleAnswer(`${item.id}_obs`, e.target.value)} disabled={isReadOnly} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs outline-none" />
      </div>
    )
  }

  // Dynamic config for View Modal
  const getViewConfig = (cType: string) => {
    switch (cType) {
      case 'Comboio': return getComboioConfig()
      case 'Pipa': return getPipaConfig()
      case 'Multifuncional': return getMultifuncionalConfig()
      case 'Munck': return getMunckConfig()
      default: return []
    }
  }

  return (
    <>
    <div className="p-4 lg:p-6 w-full max-w-7xl mx-auto space-y-6 print:hidden">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Checklists Mecânicos</h1>
          <p className="text-zinc-500 text-sm">Inspeções de frota integradas a OS e Backlog.</p>
        </div>
        {((userRole === 'admin' || userRole === 'administrador') || userRole === 'mecanico' || userRole === 'gestao') && (
          <button
            onClick={() => {
              setTipo('')
              setPlaca('')
              setCo('')
              setLocal('')
              setRespostas({})
              setPendencias('')
              setIsModalOpen(true)
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2"
          >
            <Plus size={18} /> Novo Checklist
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-semibold border-b dark:border-zinc-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">ID / Data</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Equipamento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {checklists.map((item) => (
                <tr key={item.id} className="border-b dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">{String(item.id).padStart(5,'0')}</span><br/>
                    {new Date(item.criado_em).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{item.tipo_caminhao}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold">{item.placa}</span><br/>
                    <span className="text-xs">{item.co} • {item.local}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex items-center justify-center gap-2">
                    <button onClick={() => handleView(item)} className="p-1.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100" title="Ver Checklist">
                      <FileText size={16} />
                    </button>
                    <button onClick={() => handleExportPDF(item, "download")} className="p-1.5 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100" title="Baixar PDF">
                      <Download size={16} />
                    </button>
                    <button onClick={() => handleExportPDF(item, "share")} className="p-1.5 bg-green-50 text-green-700 rounded hover:bg-green-100" title="Compartilhar PDF">
                      <Share2 size={16} />
                    </button>
                    {((userRole === 'admin' || userRole === 'administrador') || userRole === 'gestao') && (
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200">
                        <X size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {checklists.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum checklist encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-4xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="sticky top-0 bg-white dark:bg-zinc-950 z-10 pb-4 mb-4 border-b dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold dark:text-white">Ficha de Inspeção</h2>
                <p className="text-xs text-zinc-500">Preencha conforme o formulário físico</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 dark:bg-zinc-900 p-2 rounded-full"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border dark:border-zinc-800">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Tipo de Caminhão *</label>
                  <select 
                    value={tipo} 
                    onChange={e => {
                      setTipo(e.target.value)
                      setRespostas({}) // Reset answers when changing type
                    }}
                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="Comboio">Comboio</option>
                    <option value="Pipa">Pipa</option>
                    <option value="Multifuncional">Multifuncional</option>
                    <option value="Munck">Munck</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Placa (Auto-completar) *</label>
                  <input 
                    list="frotas"
                    value={placa} 
                    onChange={e => handlePlacaChange(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none uppercase"
                    placeholder="ABC-1234"
                    required
                  />
                  <datalist id="frotas">
                    {frota.map((f, i) => <option key={i} value={f.placa}>{f.placa} - {f.categoria} ({f.local})</option>)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">C.O. / Categoria</label>
                  <input 
                    value={co} 
                    readOnly
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm dark:text-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Local</label>
                  <input 
                    value={local} 
                    readOnly
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm dark:text-zinc-400"
                  />
                </div>
              </div>

              {tipo && (
                <div className="space-y-8">
                  {getConfig().map(group => (
                    <div key={group.id} className="space-y-3">
                      <div className="bg-zinc-200 dark:bg-zinc-800 px-3 py-2 rounded">
                        <h3 className="text-sm font-bold dark:text-white uppercase tracking-wider">{group.title}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.items.map(item => renderItem(item, null))}
                      </div>
                    </div>
                  ))}

                  <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border dark:border-zinc-800 mt-6">
                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Pendências Adicionais / Marcar Fotos</label>
                    <p className="text-xs text-zinc-500 mb-3">
                      Anote aqui as pendências que você marcaria com 'X' na imagem da ficha impressa. 
                      Cada linha gera um item no Backlog automático.
                    </p>
                    <textarea 
                      value={pendencias}
                      onChange={e => setPendencias(e.target.value)}
                      rows={4}
                      className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none resize-y"
                      placeholder="Ex: Parachoque arranhado lado esquerdo&#10;Logo da empresa rasgado"
                    />
                  </div>
                </div>
              )}

              <div className="sticky bottom-0 bg-white dark:bg-zinc-950 py-4 border-t dark:border-zinc-800 flex justify-end gap-3 z-10 mt-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-bold hover:bg-zinc-300">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-green-600/20">
                  {loading && <Loader2 className="animate-spin" size={18} />}
                  Salvar Inspeção e Gerar Backlog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

    {/* VISUALIZADOR E ÁREA DE IMPRESSÃO */}
    {viewChecklist && (
      <div className="fixed inset-0 z-[100] flex justify-center bg-zinc-100 dark:bg-zinc-950 overflow-y-auto print:bg-white print:p-0">
        <div className="w-full max-w-4xl bg-white p-8 print:p-2 min-h-screen print:min-h-0 print:h-auto shadow-xl print:shadow-none relative">
          
          <div className="absolute top-4 right-4 flex gap-2 print:hidden flex-wrap justify-end">
            <button onClick={() => window.print()} className="px-4 py-2 bg-zinc-600 text-white rounded font-bold text-sm shadow hover:bg-zinc-700 flex items-center gap-2">
              Imprimir
            </button>
            <button onClick={() => handleExportPDF(viewChecklist, "download")} disabled={!!exportandoPdf} className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm shadow hover:bg-blue-700 flex items-center gap-2 disabled:opacity-60">
              <Download size={16}/> {exportandoPdf === "download" ? "Gerando..." : "Baixar PDF"}
            </button>
            <button onClick={() => handleExportPDF(viewChecklist, "share")} disabled={!!exportandoPdf} className="px-4 py-2 bg-emerald-600 text-white rounded font-bold text-sm shadow hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-60">
              <Share2 size={16}/> {exportandoPdf === "share" ? "Gerando..." : "Compartilhar PDF"}
            </button>
            <button onClick={() => setViewChecklist(null)} className="p-2 bg-zinc-200 text-zinc-600 rounded hover:bg-zinc-300 shadow">
              <X size={20}/>
            </button>
          </div>

          <div id="ficha-checklist-print">
            <div className="border-b-2 border-zinc-900 pb-4 mb-6">
              <h1 className="text-2xl font-black text-center uppercase tracking-widest text-zinc-900">Checklist Mecânico - {viewChecklist.tipo_caminhao}</h1>
              <div className="flex justify-between items-center mt-4 text-xs font-bold text-zinc-700">
                <span>Data: {new Date(viewChecklist.criado_em).toLocaleDateString('pt-BR')}</span>
                <span>ID: {String(viewChecklist.id).padStart(5,'0')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 p-4 border rounded bg-zinc-50 border-zinc-300 text-zinc-800 text-sm">
              <div><span className="font-bold">Placa:</span> {viewChecklist.placa}</div>
              <div><span className="font-bold">C.O:</span> {viewChecklist.co}</div>
              <div><span className="font-bold">Local:</span> {viewChecklist.local}</div>
              <div><span className="font-bold">Status:</span> {viewChecklist.status}</div>
            </div>

            <div className="space-y-6 text-zinc-800">
              {getViewConfig(viewChecklist.tipo_caminhao).map(group => (
                <div key={group.id} className="space-y-2">
                  <h3 className="font-bold bg-zinc-200 p-1 px-2 border-l-4 border-zinc-500 uppercase text-xs">{group.title}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map(item => renderItem(item, viewChecklist.respostas))}
                  </div>
                </div>
              ))}

              {viewChecklist.pendencias_adicionais && (
                <div className="mt-8">
                  <h3 className="font-bold bg-zinc-200 p-1 px-2 border-l-4 border-zinc-500 uppercase text-xs mb-2">Pendências Adicionais / Observações</h3>
                  <div className="border border-zinc-300 p-3 whitespace-pre-wrap text-sm">
                    {viewChecklist.pendencias_adicionais}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-12 text-center text-xs text-zinc-500 border-t pt-4 print:block">
              Documento gerado automaticamente pelo EUNAMAN Sistema.
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
