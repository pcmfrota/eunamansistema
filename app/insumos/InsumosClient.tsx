"use client";

import { useEffect, useMemo, useState } from "react";
import { Fuel, Search, Truck, Clock, Droplets, LayoutGrid, ListChecks, Warehouse, BarChart3, Database, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Comboio, Modulo, Material, Impedimento, Colaborador, FichaCompleta, EstoqueAtualItem,
  abrirOuCriarFicha, getEstoqueAtualComboio,
} from "./actions";
import { labelMaterialInsumo, unidadeMaterialInsumo } from "./config";
import FichaAbastecimentoWizard from "./FichaAbastecimentoWizard";
import RecargaModal from "./RecargaModal";
import FichasLista from "./FichasLista";
import EstoqueAuditoria from "./EstoqueAuditoria";
import GraficosPainel from "./GraficosPainel";
import Cadastros from "./Cadastros";

function formatarPlaca(placa: string) {
  const m = placa.match(/^([A-Z]{3})(\d[A-Z0-9]{3})$/);
  return m ? `${m[1]} ${m[2]}` : placa;
}

export default function InsumosClient({
  initialComboios, modulos, materiais, impedimentos, colaboradores, equipamentos, error,
}: {
  initialComboios: Comboio[];
  modulos: Modulo[];
  materiais: Material[];
  impedimentos: Impedimento[];
  colaboradores: Colaborador[];
  equipamentos: { id: string; placa: string; tipo: string }[];
  error?: string;
}) {
  const [comboios] = useState<Comboio[]>(initialComboios);
  const [busca, setBusca] = useState("");
  const [fichaAtiva, setFichaAtiva] = useState<FichaCompleta | null>(null);
  const [carregandoId, setCarregandoId] = useState<string | null>(null);
  const [erroAbrir, setErroAbrir] = useState<string | null>(null);
  const [comboioRecarga, setComboioRecarga] = useState<Comboio | null>(null);
  const [comboioMenu, setComboioMenu] = useState<Comboio | null>(null);
  const [comboioEstoque, setComboioEstoque] = useState<Comboio | null>(null);
  const [abaPrincipal, setAbaPrincipal] = useState<"LANCAR" | "FICHAS" | "ESTOQUE" | "PAINEL" | "CADASTROS">("LANCAR");

  const comboiosFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return comboios;
    return comboios.filter((c) => c.placa.toLowerCase().includes(termo) || c.modelo?.toLowerCase().includes(termo));
  }, [comboios, busca]);

  async function abrirComboio(comboio: Comboio) {
    setCarregandoId(comboio.id);
    setErroAbrir(null);
    try {
      const result = await abrirOuCriarFicha(comboio.id);
      if (result.error || !result.ficha) {
        setErroAbrir(result.error || "Não foi possível abrir a ficha.");
        return;
      }
      setFichaAtiva(result.ficha);
    } finally {
      setCarregandoId(null);
    }
  }

  if (fichaAtiva) {
    return (
      <FichaAbastecimentoWizard
        fichaInicial={fichaAtiva}
        comboio={comboios.find((c) => c.id === fichaAtiva.ficha.equipamento_id)!}
        modulos={modulos}
        materiais={materiais}
        impedimentos={impedimentos}
        colaboradores={colaboradores}
        equipamentos={equipamentos}
        onVoltar={() => setFichaAtiva(null)}
        onAtualizarFicha={(f) => setFichaAtiva(f)}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4 md:p-6 space-y-5">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl shrink-0">
          <Fuel size={26} className="text-amber-500 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50">Controle de Insumos</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {abaPrincipal === "LANCAR" ? "Selecione o comboio pra abrir ou continuar a Ficha de Abastecimento." : "Fichas de Abastecimento e Recarga já lançadas."}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setAbaPrincipal("LANCAR")}
          className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider", abaPrincipal === "LANCAR" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500")}>
          <LayoutGrid size={13} /> Novo Lançamento
        </button>
        <button onClick={() => setAbaPrincipal("FICHAS")}
          className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider", abaPrincipal === "FICHAS" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500")}>
          <ListChecks size={13} /> Fichas Lançadas
        </button>
        <button onClick={() => setAbaPrincipal("ESTOQUE")}
          className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider", abaPrincipal === "ESTOQUE" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500")}>
          <Warehouse size={13} /> Estoque & Auditoria
        </button>
        <button onClick={() => setAbaPrincipal("PAINEL")}
          className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider", abaPrincipal === "PAINEL" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500")}>
          <BarChart3 size={13} /> Painel
        </button>
        <button onClick={() => setAbaPrincipal("CADASTROS")}
          className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider", abaPrincipal === "CADASTROS" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500")}>
          <Database size={13} /> Cadastros
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-sm text-red-700 dark:text-red-400">
          Erro ao carregar comboios: {error}
        </div>
      )}

      {abaPrincipal === "FICHAS" ? (
        <FichasLista comboios={comboios} modulos={modulos} materiais={materiais} impedimentos={impedimentos} />
      ) : abaPrincipal === "ESTOQUE" ? (
        <EstoqueAuditoria comboios={comboios} materiais={materiais} />
      ) : abaPrincipal === "PAINEL" ? (
        <GraficosPainel materiais={materiais} />
      ) : abaPrincipal === "CADASTROS" ? (
        <Cadastros />
      ) : (
      <>
      {erroAbrir && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-sm text-red-700 dark:text-red-400">
          {erroAbrir}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por placa..."
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 outline-none focus:border-amber-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {comboiosFiltrados.map((comboio) => (
          <div
            key={comboio.id}
            className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-600 rounded-2xl p-5 shadow-sm transition-colors"
          >
            <button onClick={() => setComboioMenu(comboio)} disabled={carregandoId !== null} className="text-left w-full disabled:opacity-60">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  <Truck size={20} className="text-zinc-500 dark:text-zinc-400" />
                </div>
                {comboio.temRascunho ? (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider">
                    <Clock size={11} /> Em andamento
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                    Disponível
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-zinc-900 dark:text-zinc-50 font-mono tracking-wide">
                {formatarPlaca(comboio.placa)}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{comboio.modelo || "—"}</div>
              {comboio.modulo && (
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 uppercase font-bold tracking-wider">{comboio.modulo}</div>
              )}
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-baseline justify-between">
                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Diesel atual</span>
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                  {comboio.saldoDieselAtual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L
                </span>
              </div>
              {comboio.temRascunho && comboio.rascunhoLubrificador && (
                <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold truncate">
                  Iniciada por {comboio.rascunhoLubrificador}
                </div>
              )}
            </button>
          </div>
        ))}
      </div>

      {comboiosFiltrados.length === 0 && (
        <div className="text-center py-16 text-sm text-zinc-400">Nenhum comboio encontrado.</div>
      )}

      {comboioRecarga && (
        <RecargaModal
          comboio={comboioRecarga}
          modulos={modulos}
          materiais={materiais}
          colaboradores={colaboradores}
          onClose={() => setComboioRecarga(null)}
        />
      )}

      {comboioMenu && (
        <ComboioMenuModal
          comboio={comboioMenu}
          carregando={carregandoId === comboioMenu.id}
          onClose={() => setComboioMenu(null)}
          onLancamentos={() => { const c = comboioMenu; setComboioMenu(null); abrirComboio(c); }}
          onRecarga={() => { const c = comboioMenu; setComboioMenu(null); setComboioRecarga(c); }}
          onEstoque={() => { const c = comboioMenu; setComboioMenu(null); setComboioEstoque(c); }}
        />
      )}

      {comboioEstoque && (
        <EstoqueAtualModal
          comboio={comboioEstoque}
          materiais={materiais}
          onClose={() => setComboioEstoque(null)}
        />
      )}
      </>
      )}
    </div>
  );
}

function ComboioMenuModal({
  comboio, carregando, onClose, onLancamentos, onRecarga, onEstoque,
}: {
  comboio: Comboio;
  carregando: boolean;
  onClose: () => void;
  onLancamentos: () => void;
  onRecarga: () => void;
  onEstoque: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
              <Truck size={18} className="text-zinc-500 dark:text-zinc-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-50 font-mono">{formatarPlaca(comboio.placa)}</h2>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider truncate max-w-[200px]">{comboio.modelo || "—"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 space-y-2">
          <button
            onClick={onLancamentos}
            disabled={carregando}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-amber-50 dark:hover:bg-amber-900/10 hover:border-amber-300 dark:hover:border-amber-800 transition-colors disabled:opacity-60 text-left"
          >
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg shrink-0">
              <ListChecks size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">
                {carregando ? "Abrindo..." : "Lançamentos"}
              </div>
              <div className="text-[11px] text-zinc-400">Ficha de Abastecimento</div>
            </div>
          </button>
          <button
            onClick={onRecarga}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors text-left"
          >
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg shrink-0">
              <Droplets size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <div className="text-xs font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">Recarga de Insumos</div>
              <div className="text-[11px] text-zinc-400">Registrar recarga do comboio</div>
            </div>
          </button>
          <button
            onClick={onEstoque}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors text-left"
          >
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg shrink-0">
              <Warehouse size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">Ver Estoque Atual</div>
              <div className="text-[11px] text-zinc-400">Saldo de cada insumo agora</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function EstoqueAtualModal({ comboio, materiais, onClose }: { comboio: Comboio; materiais: Material[]; onClose: () => void }) {
  const [itens, setItens] = useState<EstoqueAtualItem[] | null>(null);

  useEffect(() => {
    let ativo = true;
    getEstoqueAtualComboio(comboio.id).then((r) => { if (ativo) setItens(r); });
    return () => { ativo = false; };
  }, [comboio.id]);

  const temTanque2 = comboio.numero_tanques_diesel >= 2;
  const itensVisiveis = (itens || []).filter((i) => i.insumo_tipo !== "DIESEL_T2" || temTanque2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
              <Warehouse size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-50">Estoque Atual</h2>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{comboio.placa}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">
          {!itens ? (
            <div className="text-center text-xs text-zinc-400 py-8">Carregando...</div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {itensVisiveis.map((i) => (
                <div key={i.insumo_tipo} className="flex items-center justify-between py-2.5">
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                    {labelMaterialInsumo(i.insumo_tipo, materiais, temTanque2)}
                  </span>
                  <span className="text-sm font-black text-zinc-900 dark:text-zinc-50">
                    {i.saldoAtual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} {unidadeMaterialInsumo(i.insumo_tipo, materiais)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
