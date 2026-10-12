"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Printer, FileDown, History, RotateCcw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-context";
import { FichaCompleta, Comboio, Modulo, Impedimento, Material, HistoricoEntry, getHistoricoFicha, reabrirFicha } from "./actions";
import { INSUMO_TIPOS, labelMaterialInsumo } from "./config";
import { gerarPDFFichaAbastecimento, imprimirFichaAbastecimento } from "./InsumosPDF";

function formatarNumero(v: number | null | undefined) {
  return (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}
function formatarData(d: string) {
  if (!d) return "-";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}
function formatarPlaca(placa: string) {
  const m = placa.match(/^([A-Z]{3})(\d[A-Z0-9]{3})$/);
  return m ? `${m[1]} ${m[2]}` : placa;
}

const ACAO_LABEL: Record<string, string> = {
  FINALIZACAO: "Ficha finalizada",
  AJUSTE_SALDO_INICIAL: "Ajuste de saldo inicial",
  REABERTURA: "Ficha reaberta",
};

export default function FichaAbastecimentoDetalhe({
  ficha, comboio, modulos, impedimentos, materiais, onVoltar,
}: {
  ficha: FichaCompleta; comboio: Comboio; modulos: Modulo[]; impedimentos: Impedimento[]; materiais: Material[]; onVoltar: () => void;
}) {
  const { isAdmin } = useAuth();
  const [historico, setHistorico] = useState<HistoricoEntry[]>([]);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [avisoReabertura, setAvisoReabertura] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const modulo = modulos.find((m) => m.id === ficha.ficha.modulo_id);
  const impedimento = impedimentos.find((i) => i.id === ficha.ficha.codigo_impedimento_id);
  const temTanque2 = comboio.numero_tanques_diesel >= 2;
  const tipos = INSUMO_TIPOS.filter((t) => temTanque2 || t !== "DIESEL_T2");

  useEffect(() => { getHistoricoFicha("ABASTECIMENTO", ficha.ficha.id).then(setHistorico); }, [ficha.ficha.id]);

  async function handleReabrir() {
    if (!confirm("Reabrir esta ficha? Ela volta pro status Rascunho e a reabertura fica registrada no histórico.")) return;
    setReabrindo(true);
    setErro(null);
    try {
      const result = await reabrirFicha(ficha.ficha.id);
      if (result.error) { setErro(result.error); return; }
      if (result.aviso) setAvisoReabertura(result.aviso);
      else onVoltar();
    } finally {
      setReabrindo(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3 flex-wrap">
        <button onClick={onVoltar} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="text-sm font-black text-zinc-900 dark:text-zinc-50 font-mono">{formatarPlaca(comboio.placa)}</div>
          <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
            Ficha Nº {ficha.ficha.numero_sequencial} — {ficha.ficha.status}
          </div>
        </div>
        <button onClick={() => setMostrarHistorico((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <History size={14} /> Histórico
        </button>
        <button onClick={() => imprimirFichaAbastecimento(ficha, comboio, modulos, impedimentos, materiais)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <Printer size={14} /> Imprimir
        </button>
        <button onClick={() => gerarPDFFichaAbastecimento(ficha, comboio, modulos, impedimentos, materiais)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl">
          <FileDown size={14} /> PDF
        </button>
        {isAdmin && ficha.ficha.status !== "RASCUNHO" && (
          <button onClick={handleReabrir} disabled={reabrindo} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 border border-red-200 dark:border-red-900 rounded-xl disabled:opacity-50">
            <RotateCcw size={14} /> Reabrir
          </button>
        )}
      </div>

      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        {erro && <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-700 dark:text-red-400">{erro}</div>}
        {avisoReabertura && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" /> {avisoReabertura}
          </div>
        )}

        {mostrarHistorico && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-2">
            <div className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-2">Histórico de Alterações</div>
            {historico.length === 0 && <div className="text-xs text-zinc-400">Nenhum evento registrado.</div>}
            {historico.map((h) => (
              <div key={h.id} className="text-xs border-b border-zinc-100 dark:border-zinc-800 pb-2 last:border-0">
                <span className="font-bold text-zinc-700 dark:text-zinc-200">{ACAO_LABEL[h.acao] || h.acao}</span>
                {" — "}{h.usuario_nome || "Sistema"}{" — "}
                <span className="text-zinc-400">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Turno</div><div className="font-bold">{ficha.ficha.turno}º</div></div>
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Data</div><div className="font-bold">{formatarData(ficha.ficha.data)}</div></div>
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Módulo</div><div className="font-bold">{modulo?.nome || "-"}</div></div>
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Impedimento</div><div className="font-bold">{impedimento?.descricao || "-"}</div></div>
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Motorista</div><div className="font-bold">{ficha.ficha.motorista_nome || "-"}</div></div>
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Lubrificador</div><div className="font-bold">{ficha.ficha.lubrificador_nome || "-"}</div></div>
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Horímetro Inicial</div><div className="font-bold">{formatarNumero(ficha.ficha.km_horimetro_inicial)}</div></div>
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Horímetro Final</div><div className="font-bold">{formatarNumero(ficha.ficha.km_horimetro_final)}</div></div>
          {ficha.ficha.observacoes && <div className="col-span-full"><div className="text-[10px] text-zinc-400 uppercase font-bold">Observações</div><div>{ficha.ficha.observacoes}</div></div>}
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
          <div className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">Resumo de Insumos</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-400 uppercase text-[10px] font-black">
                  <th className="text-left pb-2">Insumo</th><th className="text-right pb-2">Inicial</th>
                  <th className="text-right pb-2">Entrou</th><th className="text-right pb-2">Saiu</th><th className="text-right pb-2">Restou</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {tipos.map((tipo) => {
                  const i = ficha.insumos.find((x) => x.insumo_tipo === tipo);
                  return (
                    <tr key={tipo}>
                      <td className="py-2 font-semibold text-zinc-600 dark:text-zinc-300">{labelMaterialInsumo(tipo, materiais, temTanque2)}</td>
                      <td className="py-2 text-right">{formatarNumero(i?.quantidade_inicial)}</td>
                      <td className="py-2 text-right text-emerald-600">{formatarNumero(i?.entrou)}</td>
                      <td className="py-2 text-right text-red-500">{formatarNumero(i?.saiu)}</td>
                      <td className="py-2 text-right font-black">{formatarNumero(i?.restou)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
          <div className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">Consumo por Equipamento</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="text-zinc-400 uppercase text-[10px] font-black">
                  <th className="text-left pb-2 pr-3">Hora</th><th className="text-left pb-2 pr-3">Equipamento</th>
                  <th className="text-right pb-2 pr-3">Horím.</th><th className="text-right pb-2 pr-3">Diesel</th>
                  <th className="text-right pb-2 pr-3">Motor</th><th className="text-right pb-2 pr-3">Corrente</th>
                  <th className="text-right pb-2 pr-3">Graxa</th><th className="text-right pb-2 pr-3">Operador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {ficha.linhas.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-3">{l.hora_inicial}–{l.hora_final}</td>
                    <td className="py-2 pr-3 font-bold">{l.equipamento_texto}</td>
                    <td className="py-2 pr-3 text-right">{formatarNumero(l.horimetro)}</td>
                    <td className="py-2 pr-3 text-right">{formatarNumero(l.diesel_litros)}</td>
                    <td className="py-2 pr-3 text-right">{formatarNumero(l.motor)}</td>
                    <td className="py-2 pr-3 text-right">{formatarNumero(l.corrente)}</td>
                    <td className="py-2 pr-3 text-right">{formatarNumero(l.graxa)}</td>
                    <td className="py-2 pr-3 text-right">{l.matricula_operador || "-"}</td>
                  </tr>
                ))}
                {ficha.linhas.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-zinc-400">Nenhum lançamento.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
