"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Droplets, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignaturePad } from "@/components/SignaturePad";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Comboio, Modulo, Material, Colaborador, criarColaborador } from "./actions";
import { criarRecargaFinalizada, getSkidsDisponiveis, getSaldoSkid, OrigemRecarga, Skid, SaldoSkidItem } from "./recargaActions";

const inputCls = "w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 outline-none focus:border-indigo-500";
const labelCls = "text-[10px] font-black text-zinc-500 uppercase tracking-wider block mb-1.5";

type ItemForm = { material_id: string; quantidade: string; req_nf: string; tanque_diesel: 1 | 2 };

export default function RecargaModal({
  comboio, modulos, materiais, colaboradores, onClose, onConcluida,
}: {
  comboio: Comboio;
  modulos: Modulo[];
  materiais: Material[];
  colaboradores: Colaborador[];
  onClose: () => void;
  onConcluida?: () => void;
}) {
  const [listaColaboradores, setListaColaboradores] = useState(colaboradores);
  const [origemTipo, setOrigemTipo] = useState<OrigemRecarga>("SKID");
  const [skids, setSkids] = useState<Skid[]>([]);
  const [skidId, setSkidId] = useState("");
  const [saldoSkid, setSaldoSkid] = useState<SaldoSkidItem[]>([]);
  const [origemDeposito, setOrigemDeposito] = useState("");
  const [origemOutroTexto, setOrigemOutroTexto] = useState("");

  const [moduloId, setModuloId] = useState("");
  const [turno, setTurno] = useState<"1" | "2" | "3" | "">("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState("");
  const [motoristaNome, setMotoristaNome] = useState("");
  const [motoristaMatricula, setMotoristaMatricula] = useState("");
  const [observacao, setObservacao] = useState("");
  const [localRecarga, setLocalRecarga] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelMatricula, setResponsavelMatricula] = useState("");
  const [assinatura, setAssinatura] = useState("");

  const [itens, setItens] = useState<Record<string, ItemForm>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);

  const temTanque2 = comboio.numero_tanques_diesel >= 2;

  useEffect(() => {
    if (origemTipo === "SKID") getSkidsDisponiveis().then(setSkids);
  }, [origemTipo]);

  useEffect(() => {
    if (origemTipo === "SKID" && skidId) getSaldoSkid(skidId).then(setSaldoSkid);
    else setSaldoSkid([]);
  }, [origemTipo, skidId]);

  const saldoPorMaterial = useMemo(() => {
    const map: Record<string, number> = {};
    saldoSkid.forEach((s) => { map[s.material_id] = s.saldo; });
    return map;
  }, [saldoSkid]);

  const motoristasOptions = useMemo(
    () => listaColaboradores.filter((c) => c.tipo === "MOTORISTA").map((c) => ({ value: c.nome, label: c.matricula ? `${c.nome} (${c.matricula})` : c.nome })),
    [listaColaboradores]
  );

  function aplicarMotorista(nome: string) {
    const c = listaColaboradores.find((x) => x.nome === nome);
    setMotoristaNome(nome);
    setMotoristaMatricula(c?.matricula || motoristaMatricula);
  }

  async function adicionarNovoMotorista(nome: string) {
    const result = await criarColaborador(nome, "MOTORISTA");
    if (result.error) { setErro(result.error); return; }
    if (result.colaborador) {
      const novo = result.colaborador;
      setListaColaboradores((prev) => (prev.some((c) => c.id === novo.id) ? prev : [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome))));
      aplicarMotorista(novo.nome);
    }
  }

  function toggleMaterial(materialId: string) {
    setItens((prev) => {
      const copy = { ...prev };
      if (copy[materialId]) delete copy[materialId];
      else copy[materialId] = { material_id: materialId, quantidade: "", req_nf: "", tanque_diesel: 1 };
      return copy;
    });
  }

  function atualizarItem(materialId: string, patch: Partial<ItemForm>) {
    setItens((prev) => ({ ...prev, [materialId]: { ...prev[materialId], ...patch } }));
  }

  async function finalizar() {
    setErro(null);
    const listaItens = Object.values(itens).filter((i) => Number(i.quantidade) > 0);
    if (!listaItens.length) { setErro("Adicione pelo menos um item com quantidade maior que zero."); return; }
    if (origemTipo === "SKID" && !skidId) { setErro("Selecione o skid de origem."); return; }

    setSalvando(true);
    try {
      const result = await criarRecargaFinalizada({
        equipamento_id: comboio.id,
        modulo_id: moduloId || null,
        turno: turno || null,
        data, hora: hora || null,
        motorista_nome: motoristaNome || null, motorista_matricula: motoristaMatricula || null,
        observacao: observacao || null,
        origem_tipo: origemTipo,
        origem_skid_id: origemTipo === "SKID" ? skidId : null,
        origem_deposito: origemTipo === "ALMOXARIFADO" ? origemDeposito || null : null,
        origem_outro_texto: origemTipo === "OUTRO" ? origemOutroTexto || null : null,
        local_recarga: localRecarga || null,
        responsavel_nome: responsavelNome || null, responsavel_matricula: responsavelMatricula || null,
        responsavel_assinatura_url: assinatura || null,
        itens: listaItens.map((i) => ({
          material_id: i.material_id, quantidade: Number(i.quantidade), req_nf: i.req_nf || null,
          tanque_diesel: temTanque2 ? i.tanque_diesel : undefined,
        })),
      });
      if (result.error) { setErro(result.error); return; }
      setConcluido(true);
      onConcluida?.();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <Droplets size={18} className="text-indigo-500 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-50">Ficha de Recarga de Insumos</h2>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{comboio.placa}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        {concluido ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 size={40} className="text-emerald-500" />
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Recarga registrada com sucesso.</p>
            <button onClick={onClose} className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold">Fechar</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {erro && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" /> {erro}
              </div>
            )}

            <div>
              <label className={labelCls}>Origem da Recarga</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([["SKID", "Skid"], ["ALMOXARIFADO", "Almox."], ["FORNECEDOR", "Fornecedor"], ["OUTRO", "Outro"]] as [OrigemRecarga, string][]).map(([v, label]) => (
                  <button key={v} onClick={() => setOrigemTipo(v)}
                    className={cn("py-2 rounded-xl text-xs font-bold border-2", origemTipo === v ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400" : "border-zinc-200 dark:border-zinc-800 text-zinc-500")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {origemTipo === "SKID" && (
              <div>
                <label className={labelCls}>Skid de Origem</label>
                <select className={inputCls} value={skidId} onChange={(e) => setSkidId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {skids.map((s) => <option key={s.id} value={s.id}>{s.placa} — {s.modelo}</option>)}
                </select>
              </div>
            )}
            {origemTipo === "ALMOXARIFADO" && (
              <div>
                <label className={labelCls}>Depósito</label>
                <input className={inputCls} value={origemDeposito} onChange={(e) => setOrigemDeposito(e.target.value)} placeholder="Ex: CB10" />
              </div>
            )}
            {origemTipo === "OUTRO" && (
              <div>
                <label className={labelCls}>Descreva a origem</label>
                <input className={inputCls} value={origemOutroTexto} onChange={(e) => setOrigemOutroTexto(e.target.value)} />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Turno</label>
                <select className={inputCls} value={turno} onChange={(e) => setTurno(e.target.value as any)}>
                  <option value="">—</option>
                  <option value="1">1º</option>
                  <option value="2">2º</option>
                  <option value="3">3º</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Data</label>
                <input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Hora</label>
                <input type="time" className={inputCls} value={hora} onChange={(e) => setHora(e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Módulo</label>
              <select className={inputCls} value={moduloId} onChange={(e) => setModuloId(e.target.value)}>
                <option value="">Selecione...</option>
                {modulos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Motorista EUN</label>
                <SearchableSelect
                  options={motoristasOptions} value={motoristaNome} onChange={aplicarMotorista}
                  onAddNew={adicionarNovoMotorista} placeholder="Selecione ou busque..."
                />
              </div>
              <div>
                <label className={labelCls}>Matrícula</label>
                <input className={inputCls} value={motoristaMatricula} onChange={(e) => setMotoristaMatricula(e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Local da Recarga</label>
              <input className={inputCls} value={localRecarga} onChange={(e) => setLocalRecarga(e.target.value)} placeholder="Ex: Pátio do módulo 07" />
            </div>

            <div>
              <label className={labelCls}>Itens</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {materiais.map((m) => (
                  <button key={m.id} onClick={() => toggleMaterial(m.id)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-bold border-2", itens[m.id] ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400" : "border-zinc-200 dark:border-zinc-800 text-zinc-500")}>
                    {m.material}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {Object.values(itens).map((item) => {
                  const material = materiais.find((m) => m.id === item.material_id)!;
                  const saldo = saldoPorMaterial[item.material_id];
                  return (
                    <div key={item.material_id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        <span>{material.material} ({material.unidade})</span>
                        {origemTipo === "SKID" && skidId && <span className="text-zinc-400 font-normal">Saldo no skid: {saldo?.toLocaleString("pt-BR") ?? "0"}</span>}
                      </div>
                      <div className={cn("grid grid-cols-1 gap-2", temTanque2 && material.aplicacao === "DIESEL" ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                        <input type="number" step="0.1" placeholder="Quantidade" className={inputCls} value={item.quantidade}
                          onChange={(e) => atualizarItem(item.material_id, { quantidade: e.target.value })} />
                        <input placeholder="REQ/NF" className={inputCls} value={item.req_nf}
                          onChange={(e) => atualizarItem(item.material_id, { req_nf: e.target.value })} />
                        {temTanque2 && material.aplicacao === "DIESEL" && (
                          <select className={inputCls} value={item.tanque_diesel} onChange={(e) => atualizarItem(item.material_id, { tanque_diesel: Number(e.target.value) as 1 | 2 })}>
                            <option value={1}>Tanque 1°</option>
                            <option value={2}>Tanque 2°</option>
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Responsável (Estoque Cliente)</label>
                <input className={inputCls} value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Matrícula</label>
                <input className={inputCls} value={responsavelMatricula} onChange={(e) => setResponsavelMatricula(e.target.value)} />
              </div>
            </div>
            <SignaturePad value={assinatura} onChange={setAssinatura} label="Assinatura do Responsável" />

            <div className="flex justify-end gap-2 pt-2 pb-1">
              <button onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                Cancelar
              </button>
              <button onClick={finalizar} disabled={salvando} className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50">
                {salvando ? "Salvando..." : "Finalizar Recarga"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
