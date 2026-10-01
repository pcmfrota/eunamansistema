"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign, Plus, Search, Printer, FileUp, Trash2, Edit2, Eye, Loader2, FileText,
  ArrowUp, ArrowDown, ArrowUpDown, LayoutGrid, ListTree, X, Building2, CreditCard, History, ChevronDown, ChevronUp, Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import { MultiSelect } from "@/components/MultiSelect";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, LabelList,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import {
  CustoManutencao, StatusCusto, TipoManutencaoCusto, AreaCusto, Fornecedor, ParcelaCartao, StatusParcela, HistoricoCusto, AcaoHistorico,
  deleteCusto, bulkDeleteCustos, deleteFornecedor, atualizarStatusParcela, marcarCustoComoPago, getCustosHistorico,
} from "./actions";
import CustoModal from "./CustoModal";
import FornecedorModal from "./FornecedorModal";
import ImportExportModal from "./ImportExportModal";
import { gerarPDFCustos, imprimirRelatorioCustos, gerarPDFApresentacaoCustos } from "./CustosPDF";
import { AREAS, AREA_LABEL, CATEGORIAS_POR_AREA } from "./config";

// Rótulo de exibição pro seletor de área — inclui "TODAS", que é só um valor de UI (visão
// consolidada) e nunca existe de verdade em custos.area no banco.
const AREA_LABEL_ATIVA: Record<AreaCusto | "TODAS", string> = { ...AREA_LABEL, TODAS: "Todas as Áreas" };

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const STATUS_LABEL: Record<StatusCusto, string> = { PAGO: "Pago", AG_PAGAMENTO: "Ag. Pagamento", FATURADO: "Faturado", PAGO_CARTAO: "Pago (Cartão)" };
const STATUS_BADGE: Record<StatusCusto, string> = {
  PAGO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  AG_PAGAMENTO: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  FATURADO: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  PAGO_CARTAO: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
};
const STATUS_CHIP: Record<StatusCusto, string> = {
  PAGO: "bg-emerald-600 text-white",
  AG_PAGAMENTO: "bg-red-600 text-white",
  FATURADO: "bg-blue-600 text-white",
  PAGO_CARTAO: "bg-purple-600 text-white",
};
const CHART_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#8b5cf6", "#0891b2", "#dc2626", "#64748b", "#db2777"];

// Mesma ordem que o array retornado por `distribuicaoFormaPagamento` (Pago, Ag. Pagamento,
// Faturado, Cartão à Vista, Cartão Parcelado) — usado pra mapear a barra clicada de volta
// pra categoria de filtro correta.
const CATEGORIAS_FORMA_PAGAMENTO = ["PAGO", "AG_PAGAMENTO", "FATURADO", "CARTAO_AVISTA", "CARTAO_PARCELADO"] as const;

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
  fornecedores,
  parcelas,
  equipamentos,
}: {
  isVisitante: boolean;
  initialCustos: CustoManutencao[];
  fornecedores: Fornecedor[];
  parcelas: ParcelaCartao[];
  equipamentos: any[];
}) {
  const { isOnline } = useOffline();

  // Visão Geral sempre começa filtrada no mês atual (o usuário pode trocar/limpar depois).
  const hoje = new Date();
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, "0");
  const anoAtual = String(hoje.getFullYear());

  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlaca, setFilterPlaca] = useState("");
  const [filterMes, setFilterMes] = useState(mesAtual);
  const [filterAno, setFilterAno] = useState(anoAtual);
  const [filterTipo, setFilterTipo] = useState("");
  const [filterFornecedor, setFilterFornecedor] = useState("");
  const [filterDataIni, setFilterDataIni] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterFormaCartao, setFilterFormaCartao] = useState<"" | "AVISTA" | "PARCELADO">("");
  const [filterCartao, setFilterCartao] = useState("");
  const [filterTipoCusto, setFilterTipoCusto] = useState<"" | "PECAS" | "MAO_OBRA">("");
  const [tabelaDashboardVisivel, setTabelaDashboardVisivel] = useState(false);
  const [sortColuna, setSortColuna] = useState("data");
  const [sortDirecao, setSortDirecao] = useState<"asc" | "desc">("asc");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<CustoManutencao | null>(null);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isGerandoApresentacao, setIsGerandoApresentacao] = useState(false);
  const [viewTab, setViewTab] = useState<"dashboard" | "lancamentos" | "fornecedores" | "parcelamentos" | "historico">("dashboard");
  // "TODAS" é um valor só de UI (visão consolidada) — nunca existe de verdade em custos.area
  // no banco, que só aceita os 5 valores reais de AreaCusto.
  const [areaAtiva, setAreaAtiva] = useState<AreaCusto | "TODAS">("MANUTENCAO");
  const ehConsolidado = areaAtiva === "TODAS";
  const ehManutencao = areaAtiva === "MANUTENCAO";
  // Gráficos/colunas de placa e peças-vs-mão-de-obra fazem sentido em Manutenção E na visão
  // consolidada (que inclui os dados de Manutenção) — só não fazem sentido nas outras 4 áreas
  // isoladas, que nunca têm peças/mão de obra nem placa de verdade.
  const mostrarGraficosVeiculo = ehManutencao || ehConsolidado;
  const [fornecedorModalOpen, setFornecedorModalOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [buscaFornecedor, setBuscaFornecedor] = useState("");
  const [buscaParcelamento, setBuscaParcelamento] = useState("");
  const [historico, setHistorico] = useState<HistoricoCusto[] | null>(null);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);
  const [buscaHistorico, setBuscaHistorico] = useState("");
  const [filtroAcaoHistorico, setFiltroAcaoHistorico] = useState<string>("");
  const [linhaExpandida, setLinhaExpandida] = useState<string | null>(null);

  useEffect(() => {
    if (viewTab !== "historico" || historico !== null || historicoCarregando) return;
    setHistoricoCarregando(true);
    getCustosHistorico()
      .then((data) => setHistorico(data))
      .catch(() => setHistorico([]))
      .finally(() => setHistoricoCarregando(false));
  }, [viewTab, historico, historicoCarregando]);

  const custosDaArea = useMemo(
    () => (ehConsolidado ? initialCustos : initialCustos.filter((c) => c.area === areaAtiva)),
    [initialCustos, areaAtiva, ehConsolidado]
  );

  const placasUnicas = useMemo(
    () => Array.from(new Set(custosDaArea.map((c) => c.placa))).filter((p): p is string => !!p).sort(),
    [custosDaArea]
  );
  const anosUnicos = useMemo(
    () => Array.from(new Set(custosDaArea.map((c) => c.data?.slice(0, 4)))).filter((a): a is string => !!a).sort().reverse(),
    [custosDaArea]
  );

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return custosDaArea.filter((c) => {
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
      // Fora de Manutenção, "Tipo" filtra pela categoria própria da área (Material/Serviços/
      // EPIs/etc.) em vez de tipo_manutencao (Corretiva/Preventiva/Preditiva), que só existe
      // de verdade pra Manutenção. Na visão consolidada, esse mesmo seletor vira um filtro de
      // Área (não dá pra comparar categorias de áreas diferentes numa lista só).
      if (filterTipo) {
        const campoTipo = ehConsolidado ? c.area : areaAtiva === "MANUTENCAO" ? c.tipo_manutencao : c.categoria;
        if (campoTipo !== filterTipo) return false;
      }
      if (filterFornecedor && (c.fornecedor || "Sem fornecedor") !== filterFornecedor) return false;
      if (filterStatus.length && !filterStatus.includes(c.status)) return false;
      if (filterFormaCartao && c.forma_pagamento_cartao !== filterFormaCartao) return false;
      if (filterCartao && c.cartao !== filterCartao) return false;
      if (filterTipoCusto === "PECAS" && !(Number(c.pecas) > 0)) return false;
      if (filterTipoCusto === "MAO_OBRA" && !(Number(c.mao_obra) > 0)) return false;
      if (filterMes || filterAno) {
        const [y, m] = (c.data || "").split("-");
        if (filterAno && y !== filterAno) return false;
        if (filterMes && m !== filterMes) return false;
      }
      if (filterDataIni && c.data < filterDataIni) return false;
      if (filterDataFim && c.data > filterDataFim) return false;
      return true;
    });
  }, [
    custosDaArea, areaAtiva, ehConsolidado, searchTerm, filterPlaca, filterTipo, filterFornecedor, filterStatus,
    filterFormaCartao, filterCartao, filterTipoCusto, filterMes, filterAno, filterDataIni, filterDataFim,
  ]);

  // Ordenação da tabela por coluna, igual planilha — clicar alterna crescente/decrescente;
  // clicar numa coluna diferente troca a coluna e volta pra crescente.
  function alternarOrdenacao(coluna: string) {
    if (sortColuna === coluna) {
      setSortDirecao((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColuna(coluna);
      setSortDirecao("asc");
    }
  }

  const dadosTabela = useMemo(() => {
    const valorDaColuna = (c: CustoManutencao): string | number => {
      switch (sortColuna) {
        case "data": return c.data || "";
        case "placa": return c.placa || "";
        case "tipo": return (ehConsolidado ? c.area : areaAtiva === "MANUTENCAO" ? c.tipo_manutencao : c.categoria) || "";
        case "descricao": return c.descricao || "";
        case "fornecedor": return c.fornecedor || "";
        case "pecas": return Number(c.pecas);
        case "mao_obra": return Number(c.mao_obra);
        case "total": return Number(c.pecas) + Number(c.mao_obra);
        case "status": return STATUS_LABEL[c.status] || "";
        case "observacoes": return c.observacoes || "";
        default: return "";
      }
    };
    const copia = [...filteredData];
    copia.sort((a, b) => {
      const va = valorDaColuna(a);
      const vb = valorDaColuna(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return sortDirecao === "asc" ? cmp : -cmp;
    });
    return copia;
  }, [filteredData, sortColuna, sortDirecao, areaAtiva]);

  function IconeOrdenacao({ coluna }: { coluna: string }) {
    if (sortColuna !== coluna) return <ArrowUpDown size={11} className="opacity-30" />;
    return sortDirecao === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />;
  }

  // Filtros disparados por clique nos gráficos — clicar de novo no mesmo valor limpa o filtro
  // (efeito toggle), dando aos gráficos uma função de "abrir o detalhe" além de só mostrar.
  // Cada toggle também revela a tabela de lançamentos embaixo do dashboard (o "dashboard
  // oculto" pedido) — ela só aparece depois de um clique num gráfico, nunca sozinha só por
  // causa do filtro padrão de mês/ano (que já vem preenchido no mês atual).
  function toggleFiltroPlaca(placa: string) {
    setFilterPlaca((atual) => (atual === placa ? "" : placa));
    setTabelaDashboardVisivel(true);
  }
  function toggleFiltroTipo(tipo: string) {
    setFilterTipo((atual) => (atual === tipo ? "" : tipo));
    setTabelaDashboardVisivel(true);
  }
  function toggleFiltroFornecedor(fornecedor: string) {
    setFilterFornecedor((atual) => (atual === fornecedor ? "" : fornecedor));
    setTabelaDashboardVisivel(true);
  }
  function toggleFiltroMesAno(mes: string, ano: string) {
    const jaAtivo = filterMes === mes && filterAno === ano;
    setFilterMes(jaAtivo ? "" : mes);
    setFilterAno(jaAtivo ? "" : ano);
    setTabelaDashboardVisivel(true);
  }
  function toggleFiltroTipoCusto(tipo: "PECAS" | "MAO_OBRA") {
    setFilterTipoCusto((atual) => (atual === tipo ? "" : tipo));
    setTabelaDashboardVisivel(true);
  }
  function toggleFiltroFormaPagamento(categoria: "PAGO" | "AG_PAGAMENTO" | "FATURADO" | "CARTAO_AVISTA" | "CARTAO_PARCELADO") {
    if (categoria === "CARTAO_AVISTA" || categoria === "CARTAO_PARCELADO") {
      const forma = categoria === "CARTAO_AVISTA" ? "AVISTA" : "PARCELADO";
      const jaAtivo = filterStatus.length === 1 && filterStatus[0] === "PAGO_CARTAO" && filterFormaCartao === forma;
      setFilterStatus(jaAtivo ? [] : ["PAGO_CARTAO"]);
      setFilterFormaCartao(jaAtivo ? "" : forma);
    } else {
      const jaAtivo = filterStatus.length === 1 && filterStatus[0] === categoria && !filterFormaCartao;
      setFilterStatus(jaAtivo ? [] : [categoria]);
      setFilterFormaCartao("");
    }
    setTabelaDashboardVisivel(true);
  }
  function toggleFiltroCartao(cartao: string) {
    setFilterCartao((atual) => (atual === cartao ? "" : cartao));
    setTabelaDashboardVisivel(true);
  }
  function limparFiltrosGraficos() {
    setFilterPlaca("");
    setFilterTipo("");
    setFilterFornecedor("");
    setFilterMes("");
    setFilterAno("");
    setFilterStatus([]);
    setFilterFormaCartao("");
    setFilterCartao("");
    setFilterTipoCusto("");
    setTabelaDashboardVisivel(false);
  }
  const temFiltroDeGrafico = !!(
    filterPlaca || filterTipo || filterFornecedor || filterMes || filterAno ||
    filterFormaCartao || filterCartao || filterTipoCusto
  );

  // Troca de área: os filtros disparados por gráfico (placa/tipo/fornecedor/status/cartão) são
  // específicos de cada área, então não fazem sentido carregados de uma área pra outra.
  function handleTrocarArea(novaArea: AreaCusto | "TODAS") {
    setAreaAtiva(novaArea);
    setFilterPlaca("");
    setFilterTipo("");
    setFilterFornecedor("");
    setFilterStatus([]);
    setFilterFormaCartao("");
    setFilterCartao("");
    setFilterTipoCusto("");
    setTabelaDashboardVisivel(false);
    setSelectedIds([]);
  }

  const kpis = useMemo(() => {
    let totalGeral = 0, totalPago = 0, totalAgPagamento = 0, totalFaturado = 0, totalPagoCartao = 0;
    const placas = new Set<string>();
    filteredData.forEach((c) => {
      const total = Number(c.pecas) + Number(c.mao_obra);
      totalGeral += total;
      if (c.placa) placas.add(c.placa);
      if (c.status === "PAGO") totalPago += total;
      else if (c.status === "AG_PAGAMENTO") totalAgPagamento += total;
      else if (c.status === "FATURADO") totalFaturado += total;
      else if (c.status === "PAGO_CARTAO") totalPagoCartao += total;
    });
    return {
      totalGeral,
      totalPago,
      totalAgPagamento,
      totalFaturado,
      totalPagoCartao,
      custoMedioPorPlaca: placas.size ? totalGeral / placas.size : 0,
      custoMedioPorLancamento: filteredData.length ? totalGeral / filteredData.length : 0,
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

  // Fora de Manutenção, agrupa pela categoria própria da área (Material/Serviços/EPIs/etc.)
  // em vez de tipo_manutencao, que só existe de verdade pra Manutenção.
  // Só faz sentido comparar tipo_manutencao/categoria dentro de UMA área — na visão
  // consolidada, esse gráfico vira "Custos por Área" (memo separado logo abaixo).
  const distribuicaoTipo = useMemo(() => {
    if (ehConsolidado) return [];
    const categoriasLabel = new Map(CATEGORIAS_POR_AREA[areaAtiva as AreaCusto].map((c) => [c.value, c.label]));
    const porTipo = new Map<string, number>();
    filteredData.forEach((c) => {
      const chave = areaAtiva === "MANUTENCAO" ? c.tipo_manutencao : (c.categoria || "SEM_CATEGORIA");
      const total = Number(c.pecas) + Number(c.mao_obra);
      porTipo.set(chave, (porTipo.get(chave) || 0) + total);
    });
    return Array.from(porTipo.entries()).map(([chave, value]) => ({
      chave,
      name: areaAtiva === "MANUTENCAO" ? chave : (categoriasLabel.get(chave) || "Sem categoria"),
      value,
    }));
  }, [filteredData, areaAtiva, ehConsolidado]);

  const custosPorArea = useMemo(() => {
    if (!ehConsolidado) return [];
    const porArea = new Map<AreaCusto, number>();
    filteredData.forEach((c) => {
      const total = Number(c.pecas) + Number(c.mao_obra);
      porArea.set(c.area, (porArea.get(c.area) || 0) + total);
    });
    return Array.from(porArea.entries())
      .map(([area, value]) => ({ chave: area, name: AREA_LABEL[area], value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData, ehConsolidado]);

  const topVeiculos = useMemo(() => {
    const porPlaca = new Map<string, number>();
    filteredData.forEach((c) => {
      const nome = c.placa || "Sem placa";
      const total = Number(c.pecas) + Number(c.mao_obra);
      porPlaca.set(nome, (porPlaca.get(nome) || 0) + total);
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

  const pecasVsMaoObra = useMemo(() => {
    let pecas = 0, maoObra = 0;
    filteredData.forEach((c) => { pecas += Number(c.pecas); maoObra += Number(c.mao_obra); });
    return [
      { name: "Peças", value: pecas },
      { name: "Mão de Obra", value: maoObra },
    ];
  }, [filteredData]);

  const distribuicaoFormaPagamento = useMemo(() => {
    let pago = 0, agPagamento = 0, faturado = 0, cartaoAvista = 0, cartaoParcelado = 0;
    filteredData.forEach((c) => {
      const total = Number(c.pecas) + Number(c.mao_obra);
      if (c.status === "PAGO") pago += total;
      else if (c.status === "AG_PAGAMENTO") agPagamento += total;
      else if (c.status === "FATURADO") faturado += total;
      else if (c.status === "PAGO_CARTAO") {
        if (c.forma_pagamento_cartao === "PARCELADO") cartaoParcelado += total;
        else cartaoAvista += total;
      }
    });
    return [
      { name: "Pago", value: pago },
      { name: "Ag. Pagamento", value: agPagamento },
      { name: "Faturado (Boleto)", value: faturado },
      { name: "Cartão à Vista", value: cartaoAvista },
      { name: "Cartão Parcelado", value: cartaoParcelado },
    ];
  }, [filteredData]);

  const gastoPorCartao = useMemo(() => {
    const porCartao = new Map<string, number>();
    filteredData.forEach((c) => {
      if (c.status !== "PAGO_CARTAO" || !c.cartao) return;
      const total = Number(c.pecas) + Number(c.mao_obra);
      porCartao.set(c.cartao, (porCartao.get(c.cartao) || 0) + total);
    });
    return Array.from(porCartao.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredData]);

  const topFornecedoresPorQtd = useMemo(() => {
    const porFornecedor = new Map<string, number>();
    filteredData.forEach((c) => {
      const nome = c.fornecedor || "Sem fornecedor";
      porFornecedor.set(nome, (porFornecedor.get(nome) || 0) + 1);
    });
    return Array.from(porFornecedor.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredData]);

  // Parcelas de cartão por mês de vencimento — projeção de fluxo de caixa futuro. De propósito
  // NÃO usa filteredData (que respeita o filtro de Mês/Ano do topo, sempre no mês atual por
  // padrão): a maior parte das parcelas futuras tem a *compra* registrada em meses anteriores,
  // então filtrar por mês da compra escondería quase tudo. Mesmo padrão já usado na aba
  // "Faturas & Parcelamentos", que também lê direto de `parcelas` sem o filtro de mês/ano.
  const parcelasPorMesVencimento = useMemo(() => {
    const porMes = new Map<string, { mes: string; pendente: number; pago: number }>();
    parcelas.forEach((p) => {
      const chave = p.mes_vencimento?.slice(0, 7);
      if (!chave) return;
      if (!porMes.has(chave)) {
        const [y, m] = chave.split("-");
        porMes.set(chave, { mes: `${MESES[Number(m) - 1]?.slice(0, 3) || m}/${y.slice(2)}`, pendente: 0, pago: 0 });
      }
      const item = porMes.get(chave)!;
      if (p.status === "PAGO") item.pago += Number(p.valor);
      else item.pendente += Number(p.valor);
    });
    return Array.from(porMes.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [parcelas]);

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
      const placa = c.placa || "Sem placa";
      if (!porPlaca.has(placa)) porPlaca.set(placa, {});
      const registro = porPlaca.get(placa)!;
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

  function openFornecedorModal(data: Fornecedor | null = null) {
    setEditingFornecedor(data);
    setFornecedorModalOpen(true);
  }

  async function handleDeleteFornecedor(id: string) {
    if (isVisitante) return;
    if (!confirm("Tem certeza que deseja excluir este fornecedor? Lançamentos já registrados com o nome dele continuam intactos.")) return;
    try {
      if (isOnline) {
        const result = await deleteFornecedor(id);
        if (result?.error) throw new Error(result.error);
      } else {
        await localDb.addToQueue("custos_fornecedores", "delete", { id });
      }
      await localDb.delete("custos_fornecedores", id);
      window.dispatchEvent(new CustomEvent("offline-db-updated-custos_fornecedores"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    } catch (err: any) {
      alert("Erro ao excluir fornecedor: " + (err.message || String(err)));
    }
  }

  const fornecedoresFiltrados = useMemo(() => {
    const term = buscaFornecedor.toLowerCase().trim();
    if (!term) return fornecedores;
    return fornecedores.filter(
      (f) => f.nome_fantasia?.toLowerCase().includes(term) || f.razao_social?.toLowerCase().includes(term)
    );
  }, [fornecedores, buscaFornecedor]);

  // Une parcelas de cartão (uma linha por parcela) com boletos faturados (uma linha por
  // lançamento) numa única lista de pendências futuras, igual à planilha pedida.
  type LinhaParcelamento = {
    id: string; tipo: "PARCELA" | "BOLETO" | "FATURADO"; fornecedor: string; cartao: string;
    parcela: string; mes: string; valor: number; status: string; statusCusto: StatusCusto;
    tipoManutencao: TipoManutencaoCusto; categoria: string | null; placa: string; descricao: string; custoId: string;
    area: AreaCusto;
  };

  const parcelamentosData = useMemo<LinhaParcelamento[]>(() => {
    const custosPorId = new Map(initialCustos.map((c) => [c.id, c]));

    const linhasParcelas: LinhaParcelamento[] = parcelas
      .filter((p) => ehConsolidado || custosPorId.get(p.custo_id)?.area === areaAtiva)
      .map((p) => {
      const custo = custosPorId.get(p.custo_id);
      const ehBoleto = custo?.status === "FATURADO";
      return {
        id: p.id,
        tipo: ehBoleto ? "BOLETO" : "PARCELA",
        fornecedor: custo?.fornecedor || "-",
        cartao: ehBoleto ? "-" : (custo?.cartao || "-"),
        parcela: `${p.numero}/${custo?.parcelas_total || "?"}`,
        mes: p.mes_vencimento,
        valor: Number(p.valor),
        status: p.status,
        statusCusto: custo?.status || "PAGO_CARTAO",
        tipoManutencao: custo?.tipo_manutencao || "CORRETIVA",
        categoria: custo?.categoria || null,
        placa: custo?.placa || "-",
        descricao: custo?.descricao || "-",
        custoId: p.custo_id,
        area: custo?.area || "MANUTENCAO",
      };
    });

    // Boletos únicos (sem parcelamento manual) continuam como 1 linha por lançamento; quando
    // há mais de 1 boleto, o lançamento já foi explodido em linhasParcelas acima.
    const linhasFaturado: LinhaParcelamento[] = initialCustos
      .filter((c) => c.status === "FATURADO" && (ehConsolidado || c.area === areaAtiva) && !(Number(c.parcelas_total) > 1))
      .map((c) => ({
        id: c.id,
        tipo: "FATURADO",
        fornecedor: c.fornecedor || "-",
        cartao: "-",
        parcela: "-",
        mes: c.data,
        valor: Number(c.pecas) + Number(c.mao_obra),
        status: "FATURADO",
        statusCusto: "FATURADO",
        tipoManutencao: c.tipo_manutencao,
        categoria: c.categoria || null,
        placa: c.placa || "-",
        descricao: c.descricao,
        custoId: c.id,
        area: c.area,
      }));

    return [...linhasFaturado, ...linhasParcelas].sort((a, b) => (b.mes || "").localeCompare(a.mes || ""));
  }, [initialCustos, parcelas, areaAtiva, ehConsolidado]);

  // Respeita os filtros globais do topo (placa/tipo/fornecedor/status/busca) igual às outras
  // abas — só NÃO aplica o filtro de Mês/Ano (que vem preenchido no mês atual por padrão),
  // porque essa aba existe justamente pra mostrar parcelas futuras que caem fora do mês atual.
  const parcelamentosFiltrados = useMemo(() => {
    const term = buscaParcelamento.toLowerCase().trim();
    const termoTopo = searchTerm.toLowerCase().trim();
    return parcelamentosData.filter((l) => {
      if (filterPlaca && l.placa !== filterPlaca) return false;
      if (filterTipo) {
        const campoTipo = ehConsolidado ? l.area : areaAtiva === "MANUTENCAO" ? l.tipoManutencao : l.categoria;
        if (campoTipo !== filterTipo) return false;
      }
      if (filterFornecedor && l.fornecedor !== filterFornecedor) return false;
      if (filterStatus.length && !filterStatus.includes(l.statusCusto)) return false;
      if (term && !(l.fornecedor.toLowerCase().includes(term) || l.cartao.toLowerCase().includes(term) || l.placa.toLowerCase().includes(term))) return false;
      if (termoTopo && !(l.fornecedor.toLowerCase().includes(termoTopo) || l.placa.toLowerCase().includes(termoTopo) || l.cartao.toLowerCase().includes(termoTopo))) return false;
      return true;
    });
  }, [parcelamentosData, buscaParcelamento, searchTerm, filterPlaca, filterTipo, filterFornecedor, filterStatus, areaAtiva]);

  // Pontualidade: usa os mesmos boletos/parcelas da aba Faturas & Parcelamentos (únicas linhas
  // com um vencimento de verdade pra comparar) — por isso ignora o filtro de Mês/Ano do topo
  // igual à própria aba, senão "atrasado" sumiria assim que o mês mudasse.
  const pontualidadePagamentos = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    let emDia = 0, atrasado = 0;
    parcelamentosFiltrados.forEach((l) => {
      if (l.status === "PAGO") emDia++;
      else if (l.mes < hoje) atrasado++;
      else emDia++;
    });
    const total = emDia + atrasado;
    return { emDia, atrasado, total, percentual: total ? Math.round((emDia / total) * 100) : 100 };
  }, [parcelamentosFiltrados]);

  // Comparativo entre anos — de propósito usa custosDaArea (só a área, sem o resto dos
  // filtros) em vez de filteredData, senão o filtro de Mês/Ano do topo reduziria a
  // comparação a um único mês de um único ano.
  const comparativoAnual = useMemo(() => {
    const anos = Array.from(new Set(custosDaArea.map((c) => c.data?.slice(0, 4)).filter(Boolean))).sort() as string[];
    const porMes = new Map<string, Record<string, number>>();
    custosDaArea.forEach((c) => {
      const [ano, mes] = (c.data || "").split("-");
      if (!ano || !mes) return;
      if (!porMes.has(mes)) porMes.set(mes, {});
      const registro = porMes.get(mes)!;
      const total = Number(c.pecas) + Number(c.mao_obra);
      registro[ano] = (registro[ano] || 0) + total;
    });
    const linhas = MESES.map((nome, i) => {
      const chave = String(i + 1).padStart(2, "0");
      return { mes: nome.slice(0, 3), ...(porMes.get(chave) || {}) };
    });
    return { anos, linhas };
  }, [custosDaArea]);

  // Natureza financeira (treemap): categoria/tipo de TODAS as áreas misturadas — só existe
  // de verdade no Consolidado, já que em uma área só isso é o mesmo que a Distribuição acima.
  const custosPorNatureza = useMemo(() => {
    if (!ehConsolidado) return [];
    const porNatureza = new Map<string, number>();
    filteredData.forEach((c) => {
      const nome = c.area === "MANUTENCAO"
        ? `Manutenção — ${c.tipo_manutencao}`
        : `${AREA_LABEL[c.area]} — ${CATEGORIAS_POR_AREA[c.area].find((cat) => cat.value === c.categoria)?.label || "Outros"}`;
      const total = Number(c.pecas) + Number(c.mao_obra);
      porNatureza.set(nome, (porNatureza.get(nome) || 0) + total);
    });
    return Array.from(porNatureza.entries())
      .map(([name, size], i) => ({ name, size, fill: CHART_COLORS[i % CHART_COLORS.length] }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 12);
  }, [filteredData, ehConsolidado]);

  async function toggleStatusParcela(linha: LinhaParcelamento) {
    if (isVisitante) return;
    const novoStatus: StatusParcela = linha.status === "PAGO" ? "PENDENTE" : "PAGO";
    try {
      const result = await atualizarStatusParcela(linha.id, novoStatus);
      if (result?.error) throw new Error(result.error);
      const atual = parcelas.find((p) => p.id === linha.id);
      if (atual) await localDb.put("custos_parcelas", { ...atual, status: novoStatus });
      window.dispatchEvent(new CustomEvent("offline-db-updated-custos_parcelas"));
    } catch (err: any) {
      alert("Erro ao atualizar parcela: " + (err.message || String(err)));
    }
  }

  const ACAO_LABEL: Record<AcaoHistorico, string> = { CRIACAO: "Criação", EDICAO: "Edição", EXCLUSAO: "Exclusão" };
  const ACAO_BADGE: Record<AcaoHistorico, string> = {
    CRIACAO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    EDICAO: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    EXCLUSAO: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };
  const TABELA_LABEL: Record<string, string> = {
    custos_manutencao: "Lançamento",
    custos_fornecedores: "Fornecedor",
    custos_parcelas: "Parcela",
  };

  const CAMPO_LABEL: Record<string, string> = {
    data: "Data", placa: "Placa", tipo_manutencao: "Tipo de Manutenção", descricao: "Descrição",
    fornecedor: "Fornecedor", pecas: "Peças (R$)", mao_obra: "Mão de Obra (R$)", status: "Status",
    forma_pagamento_cartao: "Forma de Pagamento", cartao: "Cartão", parcelas_total: "Nº de Parcelas",
    observacoes: "Observações / PC", anexo_url: "Anexo", nome_fantasia: "Nome Fantasia",
    razao_social: "Razão Social", numero: "Nº da Parcela", valor: "Valor (R$)", mes_vencimento: "Mês de Vencimento",
    quantidade: "Quantidade", area: "Área", categoria: "Categoria", categoria_outros: "Categoria (Outros)",
    cnpj: "CNPJ/CPF", telefone: "Telefone", email: "E-mail", endereco: "Endereço", contato: "Contato",
    quantidade_boletos: "Qtd. de Boletos",
  };
  const CAMPO_IGNORAR = new Set(["id", "filial_id", "custo_id", "registrado_por"]);

  function formatarValorHistorico(campo: string, valor: any): string {
    if (valor === null || valor === undefined || valor === "") return "-";
    if (["pecas", "mao_obra", "valor"].includes(campo)) return formatarMoeda(Number(valor));
    if (["data", "mes_vencimento"].includes(campo)) return formatarDataCusto(String(valor));
    if (campo === "status") return STATUS_LABEL[valor as StatusCusto] || (valor === "PAGO" ? "Pago" : valor === "PENDENTE" ? "Pendente" : String(valor));
    if (campo === "forma_pagamento_cartao") return valor === "AVISTA" ? "À Vista" : valor === "PARCELADO" ? "Parcelado" : String(valor);
    if (campo === "area") return AREA_LABEL[valor as AreaCusto] || String(valor);
    if (typeof valor === "boolean") return valor ? "Sim" : "Não";
    return String(valor);
  }

  function montarComparacaoHistorico(antes: any, depois: any) {
    const chaves = Array.from(new Set([...(antes ? Object.keys(antes) : []), ...(depois ? Object.keys(depois) : [])]))
      .filter((k) => !CAMPO_IGNORAR.has(k));
    return chaves.map((campo) => {
      const valorAntes = antes ? antes[campo] : undefined;
      const valorDepois = depois ? depois[campo] : undefined;
      return {
        campo,
        label: CAMPO_LABEL[campo] || campo.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        antes: formatarValorHistorico(campo, valorAntes),
        depois: formatarValorHistorico(campo, valorDepois),
        mudou: !!(antes && depois) && String(valorAntes) !== String(valorDepois),
      };
    });
  }

  const historicoFiltrado = useMemo(() => {
    let lista = historico || [];
    if (filtroAcaoHistorico) lista = lista.filter((h) => h.acao === filtroAcaoHistorico);
    const term = buscaHistorico.toLowerCase().trim();
    if (term) {
      lista = lista.filter(
        (h) => h.descricao?.toLowerCase().includes(term) || h.usuario_nome?.toLowerCase().includes(term)
      );
    }
    return lista;
  }, [historico, filtroAcaoHistorico, buscaHistorico]);

  async function handleMarcarFaturadoPago(linha: LinhaParcelamento) {
    if (isVisitante) return;
    if (!confirm("Marcar este boleto faturado como pago?")) return;
    try {
      const result = await marcarCustoComoPago(linha.custoId);
      if (result?.error) throw new Error(result.error);
      const atual = initialCustos.find((c) => c.id === linha.custoId);
      if (atual) await localDb.put("custos_manutencao", { ...atual, status: "PAGO" });
      window.dispatchEvent(new CustomEvent("offline-db-updated-custos_manutencao"));
    } catch (err: any) {
      alert("Erro ao atualizar lançamento: " + (err.message || String(err)));
    }
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

  async function handleGerarApresentacao() {
    if (viewTab !== "dashboard") {
      alert(`Abra a aba "Dashboard ${AREA_LABEL_ATIVA[areaAtiva]}" pra gerar a apresentação com os gráficos dela.`);
      return;
    }
    setIsGerandoApresentacao(true);
    try {
      const periodo = filterMes || filterAno
        ? `${filterMes ? MESES[Number(filterMes) - 1] : "Todos os meses"}${filterAno ? "/" + filterAno : ""}`
        : "Todo o período";
      await gerarPDFApresentacaoCustos(periodo, AREA_LABEL_ATIVA[areaAtiva]);
    } catch (err: any) {
      alert("Erro ao gerar apresentação: " + (err.message || String(err)));
    } finally {
      setIsGerandoApresentacao(false);
    }
  }

  const cellBorder = "border border-zinc-200 dark:border-zinc-800";
  const colCount = (isVisitante ? 10 : 12) - (mostrarGraficosVeiculo ? 0 : 1) + (ehConsolidado ? 1 : 0);

  return (
    <div className="p-3 md:p-6 flex flex-col gap-4 max-w-[1600px] mx-auto w-full">
      <div className="flex items-center gap-3 bg-white dark:bg-zinc-950 px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Área</span>
        <select
          value={areaAtiva}
          onChange={(e) => handleTrocarArea(e.target.value as AreaCusto | "TODAS")}
          className="px-3 py-1.5 text-sm font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg outline-none cursor-pointer"
        >
          {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          <option value="TODAS">Todas as Áreas (Consolidado)</option>
        </select>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-950 p-4 md:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/30">
            <BadgeDollarSign size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              CONTROLE FINANCEIRO — {AREA_LABEL_ATIVA[areaAtiva].toUpperCase()}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Gestão de custos, faturamento e status de pagamento — {AREA_LABEL_ATIVA[areaAtiva]}</p>
          </div>
        </div>

        {!isVisitante ? (
          <div className="flex flex-wrap items-center gap-2">
            {!ehConsolidado && (
              <button
                onClick={() => setImportExportOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <FileUp size={16} /> Importar / Exportar
              </button>
            )}
            <button
              onClick={handleGerarPDF}
              disabled={isPrinting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              Gerar PDF
            </button>
            <button
              onClick={handleGerarApresentacao}
              disabled={isGerandoApresentacao}
              title="Baixa um PDF com os KPIs e gráficos da tela, prontos pra apresentação"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {isGerandoApresentacao ? <Loader2 size={16} className="animate-spin" /> : <Presentation size={16} />}
              PDF Apresentação
            </button>
            <button
              onClick={() => imprimirRelatorioCustos(filteredData, kpis)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Printer size={16} /> Imprimir
            </button>
            {!ehConsolidado && (
              <button
                onClick={() => openModal(null)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm active:scale-95"
              >
                <Plus size={18} /> Adicionar Lançamento
              </button>
            )}
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
        <MultiSelect
          className="lg:col-span-2 xl:col-span-2"
          placeholder="Todos os Status"
          values={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: "PAGO", label: "Pago", colorClass: STATUS_CHIP.PAGO },
            { value: "AG_PAGAMENTO", label: "Ag. Pagamento", colorClass: STATUS_CHIP.AG_PAGAMENTO },
            { value: "FATURADO", label: "Faturado", colorClass: STATUS_CHIP.FATURADO },
            { value: "PAGO_CARTAO", label: "Pago (Cartão)", colorClass: STATUS_CHIP.PAGO_CARTAO },
          ]}
        />
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
          <option value="">{ehConsolidado ? "Todas as Áreas" : areaAtiva === "MANUTENCAO" ? "Todos os Tipos" : "Todas as Categorias"}</option>
          {ehConsolidado ? (
            AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)
          ) : areaAtiva === "MANUTENCAO" ? (
            <>
              <option value="CORRETIVA">Corretiva</option>
              <option value="PREVENTIVA">Preventiva</option>
              <option value="PREDITIVA">Preditiva</option>
            </>
          ) : (
            CATEGORIAS_POR_AREA[areaAtiva as AreaCusto].map((c) => <option key={c.value} value={c.value}>{c.label}</option>)
          )}
        </select>
        <div className="flex items-center gap-1.5 lg:col-span-2 xl:col-span-1">
          <input type="date" value={filterDataIni} onChange={(e) => setFilterDataIni(e.target.value)} className="w-full px-2 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none" />
          <span className="text-zinc-400 text-xs">–</span>
          <input type="date" value={filterDataFim} onChange={(e) => setFilterDataFim(e.target.value)} className="w-full px-2 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-xl w-fit">
          <button
            onClick={() => setViewTab("dashboard")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors",
              viewTab === "dashboard" ? "bg-white dark:bg-zinc-800 text-emerald-600 shadow-sm" : "text-zinc-500"
            )}
          >
            <LayoutGrid size={14} /> Dashboard {AREA_LABEL_ATIVA[areaAtiva]}
          </button>
          <button
            onClick={() => setViewTab("lancamentos")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors",
              viewTab === "lancamentos" ? "bg-white dark:bg-zinc-800 text-emerald-600 shadow-sm" : "text-zinc-500"
            )}
          >
            <ListTree size={14} /> Financeiro {AREA_LABEL_ATIVA[areaAtiva]}
          </button>
          <button
            onClick={() => setViewTab("fornecedores")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors",
              viewTab === "fornecedores" ? "bg-white dark:bg-zinc-800 text-emerald-600 shadow-sm" : "text-zinc-500"
            )}
          >
            <Building2 size={14} /> Fornecedores
          </button>
          <button
            onClick={() => setViewTab("parcelamentos")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors",
              viewTab === "parcelamentos" ? "bg-white dark:bg-zinc-800 text-emerald-600 shadow-sm" : "text-zinc-500"
            )}
          >
            <CreditCard size={14} /> Faturas & Parcelamentos
          </button>
          <button
            onClick={() => setViewTab("historico")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors",
              viewTab === "historico" ? "bg-white dark:bg-zinc-800 text-emerald-600 shadow-sm" : "text-zinc-500"
            )}
          >
            <History size={14} /> Histórico
          </button>
        </div>

        {temFiltroDeGrafico && (
          <button
            onClick={limparFiltrosGraficos}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
          >
            Filtro do gráfico ativo
            {filterPlaca && <span className="font-mono">· {filterPlaca}</span>}
            {filterTipo && (
              <span>· {
                ehConsolidado ? AREA_LABEL_ATIVA[filterTipo as AreaCusto] :
                areaAtiva === "MANUTENCAO" ? filterTipo :
                (CATEGORIAS_POR_AREA[areaAtiva as AreaCusto].find((c) => c.value === filterTipo)?.label || filterTipo)
              }</span>
            )}
            {filterFornecedor && <span>· {filterFornecedor}</span>}
            {filterCartao && <span>· {filterCartao}</span>}
            {filterTipoCusto && <span>· {filterTipoCusto === "PECAS" ? "Peças" : "Mão de Obra"}</span>}
            {filterStatus.length === 1 && (
              <span>· {filterFormaCartao ? `Cartão ${filterFormaCartao === "AVISTA" ? "à Vista" : "Parcelado"}` : STATUS_LABEL[filterStatus[0] as StatusCusto]}</span>
            )}
            {(filterMes || filterAno) && <span>· {MESES[Number(filterMes) - 1]?.slice(0, 3) || filterMes}/{filterAno?.slice(2)}</span>}
            <X size={12} />
          </button>
        )}
      </div>

      {viewTab === "fornecedores" ? (
        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                value={buscaFornecedor}
                onChange={(e) => setBuscaFornecedor(e.target.value)}
                placeholder="Buscar fornecedor..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-emerald-500"
              />
            </div>
            {!isVisitante && (
              <button
                onClick={() => openFornecedorModal(null)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm active:scale-95"
              >
                <Plus size={18} /> Novo Fornecedor
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-[11px] uppercase">
                <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  <th className={cn(cellBorder, "px-3 py-2")}>Nome Fantasia</th>
                  <th className={cn(cellBorder, "px-3 py-2")}>Razão Social</th>
                  <th className={cn(cellBorder, "px-3 py-2")}>CNPJ/CPF</th>
                  <th className={cn(cellBorder, "px-3 py-2")}>Telefone</th>
                  <th className={cn(cellBorder, "px-3 py-2")}>Contato</th>
                  {!isVisitante && <th className={cn(cellBorder, "px-3 py-2 text-right")}>Ações</th>}
                </tr>
              </thead>
              <tbody className="text-zinc-700 dark:text-zinc-300 text-xs">
                {fornecedoresFiltrados.map((f, idx) => (
                  <tr key={f.id} className={idx % 2 === 1 ? "bg-zinc-50/70 dark:bg-zinc-900/40" : ""}>
                    <td className={cn(cellBorder, "px-3 py-2 font-semibold")}>{f.nome_fantasia}</td>
                    <td className={cn(cellBorder, "px-3 py-2")}>{f.razao_social || "-"}</td>
                    <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>{f.cnpj || "-"}</td>
                    <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>{f.telefone || "-"}</td>
                    <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>{f.contato || "-"}</td>
                    {!isVisitante && (
                      <td className={cn(cellBorder, "px-3 py-2 text-right whitespace-nowrap")}>
                        <button onClick={() => openFornecedorModal(f)} className="p-1 text-zinc-400 hover:text-blue-500 mx-0.5"><Edit2 size={13} /></button>
                        <button onClick={() => handleDeleteFornecedor(f.id)} className="p-1 text-zinc-400 hover:text-red-500 mx-0.5"><Trash2 size={13} /></button>
                      </td>
                    )}
                  </tr>
                ))}
                {fornecedoresFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className={cn(cellBorder, "px-4 py-8 text-center text-zinc-500")}>Nenhum fornecedor cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewTab === "parcelamentos" ? (
        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                value={buscaParcelamento}
                onChange={(e) => setBuscaParcelamento(e.target.value)}
                placeholder="Buscar fornecedor, cartão, placa..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-xs text-zinc-500">Boletos faturados e parcelas de cartão, ordenados por vencimento. Respeita os filtros de placa/tipo/fornecedor/status do topo — o filtro de Mês/Ano não se aplica aqui, pra não esconder parcelas futuras.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-[11px] uppercase">
                <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  <th className={cn(cellBorder, "px-3 py-2")}>Tipo</th>
                  {ehConsolidado && <th className={cn(cellBorder, "px-3 py-2")}>Área</th>}
                  <th className={cn(cellBorder, "px-3 py-2")}>Vencimento</th>
                  <th className={cn(cellBorder, "px-3 py-2")}>Placa</th>
                  <th className={cn(cellBorder, "px-3 py-2")}>Fornecedor</th>
                  <th className={cn(cellBorder, "px-3 py-2")}>Cartão</th>
                  <th className={cn(cellBorder, "px-3 py-2 text-center")}>Parcela</th>
                  <th className={cn(cellBorder, "px-3 py-2 text-right")}>Valor (R$)</th>
                  <th className={cn(cellBorder, "px-3 py-2 text-center")}>Status</th>
                  {!isVisitante && <th className={cn(cellBorder, "px-3 py-2 text-center")}>Ações</th>}
                </tr>
              </thead>
              <tbody className="text-zinc-700 dark:text-zinc-300 text-xs">
                {parcelamentosFiltrados.map((l, idx) => {
                  const vencida = l.status !== "PAGO" && l.mes < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={l.id} className={cn(idx % 2 === 1 && "bg-zinc-50/70 dark:bg-zinc-900/40", vencida && "bg-red-50/60 dark:bg-red-950/10")}>
                      <td className={cn(cellBorder, "px-3 py-2")}>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap",
                          l.tipo === "PARCELA" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                        )}>
                          {l.tipo === "PARCELA" ? "Cartão" : "Boleto"}
                        </span>
                      </td>
                      {ehConsolidado && <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>{AREA_LABEL[l.area]}</td>}
                      <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>{formatarDataCusto(l.mes)}</td>
                      <td className={cn(cellBorder, "px-3 py-2 font-mono")}>{l.placa}</td>
                      <td className={cn(cellBorder, "px-3 py-2")}>{l.fornecedor}</td>
                      <td className={cn(cellBorder, "px-3 py-2")}>{l.cartao}</td>
                      <td className={cn(cellBorder, "px-3 py-2 text-center font-semibold")}>{l.parcela}</td>
                      <td className={cn(cellBorder, "px-3 py-2 text-right font-semibold")}>{formatarMoeda(l.valor)}</td>
                      <td className={cn(cellBorder, "px-3 py-2 text-center")}>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap",
                          l.status === "PAGO" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
                          l.status === "FATURADO" ? STATUS_BADGE.FATURADO : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                        )}>
                          {l.status === "PAGO" ? "Pago" : l.status === "FATURADO" ? "Faturado" : "Pendente"}
                        </span>
                      </td>
                      {!isVisitante && (
                        <td className={cn(cellBorder, "px-3 py-2 text-center whitespace-nowrap")}>
                          {l.tipo !== "FATURADO" ? (
                            <button onClick={() => toggleStatusParcela(l)} className="text-[11px] font-semibold text-emerald-600 hover:underline">
                              {l.status === "PAGO" ? "Marcar pendente" : "Marcar paga"}
                            </button>
                          ) : (
                            <button onClick={() => handleMarcarFaturadoPago(l)} className="text-[11px] font-semibold text-emerald-600 hover:underline">
                              Marcar como pago
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {parcelamentosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={9 + (ehConsolidado ? 1 : 0)} className={cn(cellBorder, "px-4 py-8 text-center text-zinc-500")}>Nenhum boleto faturado ou parcela de cartão encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewTab === "historico" ? (
        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
                placeholder="Buscar por descrição ou usuário..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={filtroAcaoHistorico}
              onChange={(e) => setFiltroAcaoHistorico(e.target.value)}
              className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none"
            >
              <option value="">Todas as Ações</option>
              <option value="CRIACAO">Criação</option>
              <option value="EDICAO">Edição</option>
              <option value="EXCLUSAO">Exclusão</option>
            </select>
          </div>

          {historicoCarregando ? (
            <div className="flex items-center justify-center py-16 text-zinc-400">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="text-[11px] uppercase">
                  <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    <th className={cn(cellBorder, "px-3 py-2")}>Data/Hora</th>
                    <th className={cn(cellBorder, "px-3 py-2 text-center")}>Ação</th>
                    <th className={cn(cellBorder, "px-3 py-2")}>Registro</th>
                    <th className={cn(cellBorder, "px-3 py-2")}>Área</th>
                    <th className={cn(cellBorder, "px-3 py-2")}>Descrição</th>
                    <th className={cn(cellBorder, "px-3 py-2")}>Usuário</th>
                    <th className={cn(cellBorder, "px-3 py-2 text-center w-16")}>Detalhes</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-700 dark:text-zinc-300 text-xs">
                  {historicoFiltrado.map((h, idx) => (
                    <Fragment key={h.id}>
                      <tr className={idx % 2 === 1 ? "bg-zinc-50/70 dark:bg-zinc-900/40" : ""}>
                        <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>
                          {new Date(h.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className={cn(cellBorder, "px-3 py-2 text-center")}>
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap", ACAO_BADGE[h.acao])}>
                            {ACAO_LABEL[h.acao]}
                          </span>
                        </td>
                        <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>{TABELA_LABEL[h.tabela_origem] || h.tabela_origem}</td>
                        <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>
                          {AREA_LABEL[(h.dados_depois?.area || h.dados_antes?.area) as AreaCusto] || "-"}
                        </td>
                        <td className={cn(cellBorder, "px-3 py-2")}>{h.descricao || "-"}</td>
                        <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>{h.usuario_nome || "Sistema"}</td>
                        <td className={cn(cellBorder, "px-3 py-2 text-center")}>
                          {(h.dados_antes || h.dados_depois) && (
                            <button onClick={() => setLinhaExpandida(linhaExpandida === h.id ? null : h.id)} className="p-1 text-zinc-400 hover:text-emerald-600">
                              {linhaExpandida === h.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                        </td>
                      </tr>
                      {linhaExpandida === h.id && (
                        <tr>
                          <td colSpan={7} className={cn(cellBorder, "px-4 py-3 bg-zinc-50 dark:bg-zinc-900/60")}>
                            <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                              <table className="w-full text-left border-collapse bg-white dark:bg-zinc-950">
                                <thead className="text-[10px] uppercase sticky top-0">
                                  <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                    <th className={cn(cellBorder, "px-2 py-1.5")}>Campo</th>
                                    {h.dados_antes && <th className={cn(cellBorder, "px-2 py-1.5")}>Antes</th>}
                                    {h.dados_depois && <th className={cn(cellBorder, "px-2 py-1.5")}>Depois</th>}
                                  </tr>
                                </thead>
                                <tbody className="text-[11px]">
                                  {montarComparacaoHistorico(h.dados_antes, h.dados_depois).map((linha) => (
                                    <tr key={linha.campo} className={linha.mudou ? "bg-amber-50 dark:bg-amber-900/10" : ""}>
                                      <td className={cn(cellBorder, "px-2 py-1.5 font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap")}>{linha.label}</td>
                                      {h.dados_antes && (
                                        <td className={cn(cellBorder, "px-2 py-1.5 text-zinc-500 dark:text-zinc-400")}>{linha.antes}</td>
                                      )}
                                      {h.dados_depois && (
                                        <td className={cn(cellBorder, "px-2 py-1.5 font-medium text-zinc-800 dark:text-zinc-100")}>{linha.depois}</td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {historicoFiltrado.length === 0 && (
                    <tr>
                      <td colSpan={7} className={cn(cellBorder, "px-4 py-8 text-center text-zinc-500")}>Nenhum registro de histórico encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : viewTab === "dashboard" ? (
        <div id="custos-dashboard-capture" className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
            {[
              { label: "Total Geral no Período", valor: kpis.totalGeral, cor: "bg-zinc-600", tendencia: tendenciaGasto },
              { label: "Qtd. de Lançamentos", valor: filteredData.length, cor: "bg-slate-500", qtd: true },
              { label: "Total Pago", valor: kpis.totalPago, cor: "bg-emerald-600" },
              { label: "Aguardando Pagamento", valor: kpis.totalAgPagamento, cor: "bg-red-600" },
              { label: "Total Faturado", valor: kpis.totalFaturado, cor: "bg-blue-600" },
              { label: "Pago via Cartão", valor: kpis.totalPagoCartao, cor: "bg-indigo-600" },
              areaAtiva === "MANUTENCAO"
                ? { label: "Custo Médio por Placa", valor: kpis.custoMedioPorPlaca, cor: "bg-purple-600" }
                : { label: "Custo Médio por Lançamento", valor: kpis.custoMedioPorLancamento, cor: "bg-purple-600" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex items-stretch gap-3 shadow-sm">
                <div className={cn("w-1.5 rounded-full shrink-0", kpi.cor)} />
                <div className="flex flex-col justify-between py-0.5">
                  <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{kpi.label}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-2xl font-black text-zinc-800 dark:text-zinc-100 tracking-tight">{kpi.qtd ? kpi.valor : formatarMoeda(kpi.valor)}</p>
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
            {mostrarGraficosVeiculo && (
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Evolução Mensal — Peças vs Mão de Obra</h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolucaoMensal} margin={{ left: 5, right: 10, top: 20, bottom: 5 }} barCategoryGap="35%" barGap={20}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="pecas" name="Peças" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={32}
                      cursor="pointer" onClick={(d: any) => toggleFiltroMesAno(d.mesNum, d.ano)}
                    >
                      <LabelList dataKey="pecas" position="top" formatter={(v: number) => formatarMoeda(v)} style={{ fontSize: 9, fill: "#2563eb", fontWeight: 700 }} />
                      {evolucaoMensal.map((entry, i) => (
                        <Cell key={i} fill="#2563eb" opacity={filterMes && (filterMes !== entry.mesNum || filterAno !== entry.ano) ? 0.3 : 1} />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="maoObra" name="Mão de Obra" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32}
                      cursor="pointer" onClick={(d: any) => toggleFiltroMesAno(d.mesNum, d.ano)}
                    >
                      <LabelList dataKey="maoObra" position="top" formatter={(v: number) => formatarMoeda(v)} style={{ fontSize: 9, fill: "#b45309", fontWeight: 700 }} />
                      {evolucaoMensal.map((entry, i) => (
                        <Cell key={i} fill="#f59e0b" opacity={filterMes && (filterMes !== entry.mesNum || filterAno !== entry.ano) ? 0.3 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            )}

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                {ehConsolidado ? "Custos por Área" : areaAtiva === "MANUTENCAO" ? "Distribuição por Tipo de Manutenção" : "Distribuição por Categoria"}
              </h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {ehConsolidado ? (
                    <BarChart data={custosPorArea} layout="vertical" margin={{ left: 0, right: 65, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                      <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.2]} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip formatter={(v: number) => formatarMoeda(v)} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16} cursor="pointer" onClick={(d: any) => toggleFiltroTipo(d.chave)}>
                        <LabelList dataKey="value" position="right" formatter={(v: number) => formatarMoeda(v)} style={{ fontSize: 10, fill: "#52525b" }} />
                        {custosPorArea.map((entry, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} opacity={filterTipo && filterTipo !== entry.chave ? 0.35 : 1} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
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
                        onClick={(d: any) => toggleFiltroTipo(d.chave)}
                      >
                        {distribuicaoTipo.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                            opacity={filterTipo && filterTipo !== entry.chave ? 0.35 : 1}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {mostrarGraficosVeiculo && (
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
            )}

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className={cn("bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm", !mostrarGraficosVeiculo && "lg:col-span-2")}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Evolução de Custos Mensais</h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucaoMensalTotal} margin={{ left: 5, right: 30, top: 25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} padding={{ left: 40, right: 40 }} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                    <Line type="monotone" dataKey="total" name="Custo Total" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }}>
                      <LabelList dataKey="total" position="top" formatter={(v: number) => formatarMoeda(v)} style={{ fontSize: 9, fill: "#2563eb", fontWeight: 700 }} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {mostrarGraficosVeiculo && (
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Custos por Placa e Fornecedor</h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={custosPorPlacaEFornecedor.linhas} margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="placa" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {custosPorPlacaEFornecedor.fornecedores.map((f, i) => (
                      <Bar key={f} dataKey={f} name={f} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === custosPorPlacaEFornecedor.fornecedores.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Análises Detalhadas</h3>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {mostrarGraficosVeiculo && (
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Peças vs Mão de Obra</h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pecasVsMaoObra}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      cursor="pointer"
                      onClick={(d: any) => toggleFiltroTipoCusto(d.name === "Peças" ? "PECAS" : "MAO_OBRA")}
                    >
                      <Cell fill="#2563eb" opacity={filterTipoCusto && filterTipoCusto !== "PECAS" ? 0.3 : 1} />
                      <Cell fill="#f59e0b" opacity={filterTipoCusto && filterTipoCusto !== "MAO_OBRA" ? 0.3 : 1} />
                    </Pie>
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            )}

            <div className={cn("bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm", !mostrarGraficosVeiculo && "lg:col-span-2")}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Distribuição por Forma de Pagamento</h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribuicaoFormaPagamento} layout="vertical" margin={{ left: 0, right: 70, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                    <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.2]} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                    <Bar
                      dataKey="value" radius={[0, 4, 4, 0]} barSize={14} cursor="pointer"
                      onClick={(d: any) => toggleFiltroFormaPagamento(CATEGORIAS_FORMA_PAGAMENTO[distribuicaoFormaPagamento.findIndex((x) => x.name === d.name)])}
                    >
                      <LabelList dataKey="value" position="right" formatter={(v: number) => formatarMoeda(v)} style={{ fontSize: 10, fill: "#52525b" }} />
                      {distribuicaoFormaPagamento.map((entry, i) => {
                        const categoria = CATEGORIAS_FORMA_PAGAMENTO[i];
                        const ativa = categoria === "CARTAO_AVISTA" || categoria === "CARTAO_PARCELADO"
                          ? filterStatus[0] === "PAGO_CARTAO" && filterFormaCartao === (categoria === "CARTAO_AVISTA" ? "AVISTA" : "PARCELADO")
                          : filterStatus.length === 1 && filterStatus[0] === categoria && !filterFormaCartao;
                        const algumaAtiva = filterStatus.length === 1;
                        return <Cell key={i} fill={["#16a34a", "#dc2626", "#2563eb", "#8b5cf6", "#4f46e5"][i % 5]} opacity={algumaAtiva && !ativa ? 0.3 : 1} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Gasto por Cartão</h3>
              <div className="h-[220px] w-full">
                {gastoPorCartao.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-zinc-400">Nenhum pagamento via cartão neste período.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gastoPorCartao} layout="vertical" margin={{ left: 0, right: 65, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                      <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.2]} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip formatter={(v: number) => formatarMoeda(v)} cursor={{ fill: "rgba(79,70,229,0.06)" }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} fill="#4f46e5" cursor="pointer" onClick={(d: any) => toggleFiltroCartao(d.name)}>
                        <LabelList dataKey="value" position="right" formatter={(v: number) => formatarMoeda(v)} style={{ fontSize: 10, fill: "#52525b" }} />
                        {gastoPorCartao.map((entry, i) => (
                          <Cell key={i} fill="#4f46e5" opacity={filterCartao && filterCartao !== entry.name ? 0.3 : 1} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Top Fornecedores por Nº de Lançamentos</h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topFornecedoresPorQtd} layout="vertical" margin={{ left: 0, right: 30, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                    <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.2]} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip formatter={(v: number) => `${v} lançamento(s)`} cursor={{ fill: "rgba(8,145,178,0.06)" }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} fill="#0891b2" cursor="pointer" onClick={(d: any) => toggleFiltroFornecedor(d.name)}>
                      <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: "#52525b" }} />
                      {topFornecedoresPorQtd.map((entry, i) => (
                        <Cell key={i} fill="#0891b2" opacity={filterFornecedor && filterFornecedor !== entry.name ? 0.3 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Parcelas de Cartão por Mês de Vencimento</h3>
            <p className="text-[10px] text-zinc-400 mb-2">Projeção de todas as parcelas em aberto/pagas, independente do filtro de período acima.</p>
            <div className="h-[240px] w-full">
              {parcelasPorMesVencimento.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-400">Nenhuma compra parcelada no cartão cadastrada.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={parcelasPorMesVencimento} margin={{ left: 5, right: 10, top: 20, bottom: 5 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="pendente" name="Pendente" stackId="parcela" fill="#dc2626" maxBarSize={40} />
                    <Bar dataKey="pago" name="Paga" stackId="parcela" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Pontualidade de Pagamentos</h3>
              <p className="text-[10px] text-zinc-400 mb-1">Boletos e parcelas de cartão com vencimento — mesma base da aba Faturas & Parcelamentos.</p>
              <div className="relative h-[170px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    data={[{ name: "Pontualidade", value: pontualidadePagamentos.percentual }]}
                    innerRadius="72%" outerRadius="100%" startAngle={180} endAngle={0} barSize={18}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar
                      dataKey="value"
                      cornerRadius={10}
                      background
                      fill={pontualidadePagamentos.percentual >= 80 ? "#16a34a" : pontualidadePagamentos.percentual >= 50 ? "#f59e0b" : "#dc2626"}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-6 pointer-events-none">
                  <span className="text-3xl font-black text-zinc-800 dark:text-zinc-100">{pontualidadePagamentos.percentual}%</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Em dia</span>
                </div>
              </div>
              <div className="flex justify-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /> {pontualidadePagamentos.emDia} em dia
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-600 inline-block" /> {pontualidadePagamentos.atrasado} atrasado(s)
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Comparativo Mensal entre Anos</h3>
              <div className="h-[220px] w-full">
                {comparativoAnual.anos.length < 2 ? (
                  <div className="h-full flex items-center justify-center text-xs text-zinc-400 text-center px-4">Precisa de dados de mais de um ano pra comparar.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparativoAnual.linhas} margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {comparativoAnual.anos.map((ano, i) => (
                        <Bar key={ano} dataKey={ano} name={ano} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {ehConsolidado && custosPorNatureza.length > 0 && (
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Custos por Natureza Financeira (Todas as Áreas)</h3>
              <div className="w-full" style={{ height: Math.max(220, custosPorNatureza.length * 34) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={custosPorNatureza} layout="vertical" margin={{ left: 0, right: 70, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                    <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.2]} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={200} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
                    <Bar dataKey="size" radius={[0, 4, 4, 0]} barSize={16}>
                      <LabelList dataKey="size" position="right" formatter={(v: number) => formatarMoeda(v)} style={{ fontSize: 10, fill: "#52525b" }} />
                      {custosPorNatureza.map((entry, i) => (
                        <Cell key={i} fill={entry.fill || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {(viewTab === "lancamentos" || (viewTab === "dashboard" && tabelaDashboardVisivel)) && (
      <>
      {viewTab === "dashboard" && (
        <div className="flex items-center justify-between gap-3 -mb-1">
          <p className="text-xs font-semibold text-zinc-500">Lançamentos filtrados pelo gráfico ({filteredData.length})</p>
          <button onClick={limparFiltrosGraficos} className="flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-red-500">
            <X size={12} /> Fechar lista
          </button>
        </div>
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
                {[
                  { coluna: "data", label: "Data", align: "" },
                  { coluna: "placa", label: "Placa", align: "" },
                  ...(ehConsolidado ? [{ coluna: "area", label: "Área", align: "" }] : []),
                  { coluna: "tipo", label: ehConsolidado ? "Tipo/Categoria" : areaAtiva === "MANUTENCAO" ? "Tipo" : "Categoria", align: "" },
                  { coluna: "descricao", label: "Descrição", align: "" },
                  { coluna: "fornecedor", label: "Fornecedor", align: "" },
                  { coluna: "pecas", label: mostrarGraficosVeiculo ? "Peças (R$)" : "Valor (R$)", align: "text-right" },
                  ...(mostrarGraficosVeiculo ? [{ coluna: "mao_obra", label: "Mão de Obra (R$)", align: "text-right" }] : []),
                  { coluna: "total", label: "Total (R$)", align: "text-right" },
                  { coluna: "status", label: "Status", align: "text-center" },
                  { coluna: "observacoes", label: "Observações / PC", align: "" },
                ].map((col) => (
                  <th
                    key={col.coluna}
                    onClick={() => alternarOrdenacao(col.coluna)}
                    className={cn(cellBorder, "px-3 py-2 cursor-pointer select-none hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors", col.align)}
                  >
                    <span className={cn("inline-flex items-center gap-1", col.align === "text-right" && "flex-row-reverse")}>
                      {col.label}
                      <IconeOrdenacao coluna={col.coluna} />
                    </span>
                  </th>
                ))}
                {!isVisitante && <th className={cn(cellBorder, "px-3 py-2 text-right")}>Ações</th>}
              </tr>
            </thead>
            <tbody className="text-zinc-700 dark:text-zinc-300 text-xs">
              {dadosTabela.map((c, idx) => {
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
                    <td className={cn(cellBorder, "px-3 py-2 font-mono font-bold whitespace-nowrap")}>{c.placa || "-"}</td>
                    {ehConsolidado && (
                      <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>{AREA_LABEL[c.area]}</td>
                    )}
                    <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>
                      {c.area === "MANUTENCAO"
                        ? c.tipo_manutencao
                        : (CATEGORIAS_POR_AREA[c.area].find((cat) => cat.value === c.categoria)?.label || c.categoria_outros || "-")}
                    </td>
                    <td className={cn(cellBorder, "px-3 py-2")}>{c.descricao}</td>
                    <td className={cn(cellBorder, "px-3 py-2 whitespace-nowrap")}>{c.fornecedor || "-"}</td>
                    <td className={cn(cellBorder, "px-3 py-2 text-right whitespace-nowrap")}>{formatarMoeda(Number(c.pecas))}</td>
                    {mostrarGraficosVeiculo && (
                      <td className={cn(cellBorder, "px-3 py-2 text-right whitespace-nowrap")}>{formatarMoeda(Number(c.mao_obra))}</td>
                    )}
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
                  <td className={cn(cellBorder, "px-3 py-2")} colSpan={(isVisitante ? 5 : 6) + (ehConsolidado ? 1 : 0)}>TOTAIS</td>
                  <td className={cn(cellBorder, "px-3 py-2 text-right")}>{formatarMoeda(somaRodape.pecas)}</td>
                  {mostrarGraficosVeiculo && (
                    <td className={cn(cellBorder, "px-3 py-2 text-right")}>{formatarMoeda(somaRodape.maoObra)}</td>
                  )}
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
      </>
      )}

      {modalOpen && (
        <CustoModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setEditingData(null); }}
          editingData={editingData}
          area={editingData?.area || (ehConsolidado ? "MANUTENCAO" : areaAtiva)}
          equipamentos={equipamentos}
          fornecedores={fornecedores}
          isOnline={isOnline}
          parcelasExistentes={editingData ? parcelas.filter((p) => p.custo_id === editingData.id) : []}
        />
      )}

      {fornecedorModalOpen && (
        <FornecedorModal
          isOpen={fornecedorModalOpen}
          onClose={() => { setFornecedorModalOpen(false); setEditingFornecedor(null); }}
          editingData={editingFornecedor}
          isOnline={isOnline}
        />
      )}

      {importExportOpen && (
        <ImportExportModal
          isOpen={importExportOpen}
          onClose={() => setImportExportOpen(false)}
          filteredData={filteredData}
          kpis={kpis}
          area={ehConsolidado ? "MANUTENCAO" : areaAtiva}
        />
      )}
    </div>
  );
}
