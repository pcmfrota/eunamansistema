"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, AlertTriangle, CheckCircle2, Fuel, Camera, Droplets, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignaturePad } from "@/components/SignaturePad";
import { SearchableSelect } from "@/components/SearchableSelect";
import { createClient } from "@/utils/supabase/client";
import {
  FichaCompleta, Comboio, Modulo, Material, Impedimento, MaquinaSuzano, Colaborador,
  LinhaAbastecimento, FechamentoPayload,
  atualizarCabecalhoFicha, atualizarFichaInsumo, salvarLinhaAbastecimento, excluirLinhaAbastecimento,
  finalizarFicha, getFicha, getMaquinasPorModulo, criarMaquinaAdHoc, criarColaborador,
} from "./actions";
import { InsumoTipo, INSUMO_TIPOS, labelMaterialInsumo } from "./config";
import RecargaModal from "./RecargaModal";
import { getRecargasAplicadasNaFicha, RecargaAplicada } from "./recargaActions";

const ADICIONAR_MAQUINA = "__ADICIONAR__";

const ETAPAS = [
  "Turno e Data", "Motorista/Lubrificador", "Módulo e Horímetro",
  "Conferência de Saldo", "Abastecimentos", "Entradas no Turno", "Fechamento",
];

function formatarPlaca(placa: string) {
  const m = placa.match(/^([A-Z]{3})(\d[A-Z0-9]{3})$/);
  return m ? `${m[1]} ${m[2]}` : placa;
}

function formatarNumero(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

const inputCls = "w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 outline-none focus:border-amber-500";
const labelCls = "text-[10px] font-black text-zinc-500 uppercase tracking-wider block mb-1.5";

export default function FichaAbastecimentoWizard({
  fichaInicial, comboio, modulos, materiais, impedimentos, colaboradores, equipamentos, onVoltar, onAtualizarFicha,
}: {
  fichaInicial: FichaCompleta;
  comboio: Comboio;
  modulos: Modulo[];
  materiais: Material[];
  impedimentos: Impedimento[];
  colaboradores: Colaborador[];
  equipamentos: { id: string; placa: string; tipo: string }[];
  onVoltar: () => void;
  onAtualizarFicha: (f: FichaCompleta) => void;
}) {
  const [listaColaboradores, setListaColaboradores] = useState(colaboradores);
  const [ficha, setFicha] = useState(fichaInicial);
  const [etapa, setEtapa] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [alertasFinalizacao, setAlertasFinalizacao] = useState<string[] | null>(null);
  const [confirmarFimAbastecimentos, setConfirmarFimAbastecimentos] = useState(false);
  const [confirmouTodosAbastecimentos, setConfirmouTodosAbastecimentos] = useState(false);

  const temTanque2 = comboio.numero_tanques_diesel >= 2;

  const [cab, setCab] = useState({
    turno: ficha.ficha.turno,
    data: ficha.ficha.data,
    motorista_nome: ficha.ficha.motorista_nome || "",
    motorista_matricula: ficha.ficha.motorista_matricula || "",
    lubrificador_nome: ficha.ficha.lubrificador_nome || "",
    lubrificador_matricula: ficha.ficha.lubrificador_matricula || "",
    modulo_id: ficha.ficha.modulo_id || "",
    km_horimetro_inicial: ficha.ficha.km_horimetro_inicial?.toString() ?? "",
    regua_tanque1_inicial_cm: ficha.ficha.regua_tanque1_inicial_cm?.toString() ?? "",
    regua_tanque1_inicial_lts: ficha.ficha.regua_tanque1_inicial_lts?.toString() ?? "",
    regua_tanque2_inicial_cm: ficha.ficha.regua_tanque2_inicial_cm?.toString() ?? "",
    regua_tanque2_inicial_lts: ficha.ficha.regua_tanque2_inicial_lts?.toString() ?? "",
    observacoes: ficha.ficha.observacoes || "",
  });

  const [fechamento, setFechamento] = useState({
    km_horimetro_final: ficha.ficha.km_horimetro_final?.toString() ?? "",
    regua_tanque1_final_cm: ficha.ficha.regua_tanque1_final_cm?.toString() ?? "",
    regua_tanque1_final_lts: ficha.ficha.regua_tanque1_final_lts?.toString() ?? "",
    regua_tanque2_final_cm: ficha.ficha.regua_tanque2_final_cm?.toString() ?? "",
    regua_tanque2_final_lts: ficha.ficha.regua_tanque2_final_lts?.toString() ?? "",
    codigo_impedimento_id: ficha.ficha.codigo_impedimento_id || "",
    observacoes_fechamento: "",
  });

  const insumoPorTipo = useMemo(() => {
    const map: Record<string, typeof ficha.insumos[number]> = {};
    ficha.insumos.forEach((i) => { map[i.insumo_tipo] = i; });
    return map;
  }, [ficha.insumos]);

  // Motorista só lista quem está cadastrado como MOTORISTA; Lubrificador normalmente é outra
  // pessoa (tipo LUBRIFICADOR), mas aceita também um motorista como exceção pra casos esporádicos.
  const motoristasOptions = useMemo(
    () => listaColaboradores.filter((c) => c.tipo === "MOTORISTA").map((c) => ({ value: c.nome, label: c.matricula ? `${c.nome} (${c.matricula})` : c.nome })),
    [listaColaboradores]
  );
  const lubrificadoresOptions = useMemo(
    () => listaColaboradores.filter((c) => c.tipo === "LUBRIFICADOR" || c.tipo === "MOTORISTA").map((c) => ({ value: c.nome, label: c.matricula ? `${c.nome} (${c.matricula})` : c.nome })),
    [listaColaboradores]
  );

  function aplicarColaboradorMotorista(nome: string) {
    const c = listaColaboradores.find((x) => x.nome === nome);
    setCab((p) => ({ ...p, motorista_nome: nome, motorista_matricula: c?.matricula || p.motorista_matricula }));
  }
  function aplicarColaboradorLubrificador(nome: string) {
    const c = listaColaboradores.find((x) => x.nome === nome);
    setCab((p) => ({ ...p, lubrificador_nome: nome, lubrificador_matricula: c?.matricula || p.lubrificador_matricula }));
  }
  async function adicionarNovoColaborador(nome: string, tipo: "MOTORISTA" | "LUBRIFICADOR", aplicar: (nome: string) => void) {
    const result = await criarColaborador(nome, tipo);
    if (result.error) { setErro(result.error); return; }
    if (result.colaborador) {
      const novo = result.colaborador;
      setListaColaboradores((prev) => (prev.some((c) => c.id === novo.id) ? prev : [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome))));
      aplicar(novo.nome);
    }
  }

  async function refetchFicha() {
    const r = await getFicha(ficha.ficha.id);
    if (r.ficha) { setFicha(r.ficha); onAtualizarFicha(r.ficha); }
  }

  async function salvarCabecalho() {
    setSalvando(true);
    setErro(null);
    try {
      const payload: any = {
        turno: cab.turno, data: cab.data,
        motorista_nome: cab.motorista_nome || null, motorista_matricula: cab.motorista_matricula || null,
        lubrificador_nome: cab.lubrificador_nome || null, lubrificador_matricula: cab.lubrificador_matricula || null,
        modulo_id: cab.modulo_id || null,
        km_horimetro_inicial: cab.km_horimetro_inicial ? Number(cab.km_horimetro_inicial) : null,
        regua_tanque1_inicial_cm: cab.regua_tanque1_inicial_cm ? Number(cab.regua_tanque1_inicial_cm) : null,
        regua_tanque1_inicial_lts: cab.regua_tanque1_inicial_lts ? Number(cab.regua_tanque1_inicial_lts) : null,
        regua_tanque2_inicial_cm: cab.regua_tanque2_inicial_cm ? Number(cab.regua_tanque2_inicial_cm) : null,
        regua_tanque2_inicial_lts: cab.regua_tanque2_inicial_lts ? Number(cab.regua_tanque2_inicial_lts) : null,
        observacoes: cab.observacoes || null,
      };
      const result = await atualizarCabecalhoFicha(ficha.ficha.id, payload);
      if (result.error) { setErro(result.error); return false; }
      setFicha((prev) => ({ ...prev, ficha: { ...prev.ficha, ...payload } }));
      return true;
    } finally {
      setSalvando(false);
    }
  }

  async function avancar() {
    if (etapa === 5) {
      setConfirmarFimAbastecimentos(true);
      return;
    }
    if (etapa <= 3) {
      const ok = await salvarCabecalho();
      if (!ok) return;
    }
    setEtapa((e) => Math.min(7, e + 1));
  }

  function voltarEtapa() {
    setEtapa((e) => Math.max(1, e - 1));
  }

  async function handleFinalizar() {
    setSalvando(true);
    setErro(null);
    try {
      const payload: FechamentoPayload = {
        km_horimetro_final: fechamento.km_horimetro_final ? Number(fechamento.km_horimetro_final) : null,
        regua_tanque1_final_cm: fechamento.regua_tanque1_final_cm ? Number(fechamento.regua_tanque1_final_cm) : null,
        regua_tanque1_final_lts: fechamento.regua_tanque1_final_lts ? Number(fechamento.regua_tanque1_final_lts) : null,
        regua_tanque2_final_cm: fechamento.regua_tanque2_final_cm ? Number(fechamento.regua_tanque2_final_cm) : null,
        regua_tanque2_final_lts: fechamento.regua_tanque2_final_lts ? Number(fechamento.regua_tanque2_final_lts) : null,
        codigo_impedimento_id: fechamento.codigo_impedimento_id || null,
        observacoes: fechamento.observacoes_fechamento || null,
      };
      const result = await finalizarFicha(ficha.ficha.id, payload);
      if (result.error) { setErro(result.error); return; }
      if (result.alertas?.length) { setAlertasFinalizacao(result.alertas); return; }
      onVoltar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3">
        <button onClick={onVoltar} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
          <ChevronLeft size={18} />
        </button>
        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
          <Fuel size={18} className="text-amber-500 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-black text-zinc-900 dark:text-zinc-50 font-mono">{formatarPlaca(comboio.placa)}</div>
          <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
            Ficha Nº {ficha.ficha.numero_sequencial} — {comboio.modelo}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1.5">
          {ETAPAS.map((label, i) => (
            <div key={label} className={cn("h-1.5 w-8 rounded-full", i + 1 <= etapa ? "bg-amber-500" : "bg-zinc-200 dark:bg-zinc-800")} title={label} />
          ))}
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <div className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
          Etapa {etapa} de 7 — {ETAPAS[etapa - 1]}
        </div>

        {erro && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" /> {erro}
          </div>
        )}

        {etapa === 1 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
            <div>
              <label className={labelCls}>Turno</label>
              <div className="grid grid-cols-3 gap-2">
                {(["1", "2", "3"] as const).map((t) => (
                  <button key={t} onClick={() => setCab((p) => ({ ...p, turno: t }))}
                    className={cn("py-2.5 rounded-xl text-sm font-bold border-2", cab.turno === t ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" : "border-zinc-200 dark:border-zinc-800 text-zinc-500")}>
                    {t}º Turno
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Data</label>
              <input type="date" className={inputCls} value={cab.data} onChange={(e) => setCab((p) => ({ ...p, data: e.target.value }))} />
            </div>
          </div>
        )}

        {etapa === 2 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Motorista</label>
                <SearchableSelect
                  options={motoristasOptions} value={cab.motorista_nome} onChange={aplicarColaboradorMotorista}
                  onAddNew={(nome) => adicionarNovoColaborador(nome, "MOTORISTA", aplicarColaboradorMotorista)}
                  placeholder="Selecione ou busque..."
                />
              </div>
              <div>
                <label className={labelCls}>Matrícula</label>
                <input className={inputCls} value={cab.motorista_matricula} onChange={(e) => setCab((p) => ({ ...p, motorista_matricula: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Lubrificador (opcional)</label>
                <SearchableSelect
                  options={lubrificadoresOptions} value={cab.lubrificador_nome} onChange={aplicarColaboradorLubrificador}
                  onAddNew={(nome) => adicionarNovoColaborador(nome, "LUBRIFICADOR", aplicarColaboradorLubrificador)}
                  placeholder="Selecione ou busque..."
                />
              </div>
              <div>
                <label className={labelCls}>Matrícula</label>
                <input className={inputCls} value={cab.lubrificador_matricula} onChange={(e) => setCab((p) => ({ ...p, lubrificador_matricula: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
            <div>
              <label className={labelCls}>Módulo</label>
              <select className={inputCls} value={cab.modulo_id} onChange={(e) => setCab((p) => ({ ...p, modulo_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {modulos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Horímetro Inicial do Comboio</label>
              <input type="number" step="0.1" className={inputCls} value={cab.km_horimetro_inicial} onChange={(e) => setCab((p) => ({ ...p, km_horimetro_inicial: e.target.value }))} />
            </div>
            <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wider pt-2">Régua Inicial (opcional)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tanque 1 — CM</label>
                <input type="number" className={inputCls} value={cab.regua_tanque1_inicial_cm} onChange={(e) => setCab((p) => ({ ...p, regua_tanque1_inicial_cm: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Tanque 1 — LTS</label>
                <input type="number" className={inputCls} value={cab.regua_tanque1_inicial_lts} onChange={(e) => setCab((p) => ({ ...p, regua_tanque1_inicial_lts: e.target.value }))} />
              </div>
            </div>
            {temTanque2 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tanque 2 — CM</label>
                  <input type="number" className={inputCls} value={cab.regua_tanque2_inicial_cm} onChange={(e) => setCab((p) => ({ ...p, regua_tanque2_inicial_cm: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Tanque 2 — LTS</label>
                  <input type="number" className={inputCls} value={cab.regua_tanque2_inicial_lts} onChange={(e) => setCab((p) => ({ ...p, regua_tanque2_inicial_lts: e.target.value }))} />
                </div>
              </div>
            )}
          </div>
        )}

        {etapa === 4 && (
          <ConferenciaSaldo ficha={ficha} materiais={materiais} temTanque2={temTanque2} onAjustado={refetchFicha} />
        )}

        {/* Sempre montado (só escondido via CSS) pra não perder o rascunho em andamento se o
            usuário navegar pra outra etapa sem salvar o abastecimento que estava digitando. */}
        <div className={etapa === 5 ? "" : "hidden"}>
          <AbastecimentosEtapa ficha={ficha} materiais={materiais} temTanque2={temTanque2} onMudou={refetchFicha} />
        </div>

        {etapa === 6 && (
          <EntradasEtapa ficha={ficha} comboio={comboio} modulos={modulos} materiais={materiais} colaboradores={listaColaboradores} temTanque2={temTanque2} onAjustado={refetchFicha} />
        )}

        {etapa === 7 && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
              <div>
                <label className={labelCls}>Registradora Final — Diesel Tanque 1°</label>
                <input type="number" step="0.1" className={inputCls}
                  defaultValue={insumoPorTipo.DIESEL_T1?.acumulado_registradora_final ?? ""}
                  onBlur={async (e) => { await atualizarFichaInsumo(ficha.ficha.id, "DIESEL_T1", { acumulado_registradora_final: e.target.value ? Number(e.target.value) : undefined }); refetchFicha(); }}
                />
              </div>
              {temTanque2 && (
                <div>
                  <label className={labelCls}>Registradora Final — Diesel Tanque 2°</label>
                  <input type="number" step="0.1" className={inputCls}
                    defaultValue={insumoPorTipo.DIESEL_T2?.acumulado_registradora_final ?? ""}
                    onBlur={async (e) => { await atualizarFichaInsumo(ficha.ficha.id, "DIESEL_T2", { acumulado_registradora_final: e.target.value ? Number(e.target.value) : undefined }); refetchFicha(); }}
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>Horímetro Final do Comboio</label>
                <input type="number" step="0.1" className={inputCls} value={fechamento.km_horimetro_final} onChange={(e) => setFechamento((p) => ({ ...p, km_horimetro_final: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Régua Final T1 — CM</label>
                  <input type="number" className={inputCls} value={fechamento.regua_tanque1_final_cm} onChange={(e) => setFechamento((p) => ({ ...p, regua_tanque1_final_cm: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Régua Final T1 — LTS</label>
                  <input type="number" className={inputCls} value={fechamento.regua_tanque1_final_lts} onChange={(e) => setFechamento((p) => ({ ...p, regua_tanque1_final_lts: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Código de Impedimento (opcional)</label>
                <select className={inputCls} value={fechamento.codigo_impedimento_id} onChange={(e) => setFechamento((p) => ({ ...p, codigo_impedimento_id: e.target.value }))}>
                  <option value="">Nenhum</option>
                  {impedimentos.map((i) => <option key={i.id} value={i.id}>{i.codigo ? `${i.codigo} — ` : ""}{i.descricao}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Observações</label>
                <textarea className={cn(inputCls, "min-h-[80px] resize-none")} value={fechamento.observacoes_fechamento} onChange={(e) => setFechamento((p) => ({ ...p, observacoes_fechamento: e.target.value }))} />
              </div>
            </div>

            <ResumoCalculado ficha={ficha} materiais={materiais} temTanque2={temTanque2} />

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
              <div className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">
                Abastecimentos Realizados ({ficha.linhas.length})
              </div>
              <TabelaAbastecimentos linhas={ficha.linhas} materiais={materiais} temTanque2={temTanque2} />
            </div>

            <label className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl cursor-pointer">
              <input type="checkbox" checked={confirmouTodosAbastecimentos}
                onChange={(e) => setConfirmouTodosAbastecimentos(e.target.checked)} className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                Confirmo que todos os abastecimentos de todas as máquinas deste turno já foram lançados acima.
              </span>
            </label>

            {alertasFinalizacao && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-black text-xs uppercase tracking-wider">
                  <AlertTriangle size={14} /> Divergências encontradas
                </div>
                {alertasFinalizacao.map((a, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">{a}</div>)}
                <button onClick={handleFinalizar} disabled={salvando || !confirmouTodosAbastecimentos} className="mt-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 disabled:opacity-50">
                  Finalizar mesmo assim
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between pt-2 pb-8">
          <button onClick={voltarEtapa} disabled={etapa === 1 || salvando}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl disabled:opacity-40">
            <ChevronLeft size={16} /> Anterior
          </button>
          {etapa < 7 ? (
            <button onClick={avancar} disabled={salvando}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl disabled:opacity-50">
              Próximo <ChevronRight size={16} />
            </button>
          ) : (
            !alertasFinalizacao && (
              <button onClick={handleFinalizar} disabled={salvando || !confirmouTodosAbastecimentos}
                title={!confirmouTodosAbastecimentos ? "Confirme acima que todos os abastecimentos foram lançados" : undefined}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50">
                <CheckCircle2 size={16} /> Finalizar Ficha
              </button>
            )
          )}
        </div>
      </div>

      {confirmarFimAbastecimentos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="text-sm font-black text-zinc-900 dark:text-zinc-50">Ainda há mais abastecimentos a serem realizados?</div>
            <p className="text-xs text-zinc-500">
              Confira se todas as máquinas abastecidas neste turno já foram lançadas antes de seguir pra próxima etapa.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmarFimAbastecimentos(false)}
                className="px-4 py-2.5 text-sm font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                Sim, tenho mais
              </button>
              <button onClick={() => { setConfirmarFimAbastecimentos(false); setEtapa(6); }}
                className="px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl">
                Não, continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Etapa 4 — Conferência de Saldo ─────────────────────────────────────────

function ConferenciaSaldo({ ficha, materiais, temTanque2, onAjustado }: { ficha: FichaCompleta; materiais: Material[]; temTanque2: boolean; onAjustado: () => void }) {
  const [editando, setEditando] = useState<InsumoTipo | null>(null);
  const [valor, setValor] = useState("");
  const [erroAdmin, setErroAdmin] = useState<string | null>(null);

  const tipos = INSUMO_TIPOS.filter((t) => temTanque2 || t !== "DIESEL_T2");

  async function salvarAjuste(tipo: InsumoTipo) {
    const result = await atualizarFichaInsumo(ficha.ficha.id, tipo, { quantidade_inicial: Number(valor) });
    if (result.error) { setErroAdmin(result.error); return; }
    setEditando(null);
    onAjustado();
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3">
      <p className="text-xs text-zinc-500">Saldo herdado da última ficha finalizada deste comboio. Confira antes de continuar.</p>
      {erroAdmin && <div className="text-xs text-red-600">{erroAdmin}</div>}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {tipos.map((tipo) => {
          const insumo = ficha.insumos.find((i) => i.insumo_tipo === tipo);
          return (
            <div key={tipo} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-zinc-600 dark:text-zinc-300 font-semibold">{labelMaterialInsumo(tipo, materiais, temTanque2)}</span>
              {editando === tipo ? (
                <div className="flex items-center gap-2">
                  <input type="number" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} className="w-24 px-2 py-1 text-right border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-sm" />
                  <button onClick={() => salvarAjuste(tipo)} className="text-emerald-600 text-xs font-bold">Salvar</button>
                  <button onClick={() => setEditando(null)} className="text-zinc-400 text-xs">Cancelar</button>
                </div>
              ) : (
                <button onClick={() => { setEditando(tipo); setValor(String(insumo?.quantidade_inicial ?? 0)); setErroAdmin(null); }} className="font-bold text-zinc-900 dark:text-zinc-50 hover:underline">
                  {formatarNumero(Number(insumo?.quantidade_inicial || 0))}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-zinc-400">Clique no valor pra ajustar (só administrador — fica registrado no histórico).</p>
    </div>
  );
}

// ─── Etapa 5 — Abastecimentos ───────────────────────────────────────────────

function linhaVazia(fichaId: string): Partial<LinhaAbastecimento> {
  return { ficha_id: fichaId, tanque_diesel: 1, preventiva: false };
}

function numOuTraco(v: number | null | undefined) {
  return v ? formatarNumero(Number(v)) : "-";
}

// Motor e Hidráulico são pontos de consumo diferentes na máquina mas usam o mesmo material/NI
// (mesmo insumo_tipo HIDRAULICO_MOTOR) — por isso ganham um sufixo pra não ficar com dois
// campos com o nome idêntico no formulário.
const INSUMO_POR_CAMPO_LINHA: Record<string, InsumoTipo> = {
  motor: "HIDRAULICO_MOTOR", corrente: "CORRENTE", graxa: "GRAXA", transmissao: "TRANSMISSAO",
  fluido_radiador: "FLUIDO", hidraulico: "HIDRAULICO_MOTOR", diferencial: "DIFERENCIAL", arla: "ARLA",
};
const SUFIXO_CAMPO_LINHA: Record<string, string> = { motor: "Motor", hidraulico: "Hidráulico" };

function labelCampoLinha(campo: string, materiais: Material[]): string {
  const base = labelMaterialInsumo(INSUMO_POR_CAMPO_LINHA[campo], materiais);
  const sufixo = SUFIXO_CAMPO_LINHA[campo];
  return sufixo ? `${base} (${sufixo})` : base;
}

// Tabela em formato de grade, igual ao bloco "Consumo Detalhado por Equipamento" da ficha de
// papel — usada tanto na Etapa 5 (com editar/excluir) quanto no fechamento da Etapa 7 (só leitura).
function TabelaAbastecimentos({
  linhas, materiais, temTanque2, onEditar, onExcluir,
}: {
  linhas: LinhaAbastecimento[];
  materiais: Material[];
  temTanque2: boolean;
  onEditar?: (id: string) => void;
  onExcluir?: (id: string) => void;
}) {
  if (!linhas.length) {
    return (
      <div className="text-center text-xs text-zinc-400 py-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
        Nenhum abastecimento lançado ainda.
      </div>
    );
  }
  const temAcoes = !!(onEditar || onExcluir);
  return (
    <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
      <table className="w-full text-xs whitespace-nowrap">
        <thead>
          <tr className="text-zinc-400 uppercase text-[9px] font-black bg-zinc-50 dark:bg-zinc-900/60">
            <th className="text-left p-2">Hr. Ini</th>
            <th className="text-left p-2">Hr. Fim</th>
            <th className="text-left p-2">Equipamento</th>
            <th className="text-right p-2">Horím.</th>
            <th className="text-center p-2">Prev?</th>
            <th className="text-right p-2">{labelMaterialInsumo("DIESEL_T1", materiais)}{temTanque2 ? " (Tq)" : ""} (L)</th>
            <th className="text-right p-2">{labelCampoLinha("motor", materiais)}</th>
            <th className="text-right p-2">{labelCampoLinha("corrente", materiais)}</th>
            <th className="text-right p-2">{labelCampoLinha("graxa", materiais)}</th>
            <th className="text-right p-2">{labelCampoLinha("transmissao", materiais)}</th>
            <th className="text-right p-2">{labelCampoLinha("fluido_radiador", materiais)}</th>
            <th className="text-right p-2">{labelCampoLinha("hidraulico", materiais)}</th>
            <th className="text-right p-2">{labelCampoLinha("diferencial", materiais)}</th>
            <th className="text-right p-2">{labelCampoLinha("arla", materiais)}</th>
            <th className="text-left p-2">Matrícula</th>
            {temAcoes && <th className="text-right p-2">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {linhas.map((l) => (
            <tr key={l.id} className="text-zinc-700 dark:text-zinc-300">
              <td className="p-2">{l.hora_inicial || "-"}</td>
              <td className="p-2">{l.hora_final || "-"}</td>
              <td className="p-2 font-bold text-zinc-900 dark:text-zinc-50">{l.equipamento_texto || "-"}</td>
              <td className="p-2 text-right">{numOuTraco(l.horimetro)}</td>
              <td className="p-2 text-center">{l.preventiva ? "Sim" : "Não"}</td>
              <td className="p-2 text-right">{numOuTraco(l.diesel_litros)}{temTanque2 && Number(l.diesel_litros) > 0 ? ` (T${l.tanque_diesel || 1})` : ""}</td>
              <td className="p-2 text-right">{numOuTraco(l.motor)}</td>
              <td className="p-2 text-right">{numOuTraco(l.corrente)}</td>
              <td className="p-2 text-right">{numOuTraco(l.graxa)}</td>
              <td className="p-2 text-right">{numOuTraco(l.transmissao)}</td>
              <td className="p-2 text-right">{numOuTraco(l.fluido_radiador)}</td>
              <td className="p-2 text-right">{numOuTraco(l.hidraulico)}</td>
              <td className="p-2 text-right">{numOuTraco(l.diferencial)}</td>
              <td className="p-2 text-right">{numOuTraco(l.arla)}</td>
              <td className="p-2">{l.matricula_operador || "-"}</td>
              {temAcoes && (
                <td className="p-2">
                  <div className="flex items-center justify-end gap-1">
                    {onEditar && (
                      <button onClick={() => onEditar(l.id)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-amber-600">
                        <Pencil size={13} />
                      </button>
                    )}
                    {onExcluir && (
                      <button onClick={() => onExcluir(l.id)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AbastecimentosEtapa({
  ficha, materiais, temTanque2, onMudou,
}: { ficha: FichaCompleta; materiais: Material[]; temTanque2: boolean; onMudou: () => void }) {
  const [novaLinha, setNovaLinha] = useState<Partial<LinhaAbastecimento> | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erroLinha, setErroLinha] = useState<string | null>(null);
  const [maquinas, setMaquinas] = useState<MaquinaSuzano[]>([]);

  useEffect(() => {
    let ativo = true;
    getMaquinasPorModulo(ficha.ficha.modulo_id).then((m) => { if (ativo) setMaquinas(m); });
    return () => { ativo = false; };
  }, [ficha.ficha.modulo_id]);

  function adicionarMaquinaLocal(m: MaquinaSuzano) {
    setMaquinas((prev) => [...prev, m].sort((a, b) => a.codigo.localeCompare(b.codigo)));
  }

  async function salvar(linha: Partial<LinhaAbastecimento>, chaveLocal: string) {
    setSalvandoId(chaveLocal);
    setErroLinha(null);
    try {
      const result = await salvarLinhaAbastecimento(ficha.ficha.id, linha);
      if (result.error) { setErroLinha(result.error); return; }
      if (result.warning) setErroLinha(result.warning);
      setNovaLinha(null);
      setEditandoId(null);
      onMudou();
    } finally {
      setSalvandoId(null);
    }
  }

  async function excluir(linhaId: string) {
    if (!confirm("Excluir este abastecimento?")) return;
    setSalvandoId(linhaId);
    try {
      await excluirLinhaAbastecimento(linhaId, ficha.ficha.id);
      setEditandoId(null);
      onMudou();
    } finally {
      setSalvandoId(null);
    }
  }

  return (
    <div className="space-y-3">
      {!ficha.ficha.modulo_id && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
          Selecione o módulo na Etapa 3 pra ver a lista de máquinas do Cadastro Suzano.
        </div>
      )}
      {erroLinha && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
          {erroLinha}
        </div>
      )}

      {ficha.linhas.length > 0 && (
        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">
          {ficha.linhas.length} máquina{ficha.linhas.length > 1 ? "s" : ""} já abastecida{ficha.linhas.length > 1 ? "s" : ""}
        </div>
      )}

      <TabelaAbastecimentos
        linhas={ficha.linhas} materiais={materiais} temTanque2={temTanque2}
        onEditar={(id) => { setEditandoId(id); setNovaLinha(null); }}
        onExcluir={excluir}
      />

      {editandoId && (() => {
        const linhaEditando = ficha.linhas.find((l) => l.id === editandoId);
        if (!linhaEditando) return null;
        return (
          <LinhaCard linha={linhaEditando} maquinas={maquinas} moduloId={ficha.ficha.modulo_id} materiais={materiais} temTanque2={temTanque2}
            salvando={salvandoId === editandoId} onSalvar={(l) => salvar(l, editandoId)} onExcluir={() => excluir(editandoId)}
            onFechar={() => setEditandoId(null)} onMaquinaCriada={adicionarMaquinaLocal} />
        );
      })()}

      {novaLinha ? (
        <LinhaCard linha={novaLinha} maquinas={maquinas} moduloId={ficha.ficha.modulo_id} materiais={materiais} temTanque2={temTanque2}
          salvando={salvandoId === "nova"} onSalvar={(l) => salvar(l, "nova")} onExcluir={() => setNovaLinha(null)}
          onFechar={() => setNovaLinha(null)} novaLinhaLabel onMaquinaCriada={adicionarMaquinaLocal} />
      ) : (
        <button onClick={() => { setNovaLinha(linhaVazia(ficha.ficha.id)); setEditandoId(null); }}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 text-sm font-bold flex items-center justify-center gap-2 hover:border-amber-400 hover:text-amber-600">
          <Plus size={16} /> Adicionar Abastecimento
        </button>
      )}
    </div>
  );
}

function LinhaCard({
  linha, maquinas, moduloId, materiais, temTanque2, salvando, onSalvar, onExcluir, onFechar, novaLinhaLabel, onMaquinaCriada,
}: {
  linha: Partial<LinhaAbastecimento>;
  maquinas: MaquinaSuzano[];
  moduloId: string | null;
  materiais: Material[];
  temTanque2: boolean;
  salvando: boolean;
  onSalvar: (l: Partial<LinhaAbastecimento>) => void;
  onExcluir: () => void;
  onFechar: () => void;
  novaLinhaLabel?: boolean;
  onMaquinaCriada: (m: MaquinaSuzano) => void;
}) {
  const [draft, setDraft] = useState<Partial<LinhaAbastecimento>>(linha);
  const campo = (k: keyof LinhaAbastecimento, v: any) => setDraft((p) => ({ ...p, [k]: v }));

  const [modoNovaMaquina, setModoNovaMaquina] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState("");
  const [novaFoto, setNovaFoto] = useState<File | null>(null);
  const [enviandoMaquina, setEnviandoMaquina] = useState(false);
  const [erroMaquina, setErroMaquina] = useState<string | null>(null);

  async function salvarMaquinaNova() {
    if (!novoCodigo.trim()) { setErroMaquina("Informe o código/placa da máquina."); return; }
    if (!novaFoto) { setErroMaquina("Tire uma foto da placa/equipamento — é obrigatório pra confirmar o lançamento."); return; }
    setEnviandoMaquina(true);
    setErroMaquina(null);
    try {
      const supabase = createClient();
      const ext = novaFoto.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("insumos-fotos-maquinas").upload(fileName, novaFoto);
      if (uploadError) throw new Error("Erro ao enviar foto: " + uploadError.message);
      const { data: { publicUrl } } = supabase.storage.from("insumos-fotos-maquinas").getPublicUrl(fileName);
      const result = await criarMaquinaAdHoc(novoCodigo, moduloId, publicUrl);
      if (result.error || !result.maquina) { setErroMaquina(result.error || "Erro ao cadastrar a máquina."); return; }
      onMaquinaCriada(result.maquina);
      campo("equipamento_texto", result.maquina.codigo);
      setModoNovaMaquina(false);
      setNovoCodigo("");
      setNovaFoto(null);
    } catch (e: any) {
      setErroMaquina(e.message || "Erro ao cadastrar a máquina.");
    } finally {
      setEnviandoMaquina(false);
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-amber-600 uppercase tracking-wider">
          {novaLinhaLabel ? "Novo abastecimento" : "Editando abastecimento"}
        </div>
        <button onClick={onFechar} className="p-1 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Fechar sem excluir">
          <X size={15} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Hora Inicial</label>
          <input type="time" className={inputCls} value={draft.hora_inicial || ""} onChange={(e) => campo("hora_inicial", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Hora Final</label>
          <input type="time" className={inputCls} value={draft.hora_final || ""} onChange={(e) => campo("hora_final", e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Equipamento (Cadastro Suzano)</label>
        {!modoNovaMaquina ? (
          <select className={inputCls} value={draft.equipamento_texto || ""}
            onChange={(e) => {
              if (e.target.value === ADICIONAR_MAQUINA) { setModoNovaMaquina(true); return; }
              campo("equipamento_texto", e.target.value);
            }}>
            <option value="">Selecione...</option>
            {maquinas.map((m) => (
              <option key={m.id} value={m.codigo}>{m.codigo}{m.origem === "MOTORISTA" ? " (cadastrada em campo)" : ""}</option>
            ))}
            <option value={ADICIONAR_MAQUINA}>+ Adicionar máquina não listada...</option>
          </select>
        ) : (
          <div className="border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl p-3 space-y-2 bg-amber-50/50 dark:bg-amber-900/10">
            <input className={inputCls} placeholder="Código/placa da máquina" value={novoCodigo} onChange={(e) => setNovoCodigo(e.target.value)} />
            <label className="flex items-center justify-center gap-2 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 cursor-pointer bg-white dark:bg-zinc-900">
              <Camera size={15} /> {novaFoto ? novaFoto.name : "Tirar foto da placa/equipamento *"}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setNovaFoto(e.target.files?.[0] || null)} />
            </label>
            {erroMaquina && <div className="text-[11px] text-red-600">{erroMaquina}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setModoNovaMaquina(false); setErroMaquina(null); }} className="text-xs font-bold text-zinc-500">
                Cancelar
              </button>
              <button type="button" disabled={enviandoMaquina} onClick={salvarMaquinaNova}
                className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 rounded-lg disabled:opacity-50">
                {enviandoMaquina ? "Enviando..." : "Salvar Máquina"}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Horímetro</label>
          <input type="number" step="0.1" className={inputCls} value={draft.horimetro ?? ""} onChange={(e) => campo("horimetro", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <label className="flex items-center gap-2 mt-6 text-xs font-bold text-zinc-600 dark:text-zinc-300">
          <input type="checkbox" checked={!!draft.preventiva} onChange={(e) => campo("preventiva", e.target.checked)} className="w-4 h-4" />
          Preventiva?
        </label>
      </div>

      <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wider pt-1">{labelMaterialInsumo("DIESEL_T1", materiais)}</div>
      <div className={cn("grid gap-3", temTanque2 ? "grid-cols-3" : "grid-cols-2")}>
        <div>
          <label className={labelCls}>Registradora</label>
          <input type="number" step="0.1" className={inputCls} value={draft.diesel_registradora ?? ""} onChange={(e) => campo("diesel_registradora", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className={labelCls}>Litros</label>
          <input type="number" step="0.1" className={inputCls} value={draft.diesel_litros ?? ""} onChange={(e) => campo("diesel_litros", e.target.value ? Number(e.target.value) : null)} />
        </div>
        {temTanque2 && (
          <div>
            <label className={labelCls}>Tanque</label>
            <select className={inputCls} value={draft.tanque_diesel || 1} onChange={(e) => campo("tanque_diesel", Number(e.target.value) as 1 | 2)}>
              <option value={1}>1°</option>
              <option value={2}>2°</option>
            </select>
          </div>
        )}
      </div>

      <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wider pt-1">Lubrificantes</div>
      <div className="grid grid-cols-3 gap-2">
        {(["motor", "corrente", "graxa", "transmissao", "fluido_radiador", "hidraulico", "diferencial", "arla"] as (keyof LinhaAbastecimento)[]).map((campoNome) => (
          <div key={campoNome}>
            <label className="text-[9px] font-bold text-zinc-400 block mb-1">{labelCampoLinha(campoNome, materiais)}</label>
            <input type="number" step="0.1" className="w-full px-2 py-1.5 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900"
              value={(draft[campoNome] as number) ?? ""} onChange={(e) => campo(campoNome, e.target.value ? Number(e.target.value) : null)} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <label className={labelCls}>Matrícula do Operador</label>
          <input className={inputCls} value={draft.matricula_operador || ""} onChange={(e) => campo("matricula_operador", e.target.value)} />
        </div>
      </div>
      <SignaturePad value={draft.assinatura_operador_url || ""} onChange={(v) => campo("assinatura_operador_url", v)} label="Assinatura do Operador" />

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onExcluir} className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg flex items-center gap-1">
          <Trash2 size={13} /> {novaLinhaLabel ? "Cancelar" : "Excluir"}
        </button>
        <button disabled={salvando} onClick={() => onSalvar(draft)} className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// ─── Etapa 6 — Entradas no turno ────────────────────────────────────────────

function EntradasEtapa({
  ficha, comboio, modulos, materiais, colaboradores, temTanque2, onAjustado,
}: { ficha: FichaCompleta; comboio: Comboio; modulos: Modulo[]; materiais: Material[]; colaboradores: Colaborador[]; temTanque2: boolean; onAjustado: () => void }) {
  const tipos = INSUMO_TIPOS.filter((t) => temTanque2 || t !== "DIESEL_T2");
  const [mostrarRecarga, setMostrarRecarga] = useState(false);
  const [recargas, setRecargas] = useState<RecargaAplicada[]>([]);
  const [carregandoRecargas, setCarregandoRecargas] = useState(true);

  useEffect(() => {
    let ativo = true;
    getRecargasAplicadasNaFicha(ficha.ficha.id).then((r) => { if (ativo) { setRecargas(r); setCarregandoRecargas(false); } });
    return () => { ativo = false; };
  }, [ficha.ficha.id, ficha.insumos]);

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3">
        <p className="text-xs text-zinc-500">
          Quanto cada insumo recebeu de recarga neste turno — somado automaticamente a partir das fichas de recarga
          lançadas abaixo. Esse valor não é digitado direto: use "+ Registrar Recarga".
        </p>
        {tipos.map((tipo) => {
          const insumo = ficha.insumos.find((i) => i.insumo_tipo === tipo);
          return (
            <div key={tipo} className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">{labelMaterialInsumo(tipo, materiais, temTanque2)}</span>
              <span className="text-sm font-black text-emerald-600">{formatarNumero(Number(insumo?.entrou || 0))}</span>
            </div>
          );
        })}
      </div>

      <button onClick={() => setMostrarRecarga(true)}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/10">
        <Droplets size={16} /> + Registrar Recarga
      </button>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
        <div className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">
          Recargas Lançadas Neste Turno ({recargas.length})
        </div>
        {carregandoRecargas ? (
          <div className="text-center text-xs text-zinc-400 py-4">Carregando...</div>
        ) : recargas.length === 0 ? (
          <div className="text-center text-xs text-zinc-400 py-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            Nenhuma recarga lançada ainda nesta ficha.
          </div>
        ) : (
          <div className="space-y-2">
            {recargas.map((r) => (
              <div key={r.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-900 dark:text-zinc-50">Recarga Nº {r.numeroSequencial} — {r.origemLabel}</span>
                  <span className="text-zinc-400">{r.data.slice(8, 10)}/{r.data.slice(5, 7)} {r.hora || ""}</span>
                </div>
                <div className="text-zinc-500 dark:text-zinc-400 mt-1">
                  {r.itens.map((i) => `${i.material}: ${formatarNumero(i.quantidade)} ${i.unidade}`).join(" · ")}
                </div>
                {r.responsavelNome && <div className="text-[10px] text-zinc-400 mt-1">Responsável: {r.responsavelNome}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {mostrarRecarga && (
        <RecargaModal
          comboio={comboio} modulos={modulos} materiais={materiais} colaboradores={colaboradores}
          onClose={() => setMostrarRecarga(false)}
          onConcluida={onAjustado}
        />
      )}
    </div>
  );
}

// ─── Resumo calculado (Etapa 7) ─────────────────────────────────────────────

function ResumoCalculado({ ficha, materiais, temTanque2 }: { ficha: FichaCompleta; materiais: Material[]; temTanque2: boolean }) {
  const tipos = INSUMO_TIPOS.filter((t) => temTanque2 || t !== "DIESEL_T2");
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
      <div className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">Resumo Calculado</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-400 uppercase text-[10px] font-black">
              <th className="text-left pb-2">Insumo</th>
              <th className="text-right pb-2">Inicial</th>
              <th className="text-right pb-2">Entrou</th>
              <th className="text-right pb-2">Saiu</th>
              <th className="text-right pb-2">Restou</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {tipos.map((tipo) => {
              const i = ficha.insumos.find((x) => x.insumo_tipo === tipo);
              const negativo = Number(i?.restou || 0) < 0;
              return (
                <tr key={tipo}>
                  <td className="py-2 font-semibold text-zinc-600 dark:text-zinc-300">{labelMaterialInsumo(tipo, materiais, temTanque2)}</td>
                  <td className="py-2 text-right">{formatarNumero(Number(i?.quantidade_inicial || 0))}</td>
                  <td className="py-2 text-right text-emerald-600">{formatarNumero(Number(i?.entrou || 0))}</td>
                  <td className="py-2 text-right text-red-500">{formatarNumero(Number(i?.saiu || 0))}</td>
                  <td className={cn("py-2 text-right font-black", negativo ? "text-red-600" : "text-zinc-900 dark:text-zinc-50")}>
                    {formatarNumero(Number(i?.restou || 0))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
