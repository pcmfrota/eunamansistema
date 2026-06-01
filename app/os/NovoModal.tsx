"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { criarOrdemServico, atualizarOrdemServico } from "./actions";
import { useOffline } from "@/components/offline-provider";
import { localDb, serializeFormData } from "@/lib/offline-db";

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
  componente: string | null;
  horario_parada: string | null;
  qual_reserva: string | null;
  horas_reserva_chegou: string | null;
  observacoes: string | null;
  equipamento_id: string;
};

type Equipamento = { id: string; placa: string; modulo?: string; ultimoHist?: number };

type CatalogoItem = {
  id: number;
  sistema: string;
  sistema_codigo: number;
  subsistema: string;
  subsistema_codigo: number;
  componente: string;
  componente_codigo: number;
};

interface OSFormModalProps {
  equipamentos: Equipamento[];
  initialData?: OS | null;
  onClose: () => void;
  operacoesTipo?: string[];
  motivos?: string[];
  catalogo?: CatalogoItem[];
}

function getLocalDT() {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`;
}

export default function OSFormModal({
  equipamentos, initialData, onClose,
  operacoesTipo = [], motivos = [], catalogo = [],
}: OSFormModalProps) {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(false);
  const [equip, setEquip] = useState<Equipamento | null>(null);
  const [foiReserva, setFoiReserva] = useState(initialData?.foi_enviado_reserva || false);
  const [sistema, setSistema] = useState(initialData?.sistema || "");
  const [subSistema, setSubSistema] = useState(initialData?.sub_sistema || "");
  const [componente, setComponente] = useState(initialData?.componente || "");
  const [dataAbertura, setDataAbertura] = useState(initialData?.data_abertura?.slice(0,16) || getLocalDT());
  const [dataFechamento, setDataFechamento] = useState(initialData?.data_fechamento?.slice(0,16) || "");

  // Catalogos em cascata
  const sistemasUnicos = Array.from(new Set(catalogo.map(c => c.sistema))).sort();
  const subsistemasFiltrados = sistema
    ? Array.from(new Set(catalogo.filter(c => c.sistema === sistema).map(c => c.subsistema))).sort()
    : [];
  const componentesFiltrados = sistema && subSistema
    ? Array.from(new Set(catalogo.filter(c => c.sistema === sistema && c.subsistema === subSistema).map(c => c.componente))).sort()
    : [];

  // Calcular tempo total de manutenção
  const diffMin = (() => {
    if (!dataAbertura || !dataFechamento) return 0;
    const d = Math.floor((new Date(dataFechamento).getTime() - new Date(dataAbertura).getTime()) / 60000);
    return d > 0 ? d : 0;
  })();
  const tempoFmt = `${String(Math.floor(diffMin/60)).padStart(2,"0")}:${String(diffMin%60).padStart(2,"0")}`;

  useEffect(() => {
    if (initialData?.equipamento_id) {
      setEquip(equipamentos.find(e => e.id === initialData.equipamento_id) || null);
    }
  }, []);

  const handleEquipChange = (id: string) => {
    const eq = equipamentos.find(e => e.id === id) || null;
    setEquip(eq);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("placa", equip?.placa || "");
      // CRÍTICO: módulo é readOnly — precisa ser setado manualmente no FormData
      fd.set("modulo", equip?.modulo || "");
      fd.set("horas_manutencao", String(Number((diffMin/60).toFixed(2))));
      fd.set("sistema", sistema);
      fd.set("sub_sistema", subSistema);
      fd.set("componente", componente);

      if (isOnline) {
        const res = initialData
          ? await atualizarOrdemServico(initialData.id, fd)
          : await criarOrdemServico(fd);

        if (res && typeof res === "object" && "error" in res) { 
          alert("Erro: " + res.error); 
        } else { 
          // Only save to localDb if res actually contains an id (it might just be { success: true })
          if (res && typeof res === "object" && "id" in res) {
            await localDb.put("ordens_servico", res);
          }
          window.dispatchEvent(new CustomEvent("offline-db-updated-ordens_servico"));
          onClose(); 
        }
      } else {
        // Cenário offline
        if (initialData) {
          // Editar OS Offline
          const serialized = serializeFormData(fd);
          const updatedOS = {
            ...initialData,
            ...serialized,
            horimetro: fd.get("horimetro") ? parseFloat(fd.get("horimetro") as string) : null,
            horas_manutencao: Number((diffMin/60).toFixed(2)),
            foi_enviado_reserva: fd.get("foi_enviado_reserva") === "on",
            _isPendingSync: true
          };
          await localDb.put("ordens_servico", updatedOS);
          await localDb.addToQueue("os", "update", { id: initialData.id, ...serialized });
        } else {
          // Criar OS Offline
          const serialized = serializeFormData(fd);
          const tempId = `temp_os_${Date.now()}`;
          const tempNum = `OS-OFF-${Math.floor(Math.random() * 9000) + 1000}`;
          const newOS = {
            id: tempId,
            numero_os: tempNum,
            placa: equip?.placa || "",
            modulo: equip?.modulo || "",
            status: fd.get("status") as string || "Aberta",
            data_abertura: fd.get("data_abertura") as string,
            data_fechamento: (fd.get("data_fechamento") as string) || null,
            horas_manutencao: Number((diffMin/60).toFixed(2)),
            descricao: fd.get("descricao") as string,
            horimetro: fd.get("horimetro") ? parseFloat(fd.get("horimetro") as string) : null,
            operacao_tipo: fd.get("operacao_tipo") as string,
            local: fd.get("local") as string,
            classe: fd.get("classe") as string || "CORRETIVA",
            foi_enviado_reserva: fd.get("foi_enviado_reserva") === "on",
            motivo: fd.get("motivo") as string,
            sistema: sistema,
            sub_sistema: subSistema,
            componente: componente,
            horario_parada: (fd.get("horario_parada") as string) || null,
            qual_reserva: (fd.get("qual_reserva") as string) || null,
            horas_reserva_chegou: (fd.get("horas_reserva_chegou") as string) || null,
            observacoes: fd.get("observacoes") as string,
            equipamento_id: fd.get("equipamento_id") as string,
            _isPendingSync: true
          };
          await localDb.put("ordens_servico", newOS);
          await localDb.addToQueue("os", "create", serialized);
        }
        
        // Notifica as tabelas e fecha o modal
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
        window.dispatchEvent(new CustomEvent("offline-db-updated-ordens_servico"));
        onClose();
      }
    } catch (error: any) {
      console.error("Erro inesperado no handleSubmit:", error);
      alert("Erro inesperado ao salvar a OS. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {initialData ? "Editar OS" : "Nova OS"}
          </h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Datas */}
          <div className="grid grid-cols-3 gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <Field label="Horário Real da Parada *">
              <input name="horario_parada" type="datetime-local" required
                defaultValue={initialData?.horario_parada?.slice(0,16) || ""}
                className={`${I} border-red-200 dark:border-red-800`} />
            </Field>
            <Field label="Início Manutenção *">
              <input name="data_abertura" type="datetime-local" required
                value={dataAbertura} onChange={e => setDataAbertura(e.target.value)}
                className={I} />
            </Field>
            <Field label="Fechamento da OS">
              <input name="data_fechamento" type="datetime-local"
                value={dataFechamento} onChange={e => setDataFechamento(e.target.value)}
                className={I} />
            </Field>
          </div>

          {/* Status + Placa */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status *">
              <select name="status" required defaultValue={initialData?.status || "Aberta"} className={I}>
                <option>Aberta</option>
                <option>Em Andamento</option>
                <option>Fechada</option>
              </select>
            </Field>
            <Field label="Placa *">
              <select name="equipamento_id" required
                defaultValue={initialData?.equipamento_id || ""}
                onChange={e => handleEquipChange(e.target.value)}
                className={I}>
                <option value="">Selecione a placa...</option>
                {equipamentos.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.placa}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Módulo só leitura - puxado automaticamente da placa */}
          <Field label="Módulo (automático pela placa)">
            <input type="text" name="modulo" readOnly value={equip?.modulo || ""}
              placeholder="Selecione a placa para puxar o módulo..."
              className={`${I} bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed text-emerald-700 dark:text-emerald-400 font-semibold`} />
          </Field>

          {/* Horímetro, Operação, Local */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Horímetro">
              <input name="horimetro" type="number" step="0.1"
                defaultValue={initialData?.horimetro ?? equip?.ultimoHist ?? ""}
                className={I} />
            </Field>
            <Field label="Operação (Tipo)">
              <input name="operacao_tipo" type="text" list="lista-op"
                defaultValue={initialData?.operacao_tipo || ""}
                className={I} />
              <datalist id="lista-op">
                {operacoesTipo.map(o => <option key={o} value={o} />)}
              </datalist>
            </Field>
            <Field label="Local">
              <input name="local" type="text"
                defaultValue={initialData?.local || ""}
                className={I} />
            </Field>
          </div>

          {/* Tipo de Manutenção + Reserva */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <Field label="Tipo de Manutenção">
              <select name="classe" defaultValue={initialData?.classe || "CORRETIVA"} className={I}>
                <option value="CORRETIVA">CORRETIVA</option>
                <option value="PREVENTIVA">PREVENTIVA</option>
                <option value="PREDITIVA">PREDITIVA</option>
                <option value="REFORMA">REFORMA</option>
              </select>
            </Field>
            <div className="pt-4 flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="foi_enviado_reserva"
                  checked={foiReserva}
                  onChange={e => setFoiReserva(e.target.checked)}
                  className="sr-only peer" />
                <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-700 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                <span className="ml-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Foi enviado reserva?
                  <br /><span className="text-[10px] text-zinc-400 font-normal">Impacta o medidor de parada operacional</span>
                </span>
              </label>
            </div>
          </div>

          {/* Reserva details */}
          {foiReserva && (
            <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800">
              <Field label="Qual o Caminhão Reserva?">
                <select name="qual_reserva" required
                  defaultValue={initialData?.qual_reserva || ""}
                  className={`${I} border-orange-200`}>
                  <option value="">Selecione...</option>
                  {equipamentos.map(eq => (
                    <option key={`r-${eq.id}`} value={eq.placa}>{eq.placa}</option>
                  ))}
                </select>
              </Field>
              <Field label="Que Horas o Reserva Chegou?">
                <input name="horas_reserva_chegou" type="datetime-local" required
                  defaultValue={initialData?.horas_reserva_chegou?.slice(0,16) || ""}
                  className={`${I} border-orange-200`} />
              </Field>
            </div>
          )}

          {/* Descrição */}
          <Field label="Descrição da Atividade *">
            <textarea name="descricao" required rows={3}
              defaultValue={initialData?.descricao || ""}
              placeholder="Descreva a falha ou manutenção..."
              className={`${I} resize-none`} />
          </Field>

          {/* Motivo */}
          <Field label="Motivo">
            <select name="motivo" defaultValue={initialData?.motivo || ""} className={I}>
              <option value="">Selecione</option>
              {motivos.map(m => <option key={m} value={m}>{m}</option>)}
              {motivos.length === 0 && (
                <>
                  <option>Desgaste Natural</option>
                  <option>Quebra Operacional</option>
                  <option>Falha Elétrica</option>
                </>
              )}
            </select>
          </Field>

          {/* Sistema / Subsistema / Componente em cascata */}
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Sistema / Sub-Sistema / Componente</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Sistema">
                <select value={sistema} onChange={e => { setSistema(e.target.value); setSubSistema(""); setComponente(""); }} className={I}>
                  <option value="">Selecione...</option>
                  {sistemasUnicos.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Sub-Sistema">
                <select value={subSistema} onChange={e => { setSubSistema(e.target.value); setComponente(""); }} disabled={!sistema} className={`${I} disabled:opacity-50`}>
                  <option value="">Selecione...</option>
                  {subsistemasFiltrados.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Componente">
                <select value={componente} onChange={e => setComponente(e.target.value)} disabled={!subSistema} className={`${I} disabled:opacity-50`}>
                  <option value="">Selecione...</option>
                  {componentesFiltrados.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Observações */}
          <Field label="Observações">
            <textarea name="observacoes" rows={2}
              defaultValue={initialData?.observacoes || ""}
              className={`${I} resize-none`} />
          </Field>

          {/* Tempo total */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300 font-medium">
            Tempo Total de Manutenção: <span className="font-bold">{tempoFmt}</span>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm">
              {loading ? "Salvando..." : initialData ? "Salvar Alterações" : "Criar OS"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const I = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
      {children}
    </div>
  );
}
