"use client";

import { useMemo, useState } from "react";
import {
  BadgeDollarSign, Plus, Search, Printer, FileUp, Trash2, Edit2, Eye, Loader2, FileText,
  Wallet, Clock, CheckCircle2, ArrowUp, ArrowDown, LayoutGrid, ListTree, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import { MultiSelect } from "@/components/MultiSelect";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, LabelList,
} from "recharts";
import { CustoManutencao, StatusCusto, deleteCusto, bulkDeleteCustos } from "./actions";
import CustoModal from "./CustoModal";
import ImportExportModal from "./ImportExportModal";
import { gerarPDFCustos, imprimirRelatorioCustos } from "./CustosPDF";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const STATUS_LABEL: Record<StatusCusto, string> = { PAGO: "Pago", AG_PAGAMENTO: "Ag. Pagamento", FATURADO: "Faturado" };
const STATUS_BADGE: Record<StatusCusto, string> = {
  PAGO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  AG_PAGAMENTO: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  FATURADO: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
};
const STATUS_CHIP: Record<StatusCusto, string> = {
  PAGO: "bg-emerald-600 text-white",
  AG_PAGAMENTO: "bg-red-600 text-white",
  FATURADO: "bg-blue-600 text-white",
};
const CHART_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#8b5cf6", "#0891b2", "#dc2626", "#64748b", "#db2777"];

function StatusBadge({ status }: { status: StatusCusto }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", STATUS_BADGE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function formatarMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarDataCusto(iso: string | null | undefined) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export default function CustosClient({
  isVisitante,
  initialCustos,
  equipamentos,
}: {
  isVisitante: boolean;
  initialCustos: CustoManutencao[];
  equipamentos: any[];
}) {
  const { isOnline } = useOffline();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlaca, setFilterPlaca] = useState("");
  const [filterMes, setFilterMes] = useState("");
  const [filterAno, setFilterAno] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterFornecedor, setFilterFornecedor] = useState("");
  const [filterDataIni, setFilterDataIni] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<CustoManutencao | null>(null);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [viewTab, setViewTab] = useState<"geral" | "detalhamento">("geral");

  const placasUnicas = useMemo(
    () => Array.from(new Set(initialCustos.map((c) => c.placa))).filter(Boolean).sort(),
    [initialCustos]
  );
  const anosUnicos = useMemo(
    () => Array.from(new Set(initialCustos.map((c) => c.data?.slice(0, 4)))).filter(Boolean).sort().reverse(),
    [initialCustos]
  );

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return initialCustos.filter((c) => {
      if (
        term &&
        !(
          c.placa?.toLowerCase().includes(term) ||
          c.fornecedor?.toLowerCase().includes(term) ||
          c.observacoes?.toLowerCase().includes(term) ||
          c.descricao?.toLowerCase().includes(term)
        )
      )
        return false;
      if (filterPlaca && c.placa !== filterPlaca) return false;
      if (filterTipo && c.tipo_manutencao !== filterTipo) return false;
      if (filterFornecedor && (c.fornecedor || "Sem fornecedor") !== filterFornecedor) return false;
      if (filterStatus.length && !filterStatus.includes(c.status)) return false;
      if (filterMes || filterAno) {
        const [y, m] = (c.data || "").split("-");
        if (filterAno && y !== filterAno) return false;
        if (filterMes && m !== filterMes) return false;
      }
      if (filterDataIni && c.data < filterDataIni) return false;
      if (filterDataFim && c.data > filterDataFim) return false;
      return true;
    });
  }, [initialCustos, searchTerm, filterPlaca, filterTipo, filterFornecedor, filterStatus, filterMes, filterAno, filterDataIni, filterDataFim]);

  // Filtros disparados por clique nos gráficos — clicar de novo no mesmo valor limpa o filtro
  // (efeito toggle), dando aos gráficos uma função de "abrir o detalhe" além de só mostrar.
  function toggleFiltroPlaca(placa: string) {
    setFilterPlaca((atual) => (atual === placa ? "" : placa));
  }
  function toggleFiltroTipo(tipo: string) {
    setFilterTipo((atual) => (atual === tipo ? "" : tipo));
  }
  function toggleFiltroFornecedor(fornecedor: string) {
    setFilterFornecedor((atual) => (atual === fornecedor ? "" : fornecedor));
  }
  function toggleFiltroMesAno(mes: string, ano: string) {
    const jaAtivo = filterMes === mes && filterAno === ano;
    setFilterMes(jaAtivo ? "" : mes);
    setFilterAno(jaAtivo ? "" : ano);
  }
  function limparFiltrosGraficos() {
    setFilterPlaca("");
    setFilterTipo("");
    setFilterFornecedor("");
    setFilterMes("");
    setFilterAno("");
  }
  const temFiltroDeGrafico = !!(filterPlaca || filterTipo || filterFornecedor || filterMes || filterAno);

  const kpis = useMemo(() => {
    let totalGeral = 0, totalPago = 0, totalAgPagamento = 0, totalFaturado = 0;
    const placas = new Set<string>();
    filteredData.forEach((c) => {
      const total = Number(c.pecas) + Number(c.mao_obra);
      totalGeral += total;
      placas.add(c.placa);
      if (c.status === "PAGO") totalPago += total;
      else if (c.status === "AG_PAGAMENTO") totalAgPagamento += total;
      else if (c.status === "FATURADO") totalFaturado += total;
    });
    return {
      totalGeral,
      totalPago,
      totalAgPagamento,
      totalFaturado,
      custoMedioPorPlaca: placas.size ? totalGeral / placas.size : 0,
    };
  }, [filteredData]);

  const evolucaoMensal = useMemo(() => {
    const porMes = new Map<string, { mes: string; ano: string; mesNum: string; pecas: number; maoObra: number }>();
    filteredData.forEach((c) => {
      const chave = c.data?.slice(0, 7);
      if (!chave) return;
      if (!porMes.has(chave)) {
        const [y, m] = chave.split("-");
        porMes.set(chave, { mes: `${MESES[Number(m) - 1]?.slice(0, 3) || m}/${y.slice(2)}`, ano: y, mesNum: m, pecas: 0, maoObra: 0 });
      }
      const item = porMes.get(chave)!;
      item.pecas += Number(c.pecas);
      item.maoObra += Number(c.mao_obra);
    });
    return Array.from(porMes.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredData]);

  const distribuicaoTipo = useMemo(() => {
    const porTipo = new Map<string, number>();
    filteredData.forEach((c) => {
      const total = Number(c.pecas) + Number(c.mao_obra);
      porTipo.set(c.tipo_manutencao, (porTipo.get(c.tipo_manutencao) || 0) + total);
    });
    return Array.from(porTipo.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const topVeiculos = useMemo(() => {
    const porPlaca = new Map<string, number>();
    filteredData.forEach((c) => {
      const total = Number(c.pecas) + Number(c.mao_obra);
      porPlaca.set(c.placa, (porPlaca.get(c.placa) || 0) + total);
    });
    return Array.from(porPlaca.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filteredData]);

  const custosPorFornecedor = useMemo(() => {
    const porFornecedor = new Map<string, number>();
    filteredData.forEach((c) => {
      const nome = c.fornecedor || "Sem fornecedor";
      const total = Number(c.pecas) + Number(c.mao_obra);
      porFornecedor.set(nome, (porFornecedor.get(nome) || 0) + total);
    });
    return Array.from(porFornecedor.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredData]);

  // Série única de evolução mensal (só o total, sem separar peças/mão de obra) — usada no
  // gráfico de linha do Detalhamento Financeiro, e também pra calcular a variação vs. o mês
  // anterior mostrada como tendência no card "Total Gasto".
  const evolucaoMensalTotal = useMemo(() => {
    const porMes = new Map<string, number>();
    filteredData.forEach((c) => {
      const chave = c.data?.slice(0, 7);
      if (!chave) return;
      const total = Number(c.pecas) + Number(c.mao_obra);
      porMes.set(chave, (porMes.get(chave) || 0) + total);
    });
    return Array.from(porMes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, total]) => {
        const [y, m] = chave.split("-");
        return { mes: `${MESES[Number(m) - 1]?.slice(0, 3) || m}/${y.slice(2)}`, total };
      });
  }, [filteredData]);

  const tendenciaGasto = useMemo(() => {
    if (evolucaoMensalTotal.length < 2) return null;
    const atual = evolucaoMensalTotal[evolucaoMensalTotal.length - 1].total;
    const anterior = evolucaoMensalTotal[evolucaoMensalTotal.length - 2].total;
    if (!anterior) return null;
    return { variacao: ((atual - anterior) / anterior) * 100, subiu: atual >= anterior };
  }, [evolucaoMensalTotal]);

  // Custos por Placa e Fornecedor — barra empilhada (uma cor por fornecedor). Os 6 fornecedores
  // com maior custo total viram cores próprias; o resto entra agrupado em "Outros" pra não virar
  // uma legenda infinita quando há muitas oficinas diferentes cadastradas.
  const custosPorPlacaEFornecedor = useMemo(() => {
    const totalPorFornecedor = new Map<string, number>();
    filteredData.forEach((c) => {
      const nome = c.fornecedor || "Sem fornecedor";
      totalPorFornecedor.set(nome, (totalPorFornecedor.get(nome) || 0) + Number(c.pecas) + Number(c.mao_obra));
    });
    const ordenados = Array.from(totalPorFornecedor.entries()).sort((a, b) => b[1] - a[1]);
    const principais = new Set(ordenados.slice(0, 6).map(([nome]) => nome));
    const temOutros = ordenados.length > principais.size;
    const agrupar = (nome: string) => (principais.has(nome) ? nome : "Outros");

    const porPlaca = new Map<string, Record<string, number>>();
    filteredData.forEach((c) => {
      const total = Number(c.pecas) + Number(c.mao_obra);
      const fornecedor = agrupar(c.fornecedor || "Sem fornecedor");
      if (!porPlaca.has(c.placa)) porPlaca.set(c.placa, {});
      const registro = porPlaca.get(c.placa)!;
      registro[fornecedor] = (registro[fornecedor] || 0) + total;
    });

    const linhas = Array.from(porPlaca.entries())
      .map(([placa, valores]) => ({ placa, ...valores, __total: Object.values(valores).reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.__total - a.__total)
      .slice(0, 10);

    const fornecedores = Array.from(principais).concat(temOutros ? ["Outros"] : []);
    return { linhas, fornecedores };
  }, [filteredData]);

  const somaRodape = useMemo(() => {
    let pecas = 0, maoObra = 0;
    filteredData.forEach((c) => { pecas += Number(c.pecas); maoObra += Number(c.mao_obra); });
    return { pecas, maoObra, total: pecas + maoObra };
  }, [filteredData]);

  function openModal(data: CustoManutencao | null = null) {
    setEditingData(data);
    setModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (isVisitante) return;
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
    try {
      if (isOnline) {
        const result = await deleteCusto(id);
        if (result?.error) throw new Error(result.error);
      } else {
        await localDb.addToQueue("custos_manutencao", "delete", { id });
      }
      await localDb.delete("custos_manutencao", id);
      window.dispatchEvent(new CustomEvent("offline-db-updated-custos_manutencao"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    } catch (err: any) {
      alert("Erro ao excluir: " + (err.message || String(err)));
    }
  }

  async function handleBulkDelete() {
    if (isVisitante || selectedIds.length === 0) return;
    if (!confirm(`Excluir ${selectedIds.length} lançamento(s) selecionado(s)?`)) return;
    try {
      if (isOnline) {
        const result = await bulkDeleteCustos(selectedIds);
        if (result?.error) throw new Error(result.error);
      } else {
        for (const id of selectedIds) await localDb.addToQueue("custos_manutencao", "delete", { id });
      }
      for (const id of selectedIds) await localDb.delete("custos_manutencao", id);
      setSelectedIds([]);
      window.dispatchEvent(new CustomEvent("offline-db-updated-custos_manutencao"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    } catch (err: any) {
      alert("Erro ao excluir lançamentos: " + (err.message || String(err)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (selectedIds.length === filteredData.length) setSelectedIds([]);
    else setSelectedIds(filteredData.map((c) => c.id));
  }

  async function handleGerarPDF() {
    setIsPrinting(true);
    try {
      await gerarPDFCustos(filteredData, kpis, "download");
    } catch (err: any) {
      alert("Erro ao gerar PDF: " + (err.message || String(err)));
    } finally {
      setIsPrinting(false);
    }
  }

  const cellBorder = "border border-zinc-200 dark:border-zinc-800";
  const colCount = isVisitante ? 10 : 12;

  return (
    <div className="p-3 md:p-6 flex flex-col gap-4 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-950 p-4 md:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/30">
            <BadgeDollarSign size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              CONTROLE FINANCEIRO — MANUTENÇÃO
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Gestão de custos, faturamento e status de pagamento da frota</p>
          </div>
        </div>

        {!isVisitante ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setImportExportOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <FileUp size={16} /> Importar / Exportar
            </button>
            <button
              onClick={handleGerarPDF}
              disabled={isPrinting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              Gerar PDF
            </button>
            <button
              onClick={() => imprimirRelatorioCustos(filteredData, kpis)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Printer size={16} /> Imprimir
            </button>
            <button
              onClick={() => openModal(null)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm active:scale-95"
            >
              <Plus size={18} /> Adicionar Lançamento
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl text-sm border border-zinc-200 dark:border-zinc-700">
            Somente Leitura
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <div className="lg:col-span-2 xl:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar placa, fornecedor, PC..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-emerald-500"
          />
        </div>
        <select value={filterPlaca} onChange={(e) => setFilterPlaca(e.target.value)} className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none">
          <option value="">Todas as Placas</option>
          {placasUnicas.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterMes} onChange={(e) => setFilterMes(e.target.value)} className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none">
          <option value="">Todos os Meses</option>
          {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
        </select>
        <select value={filterAno} onChange={(e) => setFilterAno(e.target.value)} className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none">
          <option value="">Todos os Anos</option>
          {anosUnicos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none">
          <option value="">Todos os Tipos</option>
          <option value="CORRETIVA">Corretiva</option>
          <option value="PREVENTIVA">Preventiva</option>
          <option value="PREDITIVA">Preditiva</option>
        </select>
        <div className="flex items-center gap-1.5 lg:col-span-2 xl:col-span-1">
          <input type="date" value={filterDataIni} onChange={(e) => setFilterDataIni(e.target.value)} className="w-full px-2 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none" />
          <span className="text-zinc-400 text-xs">–</span>
          <input type="date" value={filterDataFim} onChange={(e) => setFilterDataFim(e.target.value)} className="w-full px-2 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none" />
        </div>
        <MultiSelect
          className="lg:col-span-2 xl:col-span-2"
          placeholder="Todos os Status"
          values={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: "PAGO", label: "Pago", colorClass: STATUS_CHIP.PAGO },
            { value: "AG_PAGAMENTO", label: "Ag. Pagamento", colorClass: STATUS_CHIP.AG_PAGAMENTO },
            { value: "FATURADO", label: "Faturado", colorClass: STATUS_CHIP.FATURADO },
          ]}
        />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-xl w-fit">
          <button
            onClick={() => setViewTab("geral")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors",
              viewTab === "geral" ? "bg-white dark:bg-zinc-800 text-emerald-600 shadow-sm" : "text-zinc-500"
            )}
          >
            <LayoutGrid size={14} /> Visão Geral
          </button>
          <button
            onClick={() => setViewTab("detalhamento")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors",
              viewTab === "detalhamento" ? "bg-white dark:bg-zinc-800 text-emerald-600 shadow-sm" : "text-zinc-500"
            )}
          >
            <ListTree size={14} /> Detalhamento Financeiro
          </button>
        </div>

        {temFiltroDeGrafico && (
          <button
            onClick={limparFiltrosGraficos}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
          >
            Filtro do gráfico ativo
            {filterPlaca && <span className="font-mono">· {filterPlaca}</span>}
            {filterTipo && <span>· {filterTipo}</span>}
            {filterFornecedor && <span>· {filterFornecedor}</span>}
            {(filterMes || filterAno) && <span>· {MESES[Number(filterMes) - 1]?.slice(0, 3) || filterMes}/{filterAno?.slice(2)}</span>}
            <X size={12} />
          </button>
        )}
      </div>

      {viewTab === "geral" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Total Geral no Período", valor: kpis.totalGeral, cor: "bg-zinc-600" },
              { label: "Total Pago", valor: kpis.totalPago, cor: "bg-emerald-600" },
              { label: "Aguardando Pagamento", valor: kpis.totalAgPagamento, cor: "bg-red-600" },
              { label: "Total Faturado", valor: kpis.totalFaturado, cor: "bg-blue-600" },
              { label: "Custo Médio por Placa", valor: kpis.custoMedioPorPlaca, cor: "bg-purple-600" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex items-stretch gap-3 shadow-sm">
                <div className={cn("w-1.5 rounded-full shrink-0", kpi.cor)} />
                <div className="flex flex-col justify-between py-0.5">
                  <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-2xl font-black text-zinc-800 dark:text-zinc-100 tracking-tight mt-1">{formatarMoeda(kpi.valor)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Evolução Mensal — Peças vs Mão de Obra</h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolucaoMensal} margin={{ left: -10, right: 10, top: 5, bottom: 5 }} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="pecas" name="Peças" stackId="a" radius={[0, 0, 0, 0]} maxBarSize={70}
                      cursor="pointer" onClick={(d: any) => toggleFiltroMesAno(d.mesNum, d.ano)}
                    >
                      {evolucaoMensal.map((entry, i) => (
                        <Cell key={i} fill="#2563eb" opacity={filterMes && (filterMes !== entry.mesNum || filterAno !== entry.ano) ? 0.3 : 1} />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="maoObra" name="Mão de Obra" stackId="a" radius={[4, 4, 0, 0]} maxBarSize={70}
                      cursor="pointer" onClick={(d: any) => toggleFiltroMesAno(d.mesNum, d.ano)}
                    >
                      {evolucaoMensal.map((entry, i) => (
                        <Cell key={i} fill="#f59e0b" opacity={filterMes && (filterMes !== entry.mesNum || filterAno !== entry.ano) ? 0.3 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Distribuição por Tipo de Manutenção</h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribuicaoTipo}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      cursor="pointer"
                      onClick={(d: any) => toggleFiltroTipo(d.name)}
                    >
                      {distribuicaoTipo.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          opacity={filterTipo && filterTipo !== entry.name ? 0.35 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Top 10 Veículos por Custo</h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topVeiculos} layout="vertical" margin={{ left: 0, right: 65, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                    <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.2]} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} cursor="pointer" onClick={(d: any) => toggleFiltroPlaca(d.name)}>
                      <LabelList dataKey="value" position="right" formatter={(v: number) => formatarMoeda(v)} style={{ fontSize: 10, fill: "#52525b" }} />
                      {topVeiculos.map((entry, i) => (
                        <Cell key={i} fill="#2563eb" opacity={filterPlaca && filterPlaca !== entry.name ? 0.3 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Custos por Fornecedor</h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={custosPorFornecedor} layout="vertical" margin={{ left: 0, right: 65, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                    <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.2]} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} cursor={{ fill: "rgba(22,163,74,0.06)" }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} cursor="pointer" onClick={(d: any) => toggleFiltroFornecedor(d.name)}>
                      <LabelList dataKey="value" position="right" formatter={(v: number) => formatarMoeda(v)} style={{ fontSize: 10, fill: "#52525b" }} />
                      {custosPorFornecedor.map((entry, i) => (
                        <Cell key={i} fill="#16a34a" opacity={filterFornecedor && filterFornecedor !== entry.name ? 0.3 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Gasto", valor: kpis.totalGeral, icon: Wallet, cor: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400", tendencia: tendenciaGasto },
              { label: "Aguardando Pagamento", valor: kpis.totalAgPagamento, icon: Clock, cor: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" },
              { label: "Total Pago", valor: kpis.totalPago, icon: CheckCircle2, cor: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
              { label: "Faturado", valor: kpis.totalFaturado, icon: FileText, cor: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                <div className={cn("p-2.5 rounded-xl shrink-0", kpi.cor)}>
                  <kpi.icon size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{kpi.label}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-lg font-black text-zinc-800 dark:text-zinc-100 tracking-tight">{formatarMoeda(kpi.valor)}</p>
                    {kpi.tendencia && (
                      <span className={cn("flex items-center gap-0.5 text-[10px] font-bold", kpi.tendencia.subiu ? "text-red-500" : "text-emerald-500")}>
                        {kpi.tendencia.subiu ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                        {Math.abs(kpi.tendencia.variacao).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Evolução de Custos Mensais</h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucaoMensalTotal} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                    <Line type="monotone" dataKey="total" name="Custo Total" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Custos por Placa e Fornecedor</h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={custosPorPlacaEFornecedor.linhas} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="placa" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {custosPorPlacaEFornecedor.fornecedores.map((f, i) => (
                      <Bar key={f} dataKey={f} name={f} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === custosPorPlacaEFornecedor.fornecedores.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="text-[11px] uppercase">
              <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                {!isVisitante && (
                  <th className={cn(cellBorder, "px-2 py-2 text-center w-8")}>
                    <input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === filteredData.length} onChange={toggleSelectAll} />
                  </th>
                )}
                <th className={cn(cellBorder, "px-3 py-2")}>Data</th>
                <th className={cn(cellBorder, "px-3 py-2")}>Placa</th>
                <th className={cn(cellBorder, "px-3 py-2")}>Tipo</th>
                <th className={cn(cellBorder, "px-3 py-2")}>Descrição</th>
                <th className={cn(cellBorder, "px-3 py-2")}>Fornecedor</th>
                <th className={cn(cellBorder, "px-3 py-2 text-right")}>Peças (R$)</th>
                <th className={cn(cellBorder, "px-3 py-2 text-right")}>Mão de Obra (R$)</th>
                <th className={cn(cellBorder, "px-3 py-2 text-right")}>Total (R$)</th>
                <th className={cn(cellBorder, "px-3 py-2 text-center")}>Status</th>
                <th className={cn(cellBorder, "px-3 py-2")}>Observações / PC</th>
                {!isVisitante && <th className={cn(cellBorder, "px-3 py-2 text-right")}>Ações</th>}
              </tr>
            </thead>
            <tbody className="text-zinc-700 dark:text-zinc-300 text-xs">
              {filteredData.map((c, idx) => {
                const total = Number(c.pecas) + Number(c.mao_obra);
                const destacar = c.status === "AG_PAGAMENTO";
                return (
                  <tr key={c.id} className={cn(destacar ? "bg-red-50/60 dark:bg-red-950/10" : idx % 2 === 1 ? "bg-zinc-50/70 dark:bg-zinc-900/40" : "")}>
                    {!isVisitante && (
                      <td className={cn(cellBorder, "px-2 py-2 text-center")}>
                        <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} />
                      </td>
                    )}
                    <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>{formatarDataCusto(c.data)}</td>
                    <td className={cn(cellBorder, "px-3 py-2 font-mono font-bold whitespace-nowrap")}>{c.placa}</td>
                    <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>{c.tipo_manutencao}</td>
                    <td className={cn(cellBorder, "px-3 py-2")}>{c.descricao}</td>
                    <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>{c.fornecedor || "-"}</td>
                    <td className={cn(cellBorder, "px-3 py-2 text-right whitespace-nowrap")}>{formatarMoeda(Number(c.pecas))}</td>
                    <td className={cn(cellBorder, "px-3 py-2 text-right whitespace-nowrap")}>{formatarMoeda(Number(c.mao_obra))}</td>
                    <td className={cn(cellBorder, "px-3 py-2 text-right font-bold whitespace-nowrap")}>{formatarMoeda(total)}</td>
                    <td className={cn(cellBorder, "px-3 py-2 text-center")}><StatusBadge status={c.status} /></td>
                    <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>{c.observacoes || "-"}</td>
                    {!isVisitante && (
                      <td className={cn(cellBorder, "px-3 py-2 text-right whitespace-nowrap")}>
                        {c.anexo_url && (
                          <a href={c.anexo_url} target="_blank" rel="noreferrer" className="p-1 text-zinc-400 hover:text-blue-500 inline-block"><Eye size={13} /></a>
                        )}
                        <button onClick={() => openModal(c)} className="p-1 text-zinc-400 hover:text-blue-500 mx-0.5"><Edit2 size={13} /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1 text-zinc-400 hover:text-red-500 mx-0.5"><Trash2 size={13} /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={colCount} className={cn(cellBorder, "px-4 py-8 text-center text-zinc-500")}>Nenhum lançamento encontrado.</td>
                </tr>
              )}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="bg-zinc-100 dark:bg-zinc-800 font-bold text-xs">
                  <td className={cn(cellBorder, "px-3 py-2")} colSpan={isVisitante ? 5 : 6}>TOTAIS</td>
                  <td className={cn(cellBorder, "px-3 py-2 text-right")}>{formatarMoeda(somaRodape.pecas)}</td>
                  <td className={cn(cellBorder, "px-3 py-2 text-right")}>{formatarMoeda(somaRodape.maoObra)}</td>
                  <td className={cn(cellBorder, "px-3 py-2 text-right")}>{formatarMoeda(somaRodape.total)}</td>
                  <td className={cn(cellBorder, "px-3 py-2")} colSpan={isVisitante ? 2 : 3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {!isVisitante && selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-semibold">{selectedIds.length} selecionado(s)</span>
          <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-bold">
            <Trash2 size={14} /> Excluir
          </button>
          <button onClick={() => setSelectedIds([])} className="text-zinc-400 hover:text-white text-sm">Cancelar</button>
        </div>
      )}

      {modalOpen && (
        <CustoModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setEditingData(null); }}
          editingData={editingData}
          equipamentos={equipamentos}
          isOnline={isOnline}
        />
      )}

      {importExportOpen && (
        <ImportExportModal
          isOpen={importExportOpen}
          onClose={() => setImportExportOpen(false)}
          filteredData={filteredData}
          kpis={kpis}
        />
      )}
    </div>
  );
}
