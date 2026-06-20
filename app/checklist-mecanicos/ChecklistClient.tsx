'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Search, CheckCircle, XCircle, AlertTriangle, FileText, Download, X } from 'lucide-react'
import { localDb } from '@/lib/offline-db'
import { salvarChecklist, excluirChecklist } from './actions'
import { PremiumLoader } from '@/components/premium-loader'
// Removendo dependências não instaladas: sonner, jspdf, jspdf-autotable

// Mock de perguntas por tipo de caminhão
const getQuestionsByType = (type: string) => {
  const common = [
    { id: 'c1', label: 'Nível de óleo do motor' },
    { id: 'c2', label: 'Nível de água do radiador' },
    { id: 'c3', label: 'Condição das correias' },
    { id: 'c4', label: 'Vazamentos no motor/transmissão' },
    { id: 'c5', label: 'Funcionamento de luzes/painel' },
    { id: 'c6', label: 'Condição dos pneus' }
  ]
  
  if (type === 'Pipa') {
    return [...common, 
      { id: 'p1', label: 'Bomba d\'água (vazamento/ruído)' },
      { id: 'p2', label: 'Mangotes e conexões' },
      { id: 'p3', label: 'Canhão e aspersores' }
    ]
  } else if (type === 'Comboio') {
    return [...common,
      { id: 'cm1', label: 'Bombas de abastecimento' },
      { id: 'cm2', label: 'Bicos, mangueiras e carretéis' },
      { id: 'cm3', label: 'Compressores e manômetros' },
      { id: 'cm4', label: 'Aterramento e segurança estática' }
    ]
  } else if (type === 'Munck') {
    return [...common,
      { id: 'm1', label: 'Sistema hidráulico (vazamentos)' },
      { id: 'm2', label: 'Cilindros e patolas' },
      { id: 'm3', label: 'Cabos de aço, ganchos e cintas' },
      { id: 'm4', label: 'Comandos hidráulicos / Joystick' }
    ]
  } else if (type === 'Multifuncional') {
    return [...common,
      { id: 'mf1', label: 'Implementos de tração' },
      { id: 'mf2', label: 'Tomada de força (PTO)' },
      { id: 'mf3', label: 'Engates rápidos' }
    ]
  }
  return common
}

export default function ChecklistClient({ initialChecklists, userRole, userId }: { initialChecklists: any[], userRole: string, userId: string }) {
  const [checklists, setChecklists] = useState(initialChecklists)
  const [frota, setFrota] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // States do formulário
  const [tipo, setTipo] = useState('')
  const [placa, setPlaca] = useState('')
  const [co, setCo] = useState('')
  const [local, setLocal] = useState('')
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [pendencias, setPendencias] = useState('')

  useEffect(() => {
    // Carregar frota do indexedDB para o autocomplete da placa
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
    const questions = getQuestionsByType(tipo)
    const labelsMap: any = {}
    questions.forEach(q => { labelsMap[q.id] = q.label })
    formData.append('questionsLabels', JSON.stringify(labelsMap))

    const result = await salvarChecklist(formData)
    setLoading(false)

    if (result?.error) {
      alert(result.error)
    } else {
      alert("Checklist Fechado! OS e Backlog gerados.")
      setChecklists([result.data, ...checklists])
      setIsModalOpen(false)
      // reset
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

  const gerarPDF = (checklist: any) => {
    alert("Função de PDF está sendo implementada usando a biblioteca padrão do sistema.")
    // PDF Generation will use the system's standard html2pdf or window.print in the future.
  }

  const questions = tipo ? getQuestionsByType(tipo) : []

  return (
    <div className="p-4 lg:p-6 w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Checklists Mecânicos</h1>
          <p className="text-zinc-500 text-sm">Inspeções de frota integradas a OS e Backlog.</p>
        </div>
        {(userRole === 'admin' || userRole === 'mecanico' || userRole === 'gestao') && (
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
                    <button onClick={() => gerarPDF(item)} className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="Baixar PDF">
                      <Download size={16} />
                    </button>
                    {(userRole === 'admin' || userRole === 'gestao') && (
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
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold dark:text-white">Novo Checklist Mecânico</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Tipo de Caminhão</label>
                  <select 
                    value={tipo} 
                    onChange={e => setTipo(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="Multifuncional">Multifuncional</option>
                    <option value="Comboio">Comboio</option>
                    <option value="Pipa">Pipa</option>
                    <option value="Munck">Munck</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Placa (Auto-completar)</label>
                  <input 
                    list="frotas"
                    value={placa} 
                    onChange={e => handlePlacaChange(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Digite a placa..."
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
                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b pb-2 dark:border-zinc-800 dark:text-white">Itens de Inspeção</h3>
                  <p className="text-xs text-zinc-500 mb-4">C: Conforme | NC: Não Conforme (Gera Backlog) | NA: Não se Aplica</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {questions.map((q) => (
                      <div key={q.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg flex flex-col justify-between">
                        <span className="text-sm font-medium dark:text-zinc-200 mb-2">{q.label}</span>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs cursor-pointer">
                            <input type="radio" name={q.id} value="C" required onChange={() => setRespostas(r => ({...r, [q.id]: 'C'}))} checked={respostas[q.id] === 'C'} /> <span className="text-green-600 font-bold">C</span>
                          </label>
                          <label className="flex items-center gap-1 text-xs cursor-pointer">
                            <input type="radio" name={q.id} value="NC" required onChange={() => setRespostas(r => ({...r, [q.id]: 'NC'}))} checked={respostas[q.id] === 'NC'} /> <span className="text-red-600 font-bold">NC</span>
                          </label>
                          <label className="flex items-center gap-1 text-xs cursor-pointer">
                            <input type="radio" name={q.id} value="NA" required onChange={() => setRespostas(r => ({...r, [q.id]: 'NA'}))} checked={respostas[q.id] === 'NA'} /> <span className="text-zinc-500 font-bold">NA</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Pendências Adicionais (Backlog extra)</label>
                    <p className="text-xs text-zinc-500 mb-2">Digite uma pendência por linha. Cada linha irá gerar um item no Backlog.</p>
                    <textarea 
                      value={pendencias}
                      onChange={e => setPendencias(e.target.value)}
                      rows={4}
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none resize-y"
                      placeholder="Ex: Espelho retrovisor trincado&#10;Limpador de parabrisa não funciona"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-bold">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold flex items-center gap-2">
                  {loading && <PremiumLoader type="spinner" size={16} />}
                  Salvar e Fechar Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
