"use client";

import React, { useState } from "react";
import { CircleDot, CheckCircle2, AlertTriangle, ArrowLeft, Edit3, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TireCalibrationItem {
  posicao: string; // e.g. "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "98"
  rotulo: string; // e.g. "1º Eixo DE", "1º Eixo DD", etc.
  numeroPneu?: string;
  pressaoMedida?: number | string;
  pressaoCalibrada?: number | string;
  status: "OK" | "Abaixo" | "Acima" | "Pendente";
  observacao?: string;
  dataHora?: string;
}

interface TruckTireCalibratorProps {
  calibragens: TireCalibrationItem[];
  onChange: (calibragens: TireCalibrationItem[]) => void;
  readOnly?: boolean;
}

export const POSICOES_PNEUS = [
  { id: "1", rotulo: "1º Eixo DE", lado: "esquerdo", eixo: 1, posSigla: "DE" },
  { id: "6", rotulo: "1º Eixo DD", lado: "direito", eixo: 1, posSigla: "DD" },
  { id: "2", rotulo: "2º Eixo TEE", lado: "esquerdo", eixo: 2, posSigla: "TEE" },
  { id: "3", rotulo: "2º Eixo TEI", lado: "esquerdo", eixo: 2, posSigla: "TEI" },
  { id: "8", rotulo: "2º Eixo TDI", lado: "direito", eixo: 2, posSigla: "TDI" },
  { id: "7", rotulo: "2º Eixo TDE", lado: "direito", eixo: 2, posSigla: "TDE" },
  { id: "4", rotulo: "3º Eixo TEE", lado: "esquerdo", eixo: 3, posSigla: "TEE" },
  { id: "5", rotulo: "3º Eixo TEI", lado: "esquerdo", eixo: 3, posSigla: "TEI" },
  { id: "10", rotulo: "3º Eixo TDI", lado: "direito", eixo: 3, posSigla: "TDI" },
  { id: "9", rotulo: "3º Eixo TDE", lado: "direito", eixo: 3, posSigla: "TDE" },
  { id: "98", rotulo: "Estepe (98-STEP 1)", lado: "estepe", eixo: 4, posSigla: "STEP 1" },
];

export function TruckTireCalibrator({ calibragens, onChange, readOnly = false }: TruckTireCalibratorProps) {
  const [selectedPos, setSelectedPos] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Buffer state para edição do modal
  const [tempNumero, setTempNumero] = useState("");
  const [tempMedida, setTempMedida] = useState("");
  const [tempCalibrada, setTempCalibrada] = useState("");
  const [tempStatus, setTempStatus] = useState<"OK" | "Abaixo" | "Acima">("OK");
  const [tempObs, setTempObs] = useState("");

  const getTireData = (id: string): TireCalibrationItem => {
    const found = calibragens.find((c) => String(c.posicao) === String(id));
    if (found) return found;
    const config = POSICOES_PNEUS.find((p) => p.id === id);
    return {
      posicao: id,
      rotulo: config?.rotulo || `Posição ${id}`,
      status: "Pendente",
    };
  };

  const handleOpenModal = (id: string) => {
    if (readOnly) return;
    const tire = getTireData(id);
    setSelectedPos(id);
    setTempNumero(tire.numeroPneu || "");
    setTempMedida(tire.pressaoMedida !== undefined ? String(tire.pressaoMedida) : "");
    setTempCalibrada(tire.pressaoCalibrada !== undefined ? String(tire.pressaoCalibrada) : "");
    setTempStatus(tire.status !== "Pendente" ? (tire.status as any) : "OK");
    setTempObs(tire.observacao || "");
    setModalOpen(true);
  };

  const handleSaveModal = () => {
    if (!selectedPos) return;

    // Calc status automático se houver medidas numéricas
    let calcStatus: "OK" | "Abaixo" | "Acima" = tempStatus;
    const med = parseFloat(tempMedida);
    const cal = parseFloat(tempCalibrada);
    if (!isNaN(med) && !isNaN(cal)) {
      const diff = med - cal;
      if (Math.abs(diff) <= 2) calcStatus = "OK";
      else if (diff < -2) calcStatus = "Abaixo";
      else calcStatus = "Acima";
    }

    const currentConfig = POSICOES_PNEUS.find((p) => p.id === selectedPos);

    const updatedItem: TireCalibrationItem = {
      posicao: selectedPos,
      rotulo: currentConfig?.rotulo || `Posição ${selectedPos}`,
      numeroPneu: tempNumero.trim() || undefined,
      pressaoMedida: tempMedida !== "" ? parseFloat(tempMedida) || tempMedida : undefined,
      pressaoCalibrada: tempCalibrada !== "" ? parseFloat(tempCalibrada) || tempCalibrada : undefined,
      status: calcStatus,
      observacao: tempObs.trim() || undefined,
      dataHora: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const existingIndex = calibragens.findIndex((c) => String(c.posicao) === String(selectedPos));
    let nextCalibragens = [...calibragens];
    if (existingIndex >= 0) {
      nextCalibragens[existingIndex] = updatedItem;
    } else {
      nextCalibragens.push(updatedItem);
    }

    onChange(nextCalibragens);
    setModalOpen(false);
    setSelectedPos(null);
  };

  const getTireBadgeColor = (status: string) => {
    switch (status) {
      case "OK":
        return "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20";
      case "Abaixo":
        return "bg-amber-500 text-white border-amber-600 shadow-amber-500/20";
      case "Acima":
        return "bg-rose-500 text-white border-rose-600 shadow-rose-500/20";
      default:
        return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700";
    }
  };

  const renderTireButton = (id: string, label: string) => {
    const tire = getTireData(id);
    const isFilled = tire.pressaoMedida !== undefined || tire.pressaoCalibrada !== undefined;

    return (
      <button
        key={id}
        type="button"
        onClick={() => handleOpenModal(id)}
        disabled={readOnly}
        className={cn(
          "relative group flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all duration-200 shadow-md",
          isFilled
            ? getTireBadgeColor(tire.status)
            : "bg-white dark:bg-zinc-900 border-emerald-500/40 text-zinc-800 dark:text-zinc-100 hover:border-emerald-500 hover:scale-105",
          readOnly ? "cursor-default opacity-90" : "active:scale-95 cursor-pointer"
        )}
      >
        <span className="text-[10px] font-black uppercase tracking-wider">{id} - {label}</span>
        <div className="flex items-center gap-1 my-1">
          <CircleDot size={14} className={isFilled ? "animate-pulse" : "text-emerald-500"} />
          <span className="text-xs font-bold font-mono">
            {isFilled
              ? `${tire.pressaoMedida ?? "-"} / ${tire.pressaoCalibrada ?? "-"} PSI`
              : "Toque para Calibrar"}
          </span>
        </div>
        {isFilled && (
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-black/20 uppercase tracking-wider">
            {tire.status}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="w-full bg-zinc-50 dark:bg-zinc-950/60 p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-6">
      
      {/* Visual Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CircleDot size={18} />
            Calibragem de Pneus da Frota (Desenho Técnico)
          </h3>
          <p className="text-xs text-zinc-500">Toque em cada pneu no desenho do caminhão para registrar a pressão medida e calibrada.</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase">
          <span className="flex items-center gap-1 text-emerald-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> OK</span>
          <span className="flex items-center gap-1 text-amber-600"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Abaixo</span>
          <span className="flex items-center gap-1 text-rose-600"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Acima</span>
        </div>
      </div>

      {/* Truck Diagram Board */}
      <div className="relative w-full max-w-4xl mx-auto p-4 sm:p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-inner flex flex-col gap-8">
        
        {/* Cab Direction Indicator */}
        <div className="flex items-center justify-start gap-2 text-zinc-400 font-black text-xs uppercase tracking-widest pl-2">
          <ArrowLeft size={20} className="text-emerald-500 animate-pulse" />
          FRENTE DO CAMINHÃO
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
          
          {/* 1º EIXO */}
          <div className="flex flex-col items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">1º EIXO (Direção)</span>
            <div className="w-full space-y-3">
              {renderTireButton("6", "DD")}
              <div className="w-full h-2.5 bg-zinc-300 dark:bg-zinc-700 rounded-full my-1 border border-zinc-400/40" title="Eixo Dianteiro" />
              {renderTireButton("1", "DE")}
            </div>
          </div>

          {/* 2º EIXO */}
          <div className="flex flex-col items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">2º EIXO (Tração 1)</span>
            <div className="w-full space-y-3">
              <div className="grid grid-cols-2 gap-1.5">
                {renderTireButton("7", "TDE")}
                {renderTireButton("8", "TDI")}
              </div>
              <div className="w-full h-2.5 bg-zinc-300 dark:bg-zinc-700 rounded-full my-1 border border-zinc-400/40" title="Eixo Tração 1" />
              <div className="grid grid-cols-2 gap-1.5">
                {renderTireButton("3", "TEI")}
                {renderTireButton("2", "TEE")}
              </div>
            </div>
          </div>

          {/* 3º EIXO */}
          <div className="flex flex-col items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">3º EIXO (Tração 2)</span>
            <div className="w-full space-y-3">
              <div className="grid grid-cols-2 gap-1.5">
                {renderTireButton("9", "TDE")}
                {renderTireButton("10", "TDI")}
              </div>
              <div className="w-full h-2.5 bg-zinc-300 dark:bg-zinc-700 rounded-full my-1 border border-zinc-400/40" title="Eixo Tração 2" />
              <div className="grid grid-cols-2 gap-1.5">
                {renderTireButton("5", "TEI")}
                {renderTireButton("4", "TEE")}
              </div>
            </div>
          </div>

          {/* ESTEPE */}
          <div className="flex flex-col items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">ESTEPE</span>
            <div className="w-full py-4">
              {renderTireButton("98", "STEP 1")}
            </div>
          </div>

        </div>

      </div>

      {/* Summary Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-extrabold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2.5">Posição</th>
              <th className="px-3 py-2.5">Descrição</th>
              <th className="px-3 py-2.5">Nº Pneu (Fogo)</th>
              <th className="px-3 py-2.5 text-center">Pressão Medida (PSI)</th>
              <th className="px-3 py-2.5 text-center">Pressão Calibrada (PSI)</th>
              <th className="px-3 py-2.5 text-center">Status</th>
              <th className="px-3 py-2.5">Observação</th>
              {!readOnly && <th className="px-3 py-2.5 text-right">Ação</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
            {POSICOES_PNEUS.map((pos) => {
              const tire = getTireData(pos.id);
              const isFilled = tire.pressaoMedida !== undefined || tire.pressaoCalibrada !== undefined;

              return (
                <tr key={pos.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-850/50">
                  <td className="px-3 py-2 font-black font-mono text-emerald-600 dark:text-emerald-400">{pos.id}</td>
                  <td className="px-3 py-2 font-bold text-zinc-800 dark:text-zinc-200">{pos.rotulo}</td>
                  <td className="px-3 py-2 font-mono">{tire.numeroPneu || "-"}</td>
                  <td className="px-3 py-2 text-center font-bold font-mono">{tire.pressaoMedida ?? "-"}</td>
                  <td className="px-3 py-2 text-center font-bold font-mono">{tire.pressaoCalibrada ?? "-"}</td>
                  <td className="px-3 py-2 text-center">
                    {isFilled ? (
                      <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase", getTireBadgeColor(tire.status))}>
                        {tire.status}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase">Pendente</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-500 italic max-w-[200px] truncate">{tire.observacao || "-"}</td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenModal(pos.id)}
                        className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                        title="Editar Pneu"
                      >
                        <Edit3 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Calibragem do Pneu Selecionado */}
      {modalOpen && selectedPos && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">
                  {selectedPos}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm uppercase">Calibragem - Posição {selectedPos}</h4>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">
                    {POSICOES_PNEUS.find((p) => p.id === selectedPos)?.rotulo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Número / Código do Pneu (Fogo)</label>
                <input
                  type="text"
                  value={tempNumero}
                  onChange={(e) => setTempNumero(e.target.value)}
                  placeholder="Ex: PN-90412"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Pressão Medida (PSI)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={tempMedida}
                    onChange={(e) => setTempMedida(e.target.value)}
                    placeholder="Ex: 110"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Pressão Calibrada (PSI)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={tempCalibrada}
                    onChange={(e) => setTempCalibrada(e.target.value)}
                    placeholder="Ex: 110"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Status da Pressão</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["OK", "Abaixo", "Acima"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setTempStatus(st)}
                      className={cn(
                        "py-2 rounded-xl font-extrabold text-xs border transition-all uppercase",
                        tempStatus === st
                          ? st === "OK"
                            ? "bg-emerald-500 text-white border-emerald-600"
                            : st === "Abaixo"
                            ? "bg-amber-500 text-white border-amber-600"
                            : "bg-rose-500 text-white border-rose-600"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                      )}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Observação do Pneu</label>
                <textarea
                  rows={2}
                  value={tempObs}
                  onChange={(e) => setTempObs(e.target.value)}
                  placeholder="Ex: Desgaste irregular na banda de rodagem"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold uppercase text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase text-xs shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                Confirmar Pneu
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
