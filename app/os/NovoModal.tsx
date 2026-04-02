import { useState, useEffect } from "react";
import { X, RotateCcw } from "lucide-react";
import { criarOrdemServico, atualizarOrdemServico } from "./actions";
import { useFormDraft } from '@/hooks/use-form-draft'

type OS = {
  id: string;
  numero_os: string;
  placa: string | null;
  modulo: string | null;
  status: string | null;
  data_abertura: string;
  data_fechamento: string | null;
  horas_manutencao: number | null;
  descricao: string | null;
  horimetro: number | null;
  operacao_tipo: string | null;
  local: string | null;
  classe: string | null;
  foi_enviado_reserva: boolean | null;
  motivo: string | null;
  sistema: string | null;
  sub_sistema: string | null;
  observacoes: string | null;
  equipamento_id: string;
};

type Equipamento = {
  id: string;
  placa: string;
  modulo?: string;
  ultimoHist?: number;
};

interface OSFormValues {
  data_abertura: string;
  data_fechamento: string;
  status: string;
  equipamento_id: string;
  horimetro: string;
  operacao_tipo: string;
  local: string;
  classe: string;
  foi_enviado_reserva: boolean;
  descricao: string;
  motivo: string;
  sistema: string;
  sub_sistema: string;
  observacoes: string;
}

interface OSFormModalProps {
  equipamentos: Equipamento[];
  initialData?: OS | null;
  onClose: () => void;
  operacoesTipo?: string[];
  motivos?: string[];
  sistemas?: string[];
  subSistemas?: string[];
}

export default function OSFormModal({ 
  equipamentos, 
  initialData, 
  onClose,
  operacoesTipo = [],
  motivos = [],
  sistemas = [],
  subSistemas = []
}: OSFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedEq, setSelectedEq] = useState<Equipamento | null>(null);

  // Formata a data atual no horário LOCAL no formato YYYY-MM-DDTHH:mm
  const getLocalDateTimeStr = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const initialValues: OSFormValues = {
    data_abertura: initialData ? initialData.data_abertura.slice(0, 16) : getLocalDateTimeStr(),
    data_fechamento: initialData?.data_fechamento ? initialData.data_fechamento.slice(0, 16) : "",
    status: initialData?.status || "Aberta",
    equipamento_id: initialData?.equipamento_id || "",
    horimetro: initialData?.horimetro?.toString() || "",
    operacao_tipo: initialData?.operacao_tipo || "",
    local: initialData?.local || "",
    classe: initialData?.classe || "CORRETIVA",
    foi_enviado_reserva: initialData?.foi_enviado_reserva || false,
    descricao: initialData?.descricao || "",
    motivo: initialData?.motivo || "",
    sistema: initialData?.sistema || "",
    sub_sistema: initialData?.sub_sistema || "",
    observacoes: initialData?.observacoes || "",
  };

  // Draft hook - only use draft if creating NEW OS
  const { form, setForm, clearDraft, hasContent: hasDraft } = useFormDraft<OSFormValues>(
    initialData ? null : 'os-new', 
    initialValues
  );

  // Sincronizar selectedEq
  useEffect(() => {
    if (form.equipamento_id && equipamentos.length > 0) {
      const eq = equipamentos.find(e => e.id === form.equipamento_id);
      if (eq) setSelectedEq(eq);
    }
  }, [form.equipamento_id, equipamentos]);

  // Armazena a diferença em minutos inteiros
  const [diffMinutos, setDiffMinutos] = useState(0);

  const formatarTempo = (totalMinutos: number): string => {
    if (totalMinutos <= 0) return "00:00";
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
  };

  const minutosParaHorasDecimal = (min: number) => Number((min / 60).toFixed(2));

  useEffect(() => {
    if (form.data_abertura && form.data_fechamento) {
      const start = new Date(form.data_abertura).getTime();
      const end = new Date(form.data_fechamento).getTime();
      const diff = Math.floor((end - start) / (1000 * 60));
      setDiffMinutos(diff > 0 ? diff : 0);
    } else {
      setDiffMinutos(0);
    }
  }, [form.data_abertura, form.data_fechamento]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setForm(prev => ({ ...prev, [name]: val }));

    if (name === 'equipamento_id') {
      const eq = equipamentos.find(eq => eq.id === (value as string));
      setSelectedEq(eq || null);
      if (eq?.ultimoHist && !initialData) {
        setForm(prev => ({ ...prev, horimetro: eq.ultimoHist?.toString() || "" }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    formData.append("horas_manutencao", minutosParaHorasDecimal(diffMinutos).toString());
    formData.append("placa", selectedEq?.placa || "");

    let result;
    if (initialData) {
      result = await atualizarOrdemServico(initialData.id, formData);
    } else {
      result = await criarOrdemServico(formData);
    }
    
    if ('error' in result) {
      alert("Erro: " + result.error);
    } else {
      if (!initialData) clearDraft();
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh] custom-scroll">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{initialData ? "Editar OS" : "Nova OS"}</h2>
            {hasDraft && !initialData && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 uppercase tracking-wider">
                Rascunho Ativo
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasDraft && !initialData && (
              <button 
                type="button" 
                onClick={clearDraft}
                title="Limpar Rascunho"
                className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
              >
                <RotateCcw size={18} />
              </button>
            )}
            <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          {/* Row 1: Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">Data/Hora Abertura *</label>
              <input name="data_abertura" type="datetime-local" required 
                value={form.data_abertura}
                onChange={handleInputChange}
                className={inputCls} 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">Data/Hora Fechamento</label>
              <input name="data_fechamento" type="datetime-local" 
                value={form.data_fechamento}
                onChange={handleInputChange}
                className={inputCls} 
              />
            </div>
          </div>

          {/* Row 2: Status and Placa */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">Status *</label>
              <select 
                name="status" 
                required 
                value={form.status}
                onChange={handleInputChange}
                className={inputCls}
              >
                <option value="Aberta">Aberta</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Fechada">Fechada</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">Placa *</label>
              <select 
                name="equipamento_id" 
                required 
                value={form.equipamento_id}
                onChange={handleInputChange} 
                className={inputCls}
              >
                <option value="">Selecione a placa...</option>
                {equipamentos.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.placa}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Modulo */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-500">Módulo</label>
            <input name="modulo" type="text"
              value={selectedEq?.modulo || ""} 
              readOnly
              className={`${inputCls} bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed`} 
            />
          </div>

          {/* Row 4: Details */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">Horímetro</label>
              <input name="horimetro" type="number" step="0.1" 
                value={form.horimetro}
                onChange={handleInputChange}
                className={inputCls} 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">Operação (Tipo)</label>
              <input name="operacao_tipo" type="text" list="lista-operacao-tipo"
                value={form.operacao_tipo}
                onChange={handleInputChange}
                className={inputCls} 
              />
              <datalist id="lista-operacao-tipo">
                {operacoesTipo.map(op => <option key={op} value={op} />)}
              </datalist>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">Local</label>
              <input name="local" type="text" 
                value={form.local}
                onChange={handleInputChange}
                className={inputCls} 
              />
            </div>
          </div>

          {/* Row 5: Class and Toggle */}
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">Classe</label>
              <select 
                name="classe" 
                value={form.classe}
                onChange={handleInputChange}
                className={inputCls}
              >
                <option value="CORRETIVA">CORRETIVA</option>
                <option value="PREVENTIVA">PREVENTIVA</option>
                <option value="PREDITIVA">PREDITIVA</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  name="foi_enviado_reserva" 
                  className="sr-only peer"
                  checked={form.foi_enviado_reserva}
                  onChange={handleInputChange}
                />
                <div className="w-11 h-6 bg-zinc-200 rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
                <span className="ms-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Foi enviado reserva?</span>
              </label>
            </div>
          </div>

          {/* Row 6: Description */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-500">Descrição da Atividade *</label>
            <textarea name="descricao" required rows={3}
              value={form.descricao}
              onChange={handleInputChange}
              placeholder="Descreva a falha ou manutenção..."
              className={`${inputCls} resize-none`} 
            ></textarea>
          </div>

          {/* Row 7: Motivo, Sistema, Sub */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">Motivo</label>
              <select 
                name="motivo" 
                value={form.motivo}
                onChange={handleInputChange}
                className={inputCls}
              >
                <option value="">Selecione</option>
                {motivos.length > 0 ? (
                  motivos.map(m => <option key={m} value={m}>{m}</option>)
                ) : (
                  <>
                    <option value="Desgaste Natural">Desgaste Natural</option>
                    <option value="Quebra Operacional">Quebra Operacional</option>
                    <option value="Falha Elétrica">Falha Elétrica</option>
                  </>
                )}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">Sistema</label>
              <select 
                name="sistema" 
                value={form.sistema}
                onChange={handleInputChange}
                className={inputCls}
              >
                <option value="">Selecione</option>
                {sistemas.length > 0 ? (
                  sistemas.map(s => <option key={s} value={s}>{s}</option>)
                ) : (
                  <>
                    <option value="Motor">Motor</option>
                    <option value="Hidráulica">Hidráulica</option>
                    <option value="Freios">Freios</option>
                    <option value="Elétrico">Elétrico</option>
                  </>
                )}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">Sub-Sistema</label>
              <select 
                name="sub_sistema" 
                value={form.sub_sistema}
                onChange={handleInputChange}
                className={inputCls}
              >
                <option value="">Selecione</option>
                {subSistemas.length > 0 ? (
                  subSistemas.map(s => <option key={s} value={s}>{s}</option>)
                ) : (
                  <>
                    <option value="Bomba Injetora">Bomba Injetora</option>
                    <option value="Cilindro Mestre">Cilindro Mestre</option>
                    <option value="Alternador">Alternador</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-500">Observações</label>
            <textarea name="observacoes" rows={2}
              value={form.observacoes}
              onChange={handleInputChange}
              className={`${inputCls} resize-none`} 
            ></textarea>
          </div>

          {/* Footer Total */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg text-sm text-blue-900 dark:text-blue-300 font-medium">
            Tempo Total de Manutenção: <span className="font-bold">{formatarTempo(diffMinutos)}</span>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
              {loading ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Criar OS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 transition-all";
