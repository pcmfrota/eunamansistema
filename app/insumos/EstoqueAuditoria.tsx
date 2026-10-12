"use client";

import { useEffect, useState } from "react";
import { Warehouse, Truck, Plus, Camera, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { Comboio, Material, getAuditoriaComboio, AuditoriaInsumoComboio } from "./actions";
import { labelMaterialInsumo } from "./config";
import { getSkidsDisponiveis, getAuditoriaSkid, registrarEntradaSkid, registrarMedicaoSkid, Skid, AuditoriaSkidItem } from "./recargaActions";

const inputCls = "px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 outline-none focus:border-amber-500";

function primeiroDiaDoMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function hoje() {
  return new Date().toISOString().slice(0, 10);
}
function formatarNum(v: number) {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export default function EstoqueAuditoria({ comboios, materiais }: { comboios: Comboio[]; materiais: Material[] }) {
  const [tipo, setTipo] = useState<"COMBOIO" | "SKID">("COMBOIO");
  const [comboioId, setComboioId] = useState(comboios[0]?.id || "");
  const [skids, setSkids] = useState<Skid[]>([]);
  const [skidId, setSkidId] = useState("");
  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMes());
  const [dataFim, setDataFim] = useState(hoje());

  const [auditoriaComboio, setAuditoriaComboio] = useState<AuditoriaInsumoComboio[]>([]);
  const [auditoriaSkid, setAuditoriaSkid] = useState<AuditoriaSkidItem[]>([]);
  const [carregando, setCarregando] = useState(false);

  const [formEntrada, setFormEntrada] = useState<{ materialId: string } | null>(null);
  const [formMedicao, setFormMedicao] = useState<{ materialId: string } | null>(null);

  useEffect(() => { getSkidsDisponiveis().then((s) => { setSkids(s); if (s[0]) setSkidId(s[0].id); }); }, []);

  async function carregar() {
    setCarregando(true);
    try {
      if (tipo === "COMBOIO" && comboioId) setAuditoriaComboio(await getAuditoriaComboio(comboioId, dataInicio, dataFim));
      else if (tipo === "SKID" && skidId) setAuditoriaSkid(await getAuditoriaSkid(skidId, dataInicio, dataFim));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, [tipo, comboioId, skidId, dataInicio, dataFim]);

  const temTanque2 = (comboios.find((c) => c.id === comboioId)?.numero_tanques_diesel || 1) >= 2;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTipo("COMBOIO")}
          className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider", tipo === "COMBOIO" ? "bg-amber-600 text-white" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500")}>
          <Truck size={13} /> Comboios
        </button>
        <button onClick={() => setTipo("SKID")}
          className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider", tipo === "SKID" ? "bg-indigo-600 text-white" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500")}>
          <Warehouse size={13} /> Skids
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-wrap gap-2 items-center">
        {tipo === "COMBOIO" ? (
          <select className={inputCls} value={comboioId} onChange={(e) => setComboioId(e.target.value)}>
            {comboios.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}
          </select>
        ) : (
          <select className={inputCls} value={skidId} onChange={(e) => setSkidId(e.target.value)}>
            {skids.map((s) => <option key={s.id} value={s.id}>{s.placa}</option>)}
          </select>
        )}
        <input type="date" className={inputCls} value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        <span className="text-xs text-zinc-400">até</span>
        <input type="date" className={inputCls} value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
      </div>

      {carregando ? (
        <div className="p-8 text-center text-sm text-zinc-400">Carregando...</div>
      ) : tipo === "COMBOIO" ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-400 uppercase text-[10px] font-black">
                <th className="text-left pb-2">Insumo</th><th className="text-right pb-2">Entrada (período)</th>
                <th className="text-right pb-2">Saída (período)</th><th className="text-right pb-2">Saldo Atual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {auditoriaComboio.map((a) => (
                <tr key={a.insumo_tipo}>
                  <td className="py-2 font-semibold text-zinc-600 dark:text-zinc-300">{labelMaterialInsumo(a.insumo_tipo, materiais, temTanque2)}</td>
                  <td className="py-2 text-right text-emerald-600">{formatarNum(a.entrada)}</td>
                  <td className="py-2 text-right text-red-500">{formatarNum(a.saida)}</td>
                  <td className="py-2 text-right font-black">{formatarNum(a.saldoAtual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {auditoriaSkid.map((item) => (
            <div key={item.material_id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{item.material_nome}</div>
                  <div className="text-[10px] text-zinc-400">NI {item.ni} · {item.unidade}</div>
                </div>
                <div className="flex gap-4 text-xs">
                  <div className="text-center"><div className="text-[9px] text-zinc-400 uppercase font-bold">Saldo</div><div className="font-black text-sm">{formatarNum(item.saldoAtual)}</div></div>
                  <div className="text-center"><div className="text-[9px] text-zinc-400 uppercase font-bold">Entrada</div><div className="font-bold text-emerald-600">{formatarNum(item.entradaPeriodo)}</div></div>
                  <div className="text-center"><div className="text-[9px] text-zinc-400 uppercase font-bold">Saída</div><div className="font-bold text-red-500">{formatarNum(item.saidaPeriodo)}</div></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setFormEntrada({ materialId: item.material_id })} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-emerald-600 border border-emerald-200 dark:border-emerald-900 rounded-lg">
                    <Plus size={11} /> Entrada
                  </button>
                  <button onClick={() => setFormMedicao({ materialId: item.material_id })} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                    <Ruler size={11} /> Medição
                  </button>
                </div>
              </div>
              {item.saidaPorComboio.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-2">
                  {item.saidaPorComboio.map((s) => (
                    <span key={s.placa} className="text-[10px] px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{s.placa}: {formatarNum(s.quantidade)}</span>
                  ))}
                </div>
              )}
              {item.ultimaMedicao && (
                <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-500">
                  Última medição ({item.ultimaMedicao.data.slice(8, 10)}/{item.ultimaMedicao.data.slice(5, 7)}): {formatarNum(item.ultimaMedicao.litros_calculados || 0)} —
                  <span className={cn("font-bold ml-1", Math.abs(item.ultimaMedicao.diferenca) > 1 ? "text-red-600" : "text-emerald-600")}>
                    diferença {formatarNum(item.ultimaMedicao.diferenca)}
                  </span>
                </div>
              )}
              {formEntrada?.materialId === item.material_id && (
                <FormEntradaSkid equipamentoId={skidId} materialId={item.material_id} onFechar={() => setFormEntrada(null)} onSalvo={() => { setFormEntrada(null); carregar(); }} />
              )}
              {formMedicao?.materialId === item.material_id && (
                <FormMedicaoSkid equipamentoId={skidId} materialId={item.material_id} onFechar={() => setFormMedicao(null)} onSalvo={() => { setFormMedicao(null); carregar(); }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormEntradaSkid({ equipamentoId, materialId, onFechar, onSalvo }: { equipamentoId: string; materialId: string; onFechar: () => void; onSalvo: () => void }) {
  const [quantidade, setQuantidade] = useState("");
  const [reqNf, setReqNf] = useState("");
  const [observacao, setObservacao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!Number(quantidade) || Number(quantidade) <= 0) { setErro("Informe uma quantidade válida."); return; }
    setSalvando(true);
    setErro(null);
    try {
      let fotoUrl: string | null = null;
      if (foto) {
        const supabase = createClient();
        const ext = foto.name.split(".").pop() || "jpg";
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("insumos-fotos-entradas").upload(fileName, foto);
        if (uploadError) throw new Error("Erro ao enviar foto: " + uploadError.message);
        fotoUrl = supabase.storage.from("insumos-fotos-entradas").getPublicUrl(fileName).data.publicUrl;
      }
      const result = await registrarEntradaSkid(equipamentoId, materialId, Number(quantidade), new Date().toISOString().slice(0, 10), reqNf || null, fotoUrl, observacao || null);
      if (result.error) { setErro(result.error); return; }
      onSalvo();
    } catch (e: any) {
      setErro(e.message || "Erro ao registrar entrada.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
      {erro && <div className="text-[11px] text-red-600">{erro}</div>}
      <div className="grid grid-cols-2 gap-2">
        <input type="number" step="0.1" placeholder="Quantidade" className={inputCls} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        <input placeholder="REQ/NF (opcional)" className={inputCls} value={reqNf} onChange={(e) => setReqNf(e.target.value)} />
      </div>
      <input placeholder="Observação (opcional)" className={cn(inputCls, "w-full")} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      <label className="flex items-center justify-center gap-2 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[11px] font-bold text-zinc-600 dark:text-zinc-300 cursor-pointer">
        <Camera size={13} /> {foto ? foto.name : "Foto / NF (opcional)"}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => setFoto(e.target.files?.[0] || null)} />
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onFechar} className="text-[11px] font-bold text-zinc-500">Cancelar</button>
        <button disabled={salvando} onClick={salvar} className="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 rounded-lg disabled:opacity-50">
          {salvando ? "Salvando..." : "Registrar Entrada"}
        </button>
      </div>
    </div>
  );
}

function FormMedicaoSkid({ equipamentoId, materialId, onFechar, onSalvo }: { equipamentoId: string; materialId: string; onFechar: () => void; onSalvo: () => void }) {
  const [reguaCm, setReguaCm] = useState("");
  const [litros, setLitros] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!litros) { setErro("Informe os litros medidos."); return; }
    setSalvando(true);
    setErro(null);
    try {
      const result = await registrarMedicaoSkid(equipamentoId, materialId, new Date().toISOString().slice(0, 10), reguaCm ? Number(reguaCm) : null, Number(litros), observacao || null);
      if (result.error) { setErro(result.error); return; }
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
      {erro && <div className="text-[11px] text-red-600">{erro}</div>}
      <div className="grid grid-cols-2 gap-2">
        <input type="number" placeholder="Régua (cm, opcional)" className={inputCls} value={reguaCm} onChange={(e) => setReguaCm(e.target.value)} />
        <input type="number" step="0.1" placeholder="Litros medidos" className={inputCls} value={litros} onChange={(e) => setLitros(e.target.value)} />
      </div>
      <input placeholder="Observação (opcional)" className={cn(inputCls, "w-full")} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button onClick={onFechar} className="text-[11px] font-bold text-zinc-500">Cancelar</button>
        <button disabled={salvando} onClick={salvar} className="px-3 py-1.5 text-[11px] font-bold text-white bg-zinc-700 rounded-lg disabled:opacity-50">
          {salvando ? "Salvando..." : "Registrar Medição"}
        </button>
      </div>
    </div>
  );
}
