'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { 
  Calendar as CalendarIcon, 
  Grid, 
  Search, 
  Filter, 
  Plus, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Camera, 
  FileText,
  Trash2,
  Check,
  ZoomIn,
  Download,
  MoreVertical
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Lavagem, saveLavagem, deleteLavagem, validarLavagem } from './actions'
import { supabase } from '@/lib/supabase'
import { useOffline } from '@/components/offline-provider'
import { localDb } from '@/lib/offline-db'

// Safe date formatter to prevent RangeError from date-fns
const safeFormatDate = (dateVal: any, formatPattern: string, options?: any) => {
  if (!dateVal) return '-';
  try {
    let dateObj: Date;
    if (dateVal instanceof Date) {
      dateObj = dateVal;
    } else {
      const dateStr = String(dateVal);
      const cleanStr = dateStr.includes(' ') ? dateStr.replace(' ', 'T') : dateStr;
      const finalStr = cleanStr.includes('T') ? cleanStr : cleanStr + 'T12:00:00';
      dateObj = new Date(finalStr);
    }
    if (isNaN(dateObj.getTime())) return '-';
    return format(dateObj, formatPattern, options);
  } catch (e) {
    return '-';
  }
};

interface LavagensClientProps {
  initialLavagens: Lavagem[]
  equipamentos: any[]
  currentMes: number
  currentAno: number
}

const STATUS_COLORS = {
  'Lavado': 'bg-emerald-500',
  'Pendente': 'bg-amber-500',
  'Não realizado': 'bg-red-500',
  'default': 'bg-zinc-200 dark:bg-zinc-800'
}

// Helper para compressão de imagem via canvas para ~50KB
const compressBase64 = (dataUrl: string, maxWidth = 800, maxHeight = 800, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
      } else {
        if (h > maxHeight) {
          w = Math.round((w * maxHeight) / h);
          h = maxHeight;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
  });
};

export default function LavagensClient({ initialLavagens, equipamentos, currentMes, currentAno }: LavagensClientProps) {
  const { isOnline } = useOffline()
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<'calendar' | 'gallery'>('calendar')
  const [lavagens, setLavagens] = useState<Lavagem[]>(initialLavagens)
  const [selectedLavagem, setSelectedLavagem] = useState<Lavagem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [activeDate, setActiveDate] = useState(new Date(currentAno, currentMes - 1))
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [filterArea, setFilterArea] = useState('Todas')

  const areaOptions = useMemo(() => {
    const s = new Set<string>()
    equipamentos.forEach(e => { if (e.area) s.add(e.area) })
    return ['Todas', ...Array.from(s).sort()]
  }, [equipamentos])
  
  // Modal State
  const [modalData, setModalData] = useState<any>({
    placa: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    colaborador: '',
    horimetro: '',
    km: '',
    lavagem_realizada: true,
    observacoes: '',
    imagem_1_url: '',
    imagem_2_url: '',
    imagem_3_url: '',
    imagem_horimetro_url: ''
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setLavagens(initialLavagens)
  }, [initialLavagens])

  // ── Registra o callback da ponte nativa do APK (EunamanCamera) para Lavagens ──
  useEffect(() => {
    if (typeof window === "undefined" || !mounted) return;

    (window as any).onEunamanCameraResult = async (jsonStr: string) => {
      try {
        const result = JSON.parse(jsonStr);
        if (result.success && result.dataUrl) {
          const activeField = localStorage.getItem('eunaman_lavagens_active_field');
          if (activeField) {
            const compressed = await compressBase64(result.dataUrl);
            setModalData((prev: any) => ({ ...prev, [activeField]: compressed }));
          }
        } else if (!result.success) {
          console.warn("[EunamanCamera] Erro na ponte nativa:", result.error);
        }
      } catch (e) {
        console.error("[EunamanCamera] Erro ao processar resultado:", e);
      }
    };

    // Recupera foto pendente se a Activity tiver sido recriada pelo Android
    const timer = setTimeout(() => {
      if ((window as any).EunamanCamera && (window as any).EunamanCamera.getPendingPhoto) {
        try {
          const pending = (window as any).EunamanCamera.getPendingPhoto();
          if (pending) {
            (window as any).onEunamanCameraResult(pending);
          }
        } catch (e) {
          console.warn("[EunamanCamera] Erro ao buscar foto pendente:", e);
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      delete (window as any).onEunamanCameraResult;
    };
  }, [mounted]);

  const hasRestoredRef = useRef(false);

  // Salvar rascunho do lançamento de lavagem
  useEffect(() => {
    if (!mounted || !hasRestoredRef.current) return;
    try {
      if (isModalOpen) {
        localStorage.setItem('eunaman_lavagens_modal_data', JSON.stringify(modalData));
        localStorage.setItem('eunaman_lavagens_modal_open', 'true');
      } else {
        localStorage.removeItem('eunaman_lavagens_modal_data');
        localStorage.setItem('eunaman_lavagens_modal_open', 'false');
        localStorage.removeItem('eunaman_lavagens_active_field');
      }
    } catch (e) {
      console.error("Erro ao salvar rascunho de lavagem:", e);
    }
  }, [modalData, isModalOpen, mounted]);

  // Restaurar rascunho do lançamento de lavagem ao montar
  useEffect(() => {
    if (typeof window === "undefined" || !mounted) return;
    try {
      const modalOpen = localStorage.getItem('eunaman_lavagens_modal_open');
      const draft = localStorage.getItem('eunaman_lavagens_modal_data');
      if (modalOpen === 'true' && draft) {
        const parsed = JSON.parse(draft);
        if (parsed && typeof parsed === 'object') {
          setModalData(parsed);
          setIsModalOpen(true);
        }
      }
    } catch (e) {
      console.error("Erro ao restaurar rascunho de lavagem:", e);
    } finally {
      hasRestoredRef.current = true;
    }
  }, [mounted]);

  const days = useMemo(() => {
    const start = startOfMonth(activeDate)
    const end = endOfMonth(activeDate)
    return eachDayOfInterval({ start, end })
  }, [activeDate])

  const filteredLavagens = useMemo(() => {
    return lavagens.filter(l => {
      const matchesSearch = l.placa.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = filterStatus === 'Todos' || l.status === filterStatus
      
      let matchesArea = true
      if (filterArea !== 'Todas') {
        const eq = equipamentos.find(e => e.placa === l.placa)
        matchesArea = eq?.area === filterArea
      }

      return matchesSearch && matchesStatus && matchesArea
    })
  }, [lavagens, searchTerm, filterStatus, filterArea, equipamentos])

  const getStatus = (placa: string, date: Date) => {
    const lavagem = lavagens.find(l => {
      if (!l.data) return false;
      const d = new Date(l.data.includes('T') ? l.data : l.data + 'T12:00:00');
      return l.placa === placa && !isNaN(d.getTime()) && isSameDay(d, date);
    });
    return lavagem
  }

  const handleOpenModal = (placa: string, date: Date) => {
    const existing = getStatus(placa, date)
    if (existing) {
      setModalData({
        ...existing,
        horimetro: String(existing.horimetro || ''),
        km: String(existing.km || '')
      })
    } else {
      setModalData({
        placa,
        data: format(date, 'yyyy-MM-dd'),
        colaborador: '',
        horimetro: '',
        km: '',
        lavagem_realizada: true,
        observacoes: '',
        imagem_1_url: '',
        imagem_2_url: '',
        imagem_3_url: '',
        imagem_horimetro_url: ''
      })
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = modalData.id || `temp_${Date.now()}`
    const dataToSave = {
      ...modalData,
      id,
      horimetro: Number(modalData.horimetro || 0),
      km: Number(modalData.km || 0),
      status: !modalData.lavagem_realizada ? 'Não realizado' : (!modalData.horimetro || !modalData.km || !modalData.colaborador ? 'Pendente' : 'Lavado')
    }

    if (isOnline) {
      const formData = new FormData()
      Object.entries(dataToSave).forEach(([key, value]) => {
        formData.append(key, String(value))
      })
      const res = await saveLavagem(formData)
      if (res.success) {
        await localDb.put("lavagens", dataToSave)
        window.dispatchEvent(new CustomEvent("offline-db-updated-lavagens"))
        setIsModalOpen(false)
      } else {
        alert('Erro ao salvar: ' + res.error)
      }
    } else {
      const localData = { ...dataToSave, _isPendingSync: true }
      await localDb.put("lavagens", localData)
      const formDataObj: Record<string, any> = {}
      Object.entries(dataToSave).forEach(([key, value]) => {
        formDataObj[key] = value
      })
      await localDb.addToQueue("lavagem", modalData.id ? "update" : "create", formDataObj)
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"))
      window.dispatchEvent(new CustomEvent("offline-db-updated-lavagens"))
      setIsModalOpen(false)
      alert("✅ Lançamento salvo localmente! Será sincronizado assim que a conexão voltar.")
    }
  }

  const handleCapture = (field: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem('eunaman_lavagens_active_field', field);
      localStorage.setItem('eunaman_lavagens_modal_data', JSON.stringify(modalData));
      localStorage.setItem('eunaman_lavagens_modal_open', 'true');
      if ((window as any).EunamanCamera && (window as any).EunamanCamera.openCamera) {
        try {
          (window as any).EunamanCamera.openCamera();
        } catch (e) {
          console.error("Erro ao chamar openCamera nativo:", e);
        }
      } else {
        alert("Câmera nativa disponível apenas no aplicativo APK.");
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const compressed = await compressBase64(base64);
      setModalData((prev: any) => ({ ...prev, [field]: compressed }));
    };
  };

  const dayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

  return (
    <div className="flex flex-col h-full bg-transparent text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans">
      {/* Header */}
      <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black tracking-tighter flex items-center gap-2 text-zinc-900 dark:text-white">
            <span className="p-2 bg-blue-600 rounded-lg text-white"><Clock size={20} /></span>
            CONTROLE DE LAVAGENS
          </h1>
          <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-lg p-1 border border-zinc-200 dark:border-zinc-800 ml-4">
            <button 
              onClick={() => setView('calendar')}
              className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2", 
                view === 'calendar' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-white")}
            >
              <CalendarIcon size={14} /> CALENDÁRIO
            </button>
            <button 
              onClick={() => setView('gallery')}
              className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2", 
                view === 'gallery' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-white")}
            >
              <Grid size={14} /> GALERIA
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Filtrar por placa..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-48 text-zinc-900 dark:text-white"
            />
          </div>

          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none cursor-pointer min-w-[120px] font-bold text-zinc-700 dark:text-zinc-400"
          >
            {areaOptions.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
          </select>
          
          <button 
            onClick={() => setActiveDate(subMonths(activeDate, 1))}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-sm font-bold min-w-[140px] text-center uppercase tracking-widest bg-white/80 dark:bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
            {format(activeDate, 'MMMM yyyy', { locale: ptBR })}
          </div>
          <button 
            onClick={() => setActiveDate(addMonths(activeDate, 1))}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 custom-scrollbar">
        {view === 'calendar' ? (
          <div className="bg-white/80 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-200px)] custom-scrollbar">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-zinc-100/90 dark:bg-zinc-900/90 backdrop-blur-md">
                    <th className="p-3 text-left text-[10px] font-black text-zinc-600 dark:text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 border-r min-w-[120px] sticky left-0 z-30 bg-zinc-100 dark:bg-zinc-900">
                      PLACAS
                    </th>
                    {days.map(day => (
                      <th key={day.toString()} className="p-2 text-center border-b border-zinc-200 dark:border-zinc-800 border-r min-w-[50px]">
                        <div className="text-[10px] font-bold text-zinc-600 dark:text-zinc-500">{dayNames[getDay(day)]}</div>
                        <div className="text-sm font-black text-zinc-900 dark:text-white">{format(day, 'dd')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {equipamentos.filter(e => {
                    const matchesSearch = e.placa.toLowerCase().includes(searchTerm.toLowerCase())
                    const matchesArea = filterArea === 'Todas' || e.area === filterArea
                    return matchesSearch && matchesArea
                  }).map(eq => (
                    <tr key={eq.placa} className="hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 transition-colors group">
                      <td className="p-3 border-b border-r border-zinc-200 dark:border-zinc-800 font-bold text-sm sticky left-0 z-10 bg-white dark:bg-zinc-950 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-900 text-zinc-800 dark:text-zinc-300 transition-colors">
                        <div className="flex flex-col">
                          <span className="text-blue-500">{eq.placa}</span>
                          <span className="text-[10px] text-zinc-500 font-normal">{eq.modulo}</span>
                        </div>
                      </td>
                      {days.map(day => {
                        const lavagem = getStatus(eq.placa, day)
                        return (
                          <td 
                            key={day.toString()} 
                            className="p-1 border-b border-r border-zinc-200 dark:border-zinc-800 text-center cursor-pointer group/cell"
                            onClick={() => handleOpenModal(eq.placa, day)}
                          >
                            <div className={cn(
                              "w-8 h-8 mx-auto rounded-lg flex items-center justify-center transition-all transform group-hover/cell:scale-110 relative",
                              lavagem ? STATUS_COLORS[lavagem.status as keyof typeof STATUS_COLORS] : STATUS_COLORS.default
                            )}>
                              {lavagem?.status === 'Lavado' && <Check size={14} className="text-white font-bold" />}
                              {lavagem?.status === 'Pendente' && <AlertCircle size={14} className="text-white" />}
                              {lavagem?.status === 'Não realizado' && <X size={14} className="text-white" />}
                              {lavagem && (lavagem as any)._isPendingSync && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-white flex items-center justify-center animate-pulse" title="Lançamento offline pendente de sincronização"></span>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {filteredLavagens.map(l => (
              <div 
                key={l.id} 
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all cursor-pointer group shadow-lg"
                onClick={() => { setSelectedLavagem(l); setIsPanelOpen(true); }}
              >
                <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                  {l.imagem_1_url ? (
                    <img src={l.imagem_1_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800">
                      <Camera size={32} strokeWidth={1} />
                      <span className="text-[10px] uppercase font-bold mt-2">Sem Evidência</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className={cn("px-2 py-1 text-[9px] font-black uppercase rounded-md text-white shadow-lg", STATUS_COLORS[l.status as keyof typeof STATUS_COLORS])}>
                      {l.status}
                    </span>
                    {l.validated_at && (
                      <span className="px-2 py-1 text-[9px] font-black uppercase rounded-md bg-blue-600 text-white shadow-lg">
                        VALIDADO
                      </span>
                    )}
                    {(l as any)._isPendingSync && (
                      <span className="px-2 py-1 text-[9px] font-black uppercase rounded-md bg-amber-500 text-white shadow-lg flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        OFFLINE
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-black text-lg text-zinc-900 dark:text-white leading-none">{l.placa}</h3>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold mt-1 tracking-wider">{safeFormatDate(l.data, "dd 'de' MMMM", { locale: ptBR })}</p>
                    </div>
                    <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                      {l.colaborador?.charAt(0) || '?'}
                    </div>
                    <span className="truncate flex-1">{l.colaborador || 'Colaborador não informado'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Lançamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <form onSubmit={handleSave}>
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-600 rounded-md"><Check size={16} /></span>
                    LANÇAR LAVAGEM
                  </h2>
                  <p className="text-xs text-zinc-500 font-bold mt-1 uppercase tracking-widest">Placa: <span className="text-blue-500">{modalData.placa}</span> | Data: {modalData.data}</p>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-500 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Colaborador Responsável</label>
                  <input 
                    type="text" 
                    required
                    value={modalData.colaborador}
                    onChange={e => setModalData({...modalData, colaborador: e.target.value})}
                    placeholder="Nome completo..."
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none text-zinc-900 dark:text-white" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Horímetro</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={modalData.horimetro}
                    onChange={e => setModalData({...modalData, horimetro: e.target.value})}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none text-zinc-900 dark:text-white" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">KM</label>
                  <input 
                    type="number" 
                    value={modalData.km}
                    onChange={e => setModalData({...modalData, km: e.target.value})}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none text-zinc-900 dark:text-white" 
                  />
                </div>

                <div className="col-span-2 flex items-center gap-4 py-2">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Lavagem Realizada?</span>
                  <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-xl p-1 border border-zinc-200 dark:border-zinc-800">
                    <button 
                      type="button"
                      onClick={() => setModalData({...modalData, lavagem_realizada: true})}
                      className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", modalData.lavagem_realizada ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300")}
                    >
                      SIM
                    </button>
                    <button 
                      type="button"
                      onClick={() => setModalData({...modalData, lavagem_realizada: false})}
                      className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", !modalData.lavagem_realizada ? "bg-red-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300")}
                    >
                      NÃO
                    </button>
                  </div>
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Observações</label>
                  <textarea 
                    rows={2}
                    value={modalData.observacoes}
                    onChange={e => setModalData({...modalData, observacoes: e.target.value})}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none text-zinc-900 dark:text-white" 
                  />
                </div>

                {/* File Uploads */}
                <div className="col-span-2 pt-4 border-t border-zinc-800 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <UploadBox 
                    label="Horímetro" 
                    field="imagem_horimetro_url" 
                    url={modalData.imagem_horimetro_url} 
                    onCapture={handleCapture}
                    onFileSelect={handleFileSelect}
                    onClear={(field: string) => setModalData((prev: any) => ({ ...prev, [field]: '' }))}
                  />
                  <UploadBox 
                    label="Foto 01" 
                    field="imagem_1_url" 
                    url={modalData.imagem_1_url} 
                    onCapture={handleCapture}
                    onFileSelect={handleFileSelect}
                    onClear={(field: string) => setModalData((prev: any) => ({ ...prev, [field]: '' }))}
                  />
                  <UploadBox 
                    label="Foto 02" 
                    field="imagem_2_url" 
                    url={modalData.imagem_2_url} 
                    onCapture={handleCapture}
                    onFileSelect={handleFileSelect}
                    onClear={(field: string) => setModalData((prev: any) => ({ ...prev, [field]: '' }))}
                  />
                  <UploadBox 
                    label="Foto 03" 
                    field="imagem_3_url" 
                    url={modalData.imagem_3_url} 
                    onCapture={handleCapture}
                    onFileSelect={handleFileSelect}
                    onClear={(field: string) => setModalData((prev: any) => ({ ...prev, [field]: '' }))}
                  />
                </div>
              </div>

              <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-end gap-3 rounded-b-3xl">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  CANCELAR
                </button>
                <button type="submit" className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95">
                  SALVAR REGISTRO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Side Panel Detalhes */}
      {isPanelOpen && selectedLavagem && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-slide-in-right">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/30">
            <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="p-1.5 bg-blue-600 rounded-md text-white"><FileText size={16} /></span>
              DETALHES
            </h2>
            <button onClick={() => setIsPanelOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">PLACA</p>
                  <p className="text-xl font-black text-blue-600 dark:text-blue-500">{selectedLavagem.placa}</p>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">DATA</p>
                  <p className="text-lg font-black text-zinc-900 dark:text-white">{safeFormatDate(selectedLavagem.data, 'dd/MM/yyyy')}</p>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">COLABORADOR</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{selectedLavagem.colaborador || 'Não informado'}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-black text-blue-600 dark:text-blue-500">
                    {selectedLavagem.colaborador?.charAt(0) || '?'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/50">
                  <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">HORÍMETRO</p>
                    <p className="text-md font-bold text-zinc-800 dark:text-zinc-200">{selectedLavagem.horimetro || '0.0'} h</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">KM</p>
                    <p className="text-md font-bold text-zinc-800 dark:text-zinc-200">{selectedLavagem.km || '0'} km</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">OBSERVAÇÕES</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-400 italic">"{selectedLavagem.observacoes || 'Nenhuma observação informada.'}"</p>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Camera size={14} /> EVIDÊNCIAS FOTOGRÁFICAS
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <ImagePreview url={selectedLavagem.imagem_horimetro_url} label="Horímetro" />
                <ImagePreview url={selectedLavagem.imagem_1_url} label="Foto 01" />
                <ImagePreview url={selectedLavagem.imagem_2_url} label="Foto 02" />
                <ImagePreview url={selectedLavagem.imagem_3_url} label="Foto 03" />
              </div>
            </section>
          </div>

          <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 space-y-3">
            {!selectedLavagem.validated_at && (
              <button 
                onClick={async () => {
                  if (confirm('Validar esta lavagem?')) {
                    if (isOnline) {
                      await validarLavagem(selectedLavagem.id)
                      await localDb.put("lavagens", { ...selectedLavagem, validated_at: new Date().toISOString(), status: 'Lavado' })
                      window.dispatchEvent(new CustomEvent("offline-db-updated-lavagens"))
                    } else {
                      const updated = { ...selectedLavagem, validated_at: new Date().toISOString(), status: 'Lavado', _isPendingSync: true }
                      await localDb.put("lavagens", updated)
                      await localDb.addToQueue("lavagem", "validate", { id: selectedLavagem.id })
                      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"))
                      window.dispatchEvent(new CustomEvent("offline-db-updated-lavagens"))
                      alert("✅ Lavagem validada localmente! Será sincronizada quando você estiver online.")
                    }
                    setIsPanelOpen(false)
                  }
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle2 size={18} /> VALIDAR LAVAGEM
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button className="py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-700 transition-all">
                <Download size={14} /> PDF
              </button>
              <button 
                onClick={async () => {
                  if (confirm('Tem certeza que deseja excluir?')) {
                    if (isOnline) {
                      await deleteLavagem(selectedLavagem.id)
                      await localDb.delete("lavagens", selectedLavagem.id)
                      window.dispatchEvent(new CustomEvent("offline-db-updated-lavagens"))
                    } else {
                      await localDb.delete("lavagens", selectedLavagem.id)
                      await localDb.addToQueue("lavagem", "delete", { id: selectedLavagem.id })
                      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"))
                      window.dispatchEvent(new CustomEvent("offline-db-updated-lavagens"))
                      alert("✅ Registro excluído localmente! Será sincronizado quando você estiver online.")
                    }
                    setIsPanelOpen(false)
                  }
                }}
                className="py-2.5 bg-zinc-100 hover:bg-red-50 dark:bg-zinc-900 dark:hover:bg-red-950 text-red-600 dark:text-red-500 font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-zinc-200 dark:border-red-900/30 transition-all"
              >
                <Trash2 size={14} /> EXCLUIR
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

function UploadBox({ label, field, url, onCapture, onFileSelect, onClear }: any) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  return (
    <div className="relative aspect-square rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 overflow-hidden flex flex-col items-center justify-center p-3 group shadow-sm transition-all duration-300">
      {url ? (
        <div className="absolute inset-0">
          <img src={url} alt={label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 bg-white hover:bg-zinc-100 text-zinc-900 text-[9px] font-black rounded-lg uppercase tracking-wide transition-all shadow-md active:scale-95 pointer-events-auto"
            >
              Galeria
            </button>
            <button 
              type="button" 
              onClick={() => onCapture(field)}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black rounded-lg uppercase tracking-wide transition-all shadow-md active:scale-95 pointer-events-auto"
            >
              Câmera
            </button>
            <button 
              type="button" 
              onClick={() => onClear(field)}
              className="px-2.5 py-1 bg-red-650 hover:bg-red-750 text-white text-[9px] font-black rounded-lg uppercase tracking-wide transition-all shadow-md active:scale-95 pointer-events-auto"
            >
              Limpar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-650 group-hover:text-zinc-650 dark:group-hover:text-zinc-400 transition-colors duration-300 w-full h-full">
          <div className="p-2.5 bg-zinc-100 dark:bg-zinc-850 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30 group-hover:text-blue-500">
            <Camera size={20} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</span>
          <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300 text-[8px] font-black rounded uppercase tracking-wide transition-all pointer-events-auto"
            >
              Galeria
            </button>
            <button
              type="button"
              onClick={() => onCapture(field)}
              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[8px] font-black rounded uppercase tracking-wide transition-all pointer-events-auto"
            >
              Câmera
            </button>
          </div>
        </div>
      )}
      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*"
        onChange={(e) => onFileSelect(e, field)}
        className="hidden"
      />
    </div>
  )
}

function ImagePreview({ url, label }: any) {
  if (!url) return null
  return (
    <div className="relative group rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 aspect-square">
      <img src={url} className="w-full h-full object-cover" />
      <div className="absolute bottom-0 inset-x-0 p-2 bg-black/60 backdrop-blur-sm transform translate-y-full group-hover:translate-y-0 transition-transform">
        <p className="text-[9px] font-black text-white uppercase text-center">{label}</p>
      </div>
      <button className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity">
        <ZoomIn size={12} />
      </button>
    </div>
  )
}
