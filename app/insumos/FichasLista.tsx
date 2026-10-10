"use client";

import { useEffect, useState } from "react";
import { FileText, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Comboio, Modulo, Material, Impedimento,
  FichaAbastecimentoResumo, FiltroFichas, getFichasAbastecimento, getFicha, FichaCompleta,
} from "./actions";
import { FichaRecargaResumo, getFichasRecarga, getRecarga, RecargaCompleta } from "./recargaActions";
import FichaAbastecimentoDetalhe from "./FichaAbastecimentoDetalhe";
import RecargaDetalhe from "./RecargaDetalhe";

const inputCls = "px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 outline-none focus:border-amber-500";

const STATUS_BADGE: Record<string, string> = {
  RASCUNHO: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  FINALIZADA: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  VALIDADA: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function FichasLista({
  comboios, modulos, materiais, impedimentos,
}: { comboios: Comboio[]; modulos: Modulo[]; materiais: Material[]; impedimentos: Impedimento[] }) {
  const [subTab, setSubTab] = useState<"ABASTECIMENTO" | "RECARGA">("ABASTECIMENTO");
  const [fichas, setFichas] = useState<FichaAbastecimentoResumo[]>([]);
  const [recargas, setRecargas] = useState<FichaRecargaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [filtroModulo, setFiltroModulo] = useState("");
  const [filtroComboio, setFiltroComboio] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroDataIni, setFiltroDataIni] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const [fichaDetalhe, setFichaDetalhe] = useState<FichaCompleta | null>(null);
  const [recargaDetalhe, setRecargaDetalhe] = useState<RecargaCompleta | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      if (subTab === "ABASTECIMENTO") {
        const filtro: FiltroFichas = {
          moduloId: filtroModulo || undefined, equipamentoId: filtroComboio || undefined,
          status: (filtroStatus as any) || undefined, dataInicio: filtroDataIni || undefined, dataFim: filtroDataFim || undefined,
        };
        setFichas(await getFichasAbastecimento(filtro));
      } else {
        setRecargas(await getFichasRecarga({ equipamentoId: filtroComboio || undefined, dataInicio: filtroDataIni || undefined, dataFim: filtroDataFim || undefined }));
      }
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, [subTab, filtroModulo, filtroComboio, filtroStatus, filtroDataIni, filtroDataFim]);

  async function abrirFicha(id: string) {
    const r = await getFicha(id);
    if (r.ficha) setFichaDetalhe(r.ficha);
  }
  async function abrirRecarga(id: string) {
    const r = await getRecarga(id);
    if (r.recarga) setRecargaDetalhe(r.recarga);
  }

  if (fichaDetalhe) {
    const comboio = comboios.find((c) => c.id === fichaDetalhe.ficha.equipamento_id)!;
    return (
      <FichaAbastecimentoDetalhe
        ficha={fichaDetalhe} comboio={comboio} modulos={modulos} impedimentos={impedimentos}
        onVoltar={() => { setFichaDetalhe(null); carregar(); }}
      />
    );
  }
  if (recargaDetalhe) {
    const comboio = comboios.find((c) => c.id === recargaDetalhe.recarga.equipamento_id);
    const origemSkid = comboios.find((c) => c.id === recargaDetalhe.recarga.origem_skid_id);
    const modulo = modulos.find((m) => m.id === recargaDetalhe.recarga.modulo_id);
    return (
      <RecargaDetalhe
        recarga={recargaDetalhe} placaComboio={comboio?.placa || "-"} placaOrigem={origemSkid?.placa || null}
        moduloNome={modulo?.nome || null} onVoltar={() => setRecargaDetalhe(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setSubTab("ABASTECIMENTO")}
          className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider", subTab === "ABASTECIMENTO" ? "bg-amber-600 text-white" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500")}>
          <FileText size={13} /> Abastecimento
        </button>
        <button onClick={() => setSubTab("RECARGA")}
          className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider", subTab === "RECARGA" ? "bg-indigo-600 text-white" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500")}>
          <Droplets size={13} /> Recarga
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-wrap gap-2 items-center">
        <input type="date" className={inputCls} value={filtroDataIni} onChange={(e) => setFiltroDataIni(e.target.value)} />
        <span className="text-xs text-zinc-400">até</span>
        <input type="date" className={inputCls} value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
        <select className={inputCls} value={filtroComboio} onChange={(e) => setFiltroComboio(e.target.value)}>
          <option value="">Todos os comboios</option>
          {comboios.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}
        </select>
        {subTab === "ABASTECIMENTO" && (
          <>
            <select className={inputCls} value={filtroModulo} onChange={(e) => setFiltroModulo(e.target.value)}>
              <option value="">Todos os módulos</option>
              {modulos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <select className={inputCls} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="RASCUNHO">Rascunho</option>
              <option value="FINALIZADA">Finalizada</option>
              <option value="VALIDADA">Validada</option>
            </select>
          </>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-x-auto">
        {carregando ? (
          <div className="p-8 text-center text-sm text-zinc-400">Carregando...</div>
        ) : subTab === "ABASTECIMENTO" ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-400 uppercase text-[10px] font-black border-b border-zinc-100 dark:border-zinc-800">
                <th className="text-left p-3">Nº</th><th className="text-left p-3">Data</th><th className="text-left p-3">Turno</th>
                <th className="text-left p-3">Comboio</th><th className="text-left p-3">Módulo</th><th className="text-left p-3">Motorista</th>
                <th className="text-right p-3">Diesel Saído</th><th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {fichas.map((f) => (
                <tr key={f.id} onClick={() => abrirFicha(f.id)} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="p-3 font-bold">{f.numero_sequencial}</td>
                  <td className="p-3">{f.data.slice(8, 10)}/{f.data.slice(5, 7)}/{f.data.slice(0, 4)}</td>
                  <td className="p-3">{f.turno}º</td>
                  <td className="p-3 font-mono font-bold">{f.placa}</td>
                  <td className="p-3">{f.modulo_nome || "-"}</td>
                  <td className="p-3">{f.motorista_nome || "-"}</td>
                  <td className="p-3 text-right font-bold">{f.dieselSaido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L</td>
                  <td className="p-3"><span className={cn("px-2 py-1 rounded-full text-[10px] font-black uppercase", STATUS_BADGE[f.status])}>{f.status}</span></td>
                </tr>
              ))}
              {fichas.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-zinc-400">Nenhuma ficha encontrada.</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-400 uppercase text-[10px] font-black border-b border-zinc-100 dark:border-zinc-800">
                <th className="text-left p-3">Nº</th><th className="text-left p-3">Data</th><th className="text-left p-3">Comboio</th>
                <th className="text-left p-3">Origem</th><th className="text-left p-3">Aplicada?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recargas.map((r) => (
                <tr key={r.id} onClick={() => abrirRecarga(r.id)} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="p-3 font-bold">{r.numero_sequencial}</td>
                  <td className="p-3">{r.data.slice(8, 10)}/{r.data.slice(5, 7)}/{r.data.slice(0, 4)}</td>
                  <td className="p-3 font-mono font-bold">{r.placa}</td>
                  <td className="p-3">{r.origem_label}</td>
                  <td className="p-3">
                    <span className={cn("px-2 py-1 rounded-full text-[10px] font-black uppercase", r.aplicado ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>
                      {r.aplicado ? "Sim" : "Pendente"}
                    </span>
                  </td>
                </tr>
              ))}
              {recargas.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-zinc-400">Nenhuma recarga encontrada.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
