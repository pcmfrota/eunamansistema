'use client';

import { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  X, 
  RotateCcw, 
  FileSpreadsheet, 
  Layout, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Download,
  Calendar,
  Clock,
  HardDrive
} from "lucide-react";
import { criarPreventiva, importarPreventivas } from "./actions";
import { useFormDraft } from '@/hooks/use-form-draft';

type Equipamento = {
  id: string;
  placa: string;
  tipo?: string;
  modulo?: string;
  categoria?: string;
  ultimoHist?: number;
};

interface PreventivaFormValues {
  equipamento_id: string;
  tipo: string;
  modulo: string;
  ultimo_horimetro: string;
  horimetro_atual: string;
  intervalo_horas: string;
  data_atualizacao: string;
}

export default function NovaPreventivaModal({ equipamentos }: { equipamentos: Equipamento[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  const [loading, setLoading] = useState(false);
  const [selectedEq, setSelectedEq] = useState<Equipamento | null>(null);

  // Import State
  const [importRows, setImportRows] = useState<any[]>([]);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [XLSX, setXLSX] = useState<any>(null);

  const initialValues: PreventivaFormValues = {
    equipamento_id: "",
    tipo: "",
    modulo: "",
    ultimo_horimetro: "",
    horimetro_atual: "",
    intervalo_horas: "500",
    data_atualizacao: new Date().toISOString().split('T')[0],
  };

  const { form, setForm, hasContent: hasDraft, clearDraft } = useFormDraft<PreventivaFormValues>('preventiva', initialValues);

  useEffect(() => {
    if (form.equipamento_id) {
      const eq = equipamentos.find(e => e.id === form.equipamento_id);
      if (eq) setSelectedEq(eq);
    }
  }, [form.equipamento_id, equipamentos]);

  // Lazy Load SheetJS
  useEffect(() => {
    if (isOpen && !XLSX) {
      if ((window as any).XLSX) {
        setXLSX((window as any).XLSX);
      } else {
        const script = document.createElement("script");
        script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
        script.onload = () => setXLSX((window as any).XLSX);
        document.head.appendChild(script);
      }
    }
  }, [isOpen, XLSX]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));

    if (name === 'equipamento_id') {
      const eq = equipamentos.find(eq => eq.id === value);
      setSelectedEq(eq || null);
      if (eq) {
        setForm(prev => ({ 
          ...prev, 
          tipo: eq.tipo || "", 
          modulo: eq.modulo || "",
          ultimo_horimetro: eq.ultimoHist?.toString() || ""
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await criarPreventiva(formData);
    if ('error' in result) {
      alert("Erro: " + result.error);
    } else {
      clearDraft();
      setIsOpen(false);
      setSelectedEq(null);
    }
    setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !XLSX) return;
    setParsing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        setImportRows(data);
      } catch (err) {
        alert("Erro ao ler Excel");
      } finally {
        setParsing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportConfirm = async () => {
    setLoading(true);
    const res = await importarPreventivas(importRows);
    if ('error' in res) {
      alert(`Erro na importação: ${res.error}`);
    } else {
      alert(`${res.count} programações processadas com sucesso!`);
      setIsOpen(false);
      setImportRows([]);
    }
    setLoading(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-500/20 transition-all active:scale-95 group"
      >
        <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
        Nova Preventiva
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded-xl">
                  <RotateCcw size={22} className={loading ? "animate-spin" : ""} />
                </div>
                <div>
                   <h2 className="text-xl font-bold tracking-tight">Gerenciar Preventivas</h2>
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Cronograma de Manutenção</span>
                     {hasDraft && activeTab === 'manual' && (
                       <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                     )}
                   </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex px-6 pt-4 gap-6 border-b border-zinc-100 dark:border-zinc-900">
               <button 
                 onClick={() => setActiveTab('manual')}
                 className={`pb-3 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'manual' ? 'text-blue-600' : 'text-zinc-400 hover:text-zinc-600'}`}
               >
                 <div className="flex items-center gap-2 px-1">
                   <Layout size={14} /> Digitação Manual
                 </div>
                 {activeTab === 'manual' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
               </button>
               <button 
                 onClick={() => setActiveTab('import')}
                 className={`pb-3 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'import' ? 'text-blue-600' : 'text-zinc-400 hover:text-zinc-600'}`}
               >
                 <div className="flex items-center gap-2 px-1">
                   <FileSpreadsheet size={14} /> Importar Excel
                 </div>
                 {activeTab === 'import' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
               </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {activeTab === 'manual' ? (
                <form id="preventiva-form" onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1">Equipamento</label>
                      <select 
                        name="equipamento_id" 
                        required 
                        value={form.equipamento_id}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      >
                        <option value="">Selecione...</option>
                        {equipamentos.map(eq => (
                          <option key={eq.id} value={eq.id}>{eq.placa} ({eq.tipo || 'N/A'})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                       <label className="text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1">Data de Referência</label>
                       <div className="relative group">
                          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                          <input 
                            name="data_atualizacao" 
                            type="date" 
                            required 
                            value={form.data_atualizacao}
                            onChange={handleInputChange}
                            className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1">Tipo de Serviço</label>
                      <div className="relative group">
                        <HardDrive className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input name="tipo" type="text" placeholder="EX: REVISÃO 1000h" value={form.tipo} onChange={handleInputChange} className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1">Módulo</label>
                      <input name="modulo" type="text" placeholder="EX: MOTOR" value={form.modulo} onChange={handleInputChange} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1">Últ. Ref (h)</label>
                      <input name="ultimo_horimetro" type="number" step="0.1" required value={form.ultimo_horimetro} onChange={handleInputChange} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-2 text-blue-600">
                      <label className="text-xs font-black uppercase tracking-tighter text-blue-500/70 ml-1">Hor. Atual (h)</label>
                      <input name="horimetro_atual" type="number" step="0.1" required value={form.horimetro_atual} onChange={handleInputChange} className="w-full px-4 py-3 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1">Intervalo (h)</label>
                      <div className="relative group">
                        <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                        <input name="intervalo_horas" type="number" required value={form.intervalo_horas} onChange={handleInputChange} className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                      </div>
                    </div>
                  </div>

                  {hasDraft && (
                    <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                       <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                         <AlertCircle size={14} /> Você tem um rascunho salvo.
                       </span>
                       <button type="button" onClick={clearDraft} className="text-amber-700 hover:underline text-xs font-black">LIMPAR</button>
                    </div>
                  )}
                </form>
              ) : (
                <div className="space-y-6 flex flex-col items-center">
                   {importRows.length === 0 ? (
                     <div className="grid grid-cols-1 gap-6 w-full max-w-md py-10">
                        <button 
                          onClick={() => fileRef.current?.click()}
                          className="flex flex-col items-center gap-4 p-10 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all group"
                        >
                          <Upload className="text-zinc-400 group-hover:text-blue-500 transition-colors" size={40} />
                          <div className="text-center">
                            <span className="block text-base font-bold">Enviar Planilha</span>
                            <span className="text-xs text-zinc-400 font-medium font-bold">Suporta .xlsx e .xls</span>
                          </div>
                          <input type="file" ref={fileRef} onChange={handleFileUpload} accept=".xlsx,.xls" className="hidden" />
                        </button>
                        <button className="flex items-center justify-center gap-2 text-xs font-black text-zinc-500 hover:text-zinc-700">
                          <Download size={14} /> BAIXAR MODELO PREVENTIVAS
                        </button>
                     </div>
                   ) : (
                     <div className="w-full space-y-4">
                        <div className="flex items-center justify-between">
                           <span className="text-sm font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                             <CheckCircle2 className="text-emerald-500" size={18} /> {importRows.length} linhas detectadas
                           </span>
                           <button onClick={() => setImportRows([])} className="text-[10px] font-black text-red-500 uppercase">Remover</button>
                        </div>
                        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden text-[10px] max-h-64 overflow-y-auto font-medium">
                           <table className="w-full text-left">
                             <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                               <tr>
                                 <th className="p-2">Placa</th>
                                 <th className="p-2 text-center">Horimetro</th>
                                 <th className="p-2 text-center">Intervalo</th>
                                 <th className="p-2">Tipo</th>
                               </tr>
                             </thead>
                             <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                               {importRows.slice(0, 10).map((row, i) => (
                                 <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                                   <td className="p-2 font-bold">{row.placa || row.Placa}</td>
                                   <td className="p-2 text-center">{row.horimetro || row.Horimetro}</td>
                                   <td className="p-2 text-center">{row.intervalo || row.Intervalo}</td>
                                   <td className="p-2 truncate max-w-[100px]">{row.tipo || row.Tipo}</td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                        </div>
                     </div>
                   )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end items-center gap-3">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
              >
                Cancelar
              </button>
              {activeTab === 'manual' ? (
                <button 
                  type="submit" 
                  form="preventiva-form"
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all font-bold"
                >
                  {loading ? <RotateCcw size={18} className="animate-spin" /> : "Salvar Preventiva"}
                </button>
              ) : (
                <button 
                  onClick={handleImportConfirm}
                  disabled={loading || importRows.length === 0}
                  className="flex items-center gap-2 px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all font-bold"
                >
                  {loading ? <RotateCcw size={18} className="animate-spin" /> : `Confirmar Importação (${importRows.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
