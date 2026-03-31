'use client';

import { useState, useEffect } from "react";
import { Plus, X, Download } from "lucide-react";
import { criarOrdemServico } from "./actions";

type Equipamento = {
  id: string;
  placa: string;
  modulo?: string;
  ultimoHist?: number;
};

export default function NovaOSModal({ equipamentos }: { equipamentos: Equipamento[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedEq, setSelectedEq] = useState<Equipamento | null>(null);

  // Formata a data atual no horário LOCAL no formato YYYY-MM-DDTHH:mm
  const getLocalDateTimeStr = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };
  const [dataAbertura, setDataAbertura] = useState(getLocalDateTimeStr());
  const [dataFechamento, setDataFechamento] = useState("");
  // Armazena a diferença em minutos inteiros (sem arredondamento)
  const [diffMinutos, setDiffMinutos] = useState(0);

  // Formata minutos no padrão HH:mm (ex: 90min → "01:30")
  const formatarTempo = (totalMinutos: number): string => {
    if (totalMinutos <= 0) return "00:00";
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
  };

  // Converte minutos para decimal (ex: 90min → 1.5h) para salvar no banco
  const minutosParaHorasDecimal = (min: number) => Number((min / 60).toFixed(2));

  // Calcula a diferença EM MINUTOS EXATOS (sem erro de arredondamento)
  // Equivalente ao dayjs.diff(inicio, "minute")
  useEffect(() => {
    if (dataAbertura && dataFechamento) {
      const start = new Date(dataAbertura).getTime();
      const end = new Date(dataFechamento).getTime();
      const diff = Math.floor((end - start) / (1000 * 60)); // minutos inteiros
      setDiffMinutos(diff > 0 ? diff : 0);
    } else {
      setDiffMinutos(0);
    }
  }, [dataAbertura, dataFechamento]);

  const handleSelectEquipamento = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const eq = equipamentos.find(eq => eq.id === id);
    setSelectedEq(eq || null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    // Salva no banco como decimal de horas (ex: 90min → 1.5)
    formData.append("horas_manutencao", minutosParaHorasDecimal(diffMinutos).toString());
    formData.append("placa", selectedEq?.placa || "");

    const result = await criarOrdemServico(formData);
    
    if (result.error) {
      alert("Erro: " + result.error);
    } else if (result.success) {
      (e.target as HTMLFormElement).reset();
      setIsOpen(false);
      setSelectedEq(null);
    }
    setLoading(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
      >
        <Plus size={16} /> Nova OS
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh] custom-scroll">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Nova OS</h2>
              <button type="button" onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              {/* Row 1: Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Data/Hora Abertura *</label>
                  <input name="data_abertura" type="datetime-local" required 
                    value={dataAbertura}
                    onChange={e => setDataAbertura(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none" 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Data/Hora Fechamento</label>
                  <input name="data_fechamento" type="datetime-local" 
                    value={dataFechamento}
                    onChange={e => setDataFechamento(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none" 
                  />
                </div>
              </div>

              {/* Row 2: Status and Placa */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Status *</label>
                  <select name="status" required className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none">
                    <option value="Aberta">Aberta</option>
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Fechada">Fechada</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Placa *</label>
                  <select name="equipamento_id" required onChange={handleSelectEquipamento} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none">
                    <option value="">Selecione a placa...</option>
                    {equipamentos.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.placa}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Modulo */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Módulo</label>
                <input name="modulo" type="text"
                  defaultValue={selectedEq?.modulo || ""} 
                  readOnly
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm outline-none cursor-not-allowed" 
                />
              </div>

              {/* Row 4: Details */}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Horímetro</label>
                  <input name="horimetro" type="number" step="0.1" 
                    defaultValue={selectedEq?.ultimoHist || ""}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none" 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Operação (Tipo)</label>
                  <input name="operacao_tipo" type="text" 
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none" 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Local</label>
                  <input name="local" type="text" 
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none" 
                  />
                </div>
              </div>

              {/* Row 5: Class and Toggle */}
              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Classe</label>
                  <select name="classe" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none">
                    <option value="CORRETIVA">CORRETIVA</option>
                    <option value="PREVENTIVA">PREVENTIVA</option>
                    <option value="PREDITIVA">PREDITIVA</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="foi_enviado_reserva" className="sr-only peer" />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
                    <span className="ms-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Foi enviado reserva?</span>
                  </label>
                </div>
              </div>

              {/* Row 6: Description */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Descrição da Atividade *</label>
                <textarea name="descricao" required rows={3}
                  placeholder="Auto-preenchido com itens pendentes do backlog ao selecionar a placa. Pode ser editado..."
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none resize-none" 
                ></textarea>
              </div>

              {/* Row 7: Motivo, Sistema, Sub */}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Motivo</label>
                  <select name="motivo" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none">
                    <option value="">Selecione</option>
                    <option value="Desgaste Natural">Desgaste Natural</option>
                    <option value="Quebra Operacional">Quebra Operacional</option>
                    <option value="Falha Elétrica">Falha Elétrica</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Sistema</label>
                  <select name="sistema" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none">
                    <option value="">Selecione</option>
                    <option value="Motor">Motor</option>
                    <option value="Hidráulica">Hidráulica</option>
                    <option value="Freios">Freios</option>
                    <option value="Elétrico">Elétrico</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Sub-Sistema</label>
                  <select name="sub_sistema" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none">
                    <option value="">Selecione</option>
                    <option value="Bomba Injetora">Bomba Injetora</option>
                    <option value="Cilindro Mestre">Cilindro Mestre</option>
                    <option value="Alternador">Alternador</option>
                  </select>
                </div>
              </div>

              {/* Footer Total */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg text-sm text-blue-900 dark:text-blue-300 font-medium my-2">
                Tempo Total de Manutenção: <span className="font-bold">{formatarTempo(diffMinutos)}</span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800 mt-2">
                <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                  {loading ? 'Criando...' : 'Criar OS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
