"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { MATERIAIS_DB, ESTADO_RECEBIMENTO, TIPO_DESCARTE, buscarMaterialPorCodigo } from "./materiaisDB";
import { importarAfiacoes, excluirTodasAfiacoes, deletarAfiacao } from "./actions";

// Função para obter o número da semana a partir da data
export function getWeekNumber(d: Date) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper para obter Centro de Custo (CC) a partir da máquina
export function obterCCPorEquipamento(maquina: string): string {
  const clean = String(maquina || "").toUpperCase().trim();
  const numPart = clean.replace(/[^\d]/g, "");
  const mapping: Record<string, string> = {
    "396": "06FLIMP170", "426": "06FLIMP173", "427": "06FLIMP174",
    "431": "06FLIMP177", "432": "06FLIMP178", "434": "06FLIMP180",
    "435": "06FL1MP181", "480": "06FLIMP186", "481": "06FLIMP187",
    "482": "06FLIMP188", "483": "06FLIMP189", "654": "06FLIMP192",
    "655": "06FLIMP193", "656": "06FLIMP194", "657": "06FLIMP195",
    "658": "06FLIMP196", "659": "06FLIMP197", "546": "06FLIMP228",
    "547": "06FLIMP229", "548": "06FLIMP230", "690": "06FLIMP235"
  };
  return mapping[numPart] || "";
}

// Extrair e mapear os dados da afiação para linhas da planilha
export function extrairLinhas(afiacao: any, auxiliares: any[] = []) {
  const detalhes = afiacao.detalhes || {};
  let semana: number | string = "";
  let dataFormatada = "";

  if (afiacao.data) {
    const partes = afiacao.data.split("T")[0].split("-");
    const ano = parseInt(partes[0]);
    const m = parseInt(partes[1]);
    const dia = parseInt(partes[2]);
    const dataObj = new Date(ano, m - 1, dia, 12, 0, 0);
    semana = getWeekNumber(dataObj);
    dataFormatada = `${String(dia).padStart(2, '0')}/${String(m).padStart(2, '0')}/${ano}`;
  }

  const tipoFormulario = afiacao.tipo_formulario || "";
  const isRecebimento = tipoFormulario.includes("RECEBIMENTO");

  // ── Código do Material ──────────────────────────────────────────────────────
  // Prioriza o cod salvo diretamente no import (detalhes.cod)
  let codigoUsado = detalhes.cod || "";

  if (!codigoUsado) {
    // Derivar baseado no tipo_formulario quando não vem do import
    if (tipoFormulario === "ESTADO DE RECEBIMENTO CORRENTE" || tipoFormulario === "BAIXA DE MATERIAL CORRENTE") {
      if (detalhes.cabecote === "370E (OREGON)" || detalhes.cabecote === "370E (MAQNOVA)") codigoUsado = "13";
      else if (detalhes.cabecote === "370E (KOMATSU)") codigoUsado = "12";
      else codigoUsado = "12";
    } else if (tipoFormulario === "ESTADO DE RECEBIMENTO SABRE" || tipoFormulario === "BAIXA DE MATERIAL SABRE") {
      if (detalhes.cabecote === "370E JET FIT") codigoUsado = "16";
      else if (detalhes.cabecote === "SABRE MAQNOVA") codigoUsado = "21";
      else if (detalhes.cabecote === "KOMATSU 370E") codigoUsado = "17";
      else if (detalhes.cabecote === "SABRE ROTARY-AX") codigoUsado = "23";
      else codigoUsado = "16";
    } else if (tipoFormulario === "BAIXA DE MATERIAL ROLLTOP") {
      codigoUsado = "15";
    } else if (tipoFormulario === "BAIXA DE CHAPA MAQNOVA") {
      codigoUsado = "20";
    } else if (tipoFormulario === "BAIXA DE CHAPA ROTARY-AX") {
      codigoUsado = "40";
    } else if (tipoFormulario === "BAIXAS DE EMENDAS E BOLSAS") {
      if (detalhes.tipo_material === "EMENDA MACHO") codigoUsado = "2";
      else if (detalhes.tipo_material === "EMENDA FEMEA") codigoUsado = "3";
      else if (detalhes.tipo_material === "BOLSAS") codigoUsado = "10";
      else if (detalhes.tipo_material === "REBITE") codigoUsado = "22";
      else codigoUsado = "2";
    } else {
      codigoUsado = "12";
    }
  }

  // ── Informações do Material ─────────────────────────────────────────────────
  const matInfo = MATERIAIS_DB.find(m => m.cod === String(codigoUsado));
  const materialNome = matInfo?.material || "Material Desconhecido";
  // Preferir NI salvo no import (detalhes.ni) — fallback para materiaisDB
  const ni = detalhes.ni || matInfo?.ni || "-";
  const custoPorUnidade = matInfo?.custo || 0;

  // ── Motivo e Código do Motivo ────────────────────────────────────────────────
  let motivoStr = detalhes.motivo || "";
  let codMotivoStr = detalhes.cod_motivo || "";

  // Derivar COD MOTIVO se não especificado
  if (!codMotivoStr && motivoStr) {
    if (isRecebimento) {
      const entry = Object.entries(ESTADO_RECEBIMENTO).find(([, v]) => v === motivoStr);
      if (entry) codMotivoStr = entry[0];
    } else {
      const entry = Object.entries(TIPO_DESCARTE).find(([, v]) => v === motivoStr);
      if (entry) codMotivoStr = entry[0];
    }
  }

  // ── Qtd Expedida e Baixas ───────────────────────────────────────────────────
  const qtdExpedida = detalhes.qtd_expedida !== undefined
    ? parseFloat(String(detalhes.qtd_expedida)) || 0
    : (isRecebimento ? 1 : 0);
  const qtdBaixa = detalhes.qtd_baixas !== undefined
    ? parseFloat(String(detalhes.qtd_baixas)) || 0
    : (!isRecebimento ? (parseInt(String(detalhes.quantidade)) || 1) : 0);

  // ── Campos auxiliares ───────────────────────────────────────────────────────
  const numFicha = detalhes.num_ficha || "";
  const fichaFisica = detalhes.ficha_fisica || "OK";
  const novoVelho = detalhes.novo_velho || "NOVO";
  const carga = detalhes.carga || "1";
  const uni = detalhes.uni || "20";
  const statusBaixa = detalhes.status_baixa || "";
  const centro = detalhes.centro || "";
  const movi = detalhes.movi || "";
  const dep = detalhes.dep || "";
  const cc = detalhes.cc || obterCCPorEquipamento(afiacao.maquina);
  const custoCalculado = custoPorUnidade * (qtdBaixa || qtdExpedida || 0);

  return [{
    id: afiacao.id,
    codigo: codigoUsado,
    material: materialNome,
    equipamento: afiacao.maquina || "-",
    modulo: afiacao.modulo || "-",
    kit: afiacao.kit || "-",
    numFicha,
    fichaFisica,
    novoVelho,
    qtdExpedida,
    codMotivo: codMotivoStr,
    motivo: motivoStr,
    qtdBaixa,
    un: detalhes.un || "",
    semana,
    data: dataFormatada,
    carga,
    ni,
    cc,
    statusBaixa,
    uni,
    centro,
    movi,
    dep,
    custo: custoCalculado
  }];
}

export default function PlanilhaLancamentos({
  afiacoes,
  auxiliares = []
}: {
  afiacoes: any[];
  auxiliares?: any[];
}) {
  const [importing, setImporting] = useState(false);
  const [afiadorPadrao, setAfiadorPadrao] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ── Filtros de data ──────────────────────────────────────────────────────────
  const [filtroDia, setFiltroDia] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroAno, setFiltroAno] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const todasLinhas = useMemo(() => {
    return afiacoes.flatMap(a => extrairLinhas(a, auxiliares));
  }, [afiacoes, auxiliares]);

  // Extrair anos disponíveis para o filtro
  const anosDisponiveis = useMemo(() => {
    return Array.from(
      new Set(todasLinhas.map(r => r.data.split("/")[2]).filter(Boolean))
    ).sort((a, b) => Number(b) - Number(a));
  }, [todasLinhas]);

  // Encontrar o período inicial (min/max das datas)
  const defaultDates = useMemo(() => {
    if (todasLinhas.length === 0) return { min: "", max: "" };
    const dates = todasLinhas.map((r) => {
      if (!r.data) return "";
      const [d, m, a] = r.data.split("/");
      return `${a}-${m}-${d}`;
    }).filter(Boolean);
    if (dates.length === 0) return { min: "", max: "" };
    return {
      min: dates.reduce((min, d) => (d < min ? d : min), dates[0]),
      max: dates.reduce((max, d) => (d > max ? d : max), dates[0])
    };
  }, [todasLinhas]);

  // Inicializar datas com min/max das datas disponíveis
  useEffect(() => {
    if (defaultDates.min && defaultDates.max) {
      setFiltroDataInicio(defaultDates.min);
      setFiltroDataFim(defaultDates.max);
    }
  }, [defaultDates]);

  // Aplicar filtros
  const linhas = useMemo(() => {
    return todasLinhas.filter(row => {
      if (!row.data) return true;
      const [d, m, a] = row.data.split("/");
      const rowIso = `${a}-${m}-${d}`; // YYYY-MM-DD
  
      if (filtroDia  && d !== filtroDia.padStart(2, "0"))  return false;
      if (filtroMes  && m !== filtroMes.padStart(2, "0"))  return false;
      if (filtroAno  && a !== filtroAno)                   return false;
      if (filtroDataInicio && rowIso < filtroDataInicio) return false;
      if (filtroDataFim && rowIso > filtroDataFim) return false;
      
      return true;
    });
  }, [todasLinhas, filtroDia, filtroMes, filtroAno, filtroDataInicio, filtroDataFim]);

  const temFiltro = 
    filtroDia || 
    filtroMes || 
    filtroAno || 
    (filtroDataInicio && filtroDataInicio !== defaultDates.min) || 
    (filtroDataFim && filtroDataFim !== defaultDates.max);

  const limparFiltros = () => { 
    setFiltroDia(""); 
    setFiltroMes(""); 
    setFiltroAno(""); 
    setFiltroDataInicio(defaultDates.min);
    setFiltroDataFim(defaultDates.max);
  };  // ── Exportar para Excel ─────────────────────────────────────────────────────
  const exportToExcel = () => {
    const dataToExport = linhas.map(row => ({
      "CÓD": row.codigo,
      "Material": row.material,
      "EQUIPAMENTO": row.equipamento,
      "MÓDULO": row.modulo,
      "Nª Kit": row.kit,
      "Nª FICHA": row.numFicha,
      "FiCHA FISICA": row.fichaFisica,
      "NOVO/VELHO": row.novoVelho,
      "Qtd. Expedida": row.qtdExpedida,
      "COD. MOTIVO": row.codMotivo,
      "MOTIVO": row.motivo,
      "Qtd Baixas": row.qtdBaixa,
      "UN.": row.un,
      "SEMANA": row.semana,
      "Data": row.data,
      "Carga": row.carga,
      "NI": row.ni,
      "CC": row.cc,
      "Status Baixa": row.statusBaixa,
      "Uni": row.uni,
      "CENTRO": row.centro,
      "Movi": row.movi,
      "DEP": row.dep,
      "Custo": row.custo
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suzano Afiação");
    XLSX.writeFile(wb, "Lancamentos_Afiacao_Eunaman.xlsx");
  };

  // ── Importar Planilha ───────────────────────────────────────────────────────
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (json.length === 0) {
          alert("A planilha importada está vazia!");
          return;
        }

        const confirmar = confirm(`Deseja importar ${json.length} lançamento(s) de afiação desta planilha?`);
        if (!confirmar) return;

        const res = await importarAfiacoes(json as any[], afiadorPadrao || undefined);
        if (res.success) {
          alert(`✅ ${res.count} lançamento(s) importado(s) com sucesso!`);
          window.location.reload();
        } else {
          alert(`❌ Erro na importação: ${res.error}`);
        }
      } catch (err: any) {
        alert("Erro ao ler arquivo Excel: " + err.message);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Excluir um lançamento ───────────────────────────────────────────────────
  const handleDeleteOne = async (id: string) => {
    if (!id) return;
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;

    setDeletingId(id);
    try {
      const res = await deletarAfiacao(id);
      if (res.success) {
        alert("✅ Lançamento excluído com sucesso!");
        window.location.reload();
      } else {
        alert("❌ Erro ao excluir: " + res.error);
      }
    } catch (err: any) {
      alert("Erro inesperado: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Excluir TODOS os lançamentos ────────────────────────────────────────────
  const handleDeleteAll = async () => {
    if (!confirm("⚠️ ATENÇÃO: Deseja excluir TODOS os lançamentos da base de afiação?\n\nEsta ação não pode ser desfeita!")) return;

    setDeletingAll(true);
    try {
      const res = await excluirTodasAfiacoes();
      if (res.success) {
        alert("✅ Todos os lançamentos foram excluídos!");
        window.location.reload();
      } else {
        alert("❌ Erro ao excluir tudo: " + res.error);
      }
    } catch (err: any) {
      alert("Erro inesperado: " + err.message);
    } finally {
      setDeletingAll(false);
    }
  };

  // Lista de afiadores para dropdown
  const listaAfiadores = auxiliares.filter(a => a.category === "afiador").map(a => a.value);
  if (listaAfiadores.length === 0) {
    listaAfiadores.push(
      "KHAYNAN FERNANDES FERREIRA", "FELYPE DANIEL MACEDO VIEIRA",
      "JOSIEL DA SILVA RIBEIRO", "GEOVANE DE ARAUJO MORAES", "LUCAS PEREIRA ALVES"
    );
  }

  const MESES = [
    "","Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ];

  return (
    <div className="space-y-4">

      {/* ── Filtros de Data ── */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">🗓️ Filtrar por:</span>

        {/* Dia */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 font-semibold">Dia</label>
          <input
            type="number" min="1" max="31"
            placeholder="Ex: 7"
            value={filtroDia}
            onChange={e => setFiltroDia(e.target.value)}
            className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 outline-none font-mono"
          />
        </div>

        {/* Mês */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 font-semibold">Mês</label>
          <select
            value={filtroMes}
            onChange={e => setFiltroMes(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
          >
            <option value="">Todos</option>
            {MESES.slice(1).map((m, i) => (
              <option key={i+1} value={String(i+1).padStart(2,"0")}>{m}</option>
            ))}
          </select>
        </div>

        {/* Ano */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 font-semibold">Ano</label>
          <select
            value={filtroAno}
            onChange={e => setFiltroAno(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
          >
            <option value="">Todos</option>
            {anosDisponiveis.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Período */}
        <div className="flex items-center gap-1.5 border-l pl-3 border-gray-200">
          <label className="text-xs text-gray-500 font-semibold">Período</label>
          <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap">
            <input
              type="date"
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 outline-none w-[115px] sm:w-[120px] text-center font-mono cursor-pointer bg-white"
              value={filtroDataInicio}
              onChange={e => setFiltroDataInicio(e.target.value)}
            />
            <span className="text-gray-400 text-xs font-semibold">até</span>
            <input
              type="date"
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 outline-none w-[115px] sm:w-[120px] text-center font-mono cursor-pointer bg-white"
              value={filtroDataFim}
              onChange={e => setFiltroDataFim(e.target.value)}
            />
          </div>
        </div>

        {/* Resultado e limpar */}
        <div className="flex items-center gap-2 ml-auto">
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
            temFiltro
              ? "bg-indigo-100 text-indigo-700"
              : "bg-gray-100 text-gray-500"
          }`}>
            {temFiltro
              ? `${linhas.length} de ${todasLinhas.length} lançamento${todasLinhas.length !== 1 ? "s" : ""}`
              : `${todasLinhas.length} lançamento${todasLinhas.length !== 1 ? "s" : ""}`
            }
          </span>
          {temFiltro && (
            <button
              onClick={limparFiltros}
              className="text-xs px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg font-bold hover:bg-rose-100 transition-all"
            >
              ✕ Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Barra de Ações ── */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
            Afiador Padrão:
          </label>
          <select
            className="p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium w-full md:w-52"
            value={afiadorPadrao}
            onChange={e => setAfiadorPadrao(e.target.value)}
          >
            <option value="">(usar da planilha)</option>
            {listaAfiadores.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95"
          >
            📤 {importing ? "Importando..." : "Importar (.xlsx)"}
          </button>

          <button
            onClick={exportToExcel}
            disabled={linhas.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95"
          >
            📥 Exportar ({linhas.length})
          </button>

          <button
            onClick={handleDeleteAll}
            disabled={deletingAll || linhas.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95"
          >
            🗑️ {deletingAll ? "Excluindo..." : `Excluir Todos (${linhas.length})`}
          </button>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="overflow-x-auto w-full border border-gray-200 rounded-xl shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-[11px]">
          <thead className="bg-[#1e293b] text-white sticky top-0 z-10">
            <tr className="text-center font-bold uppercase tracking-wider">
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">CÓD</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap text-left min-w-[180px]">Material</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">EQUIPAMENTO</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">MÓDULO</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">Nª Kit</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">Nª FICHA</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">FICHA FÍSICA</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">NOVO/VELHO</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">Qtd. Expedida</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">COD. MOTIVO</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap min-w-[130px]">MOTIVO</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">Qtd Baixas</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">UN.</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">SEMANA</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">Data</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">Carga</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">NI</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">CC</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">Status Baixa</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">Uni</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">CENTRO</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">Movi</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap">DEP</th>
              <th className="px-3 py-2.5 border-r border-slate-600 whitespace-nowrap text-right pr-4">Custo</th>
              <th className="px-3 py-2.5 text-rose-400 whitespace-nowrap">Excluir</th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-100 text-center text-slate-700">
            {linhas.map((row, idx) => (
              <tr
                key={row.id || idx}
                className={`hover:bg-slate-50 transition-colors ${deletingId === row.id ? "opacity-50" : ""}`}
              >
                <td className="px-3 py-2 border-r border-gray-100 font-mono font-bold text-slate-500">{row.codigo}</td>
                <td className="px-3 py-2 border-r border-gray-100 text-left font-medium text-slate-700 leading-tight">{row.material}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-bold text-slate-800">{row.equipamento}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono">{row.modulo}</td>
                <td className="px-3 py-2 border-r border-gray-100">{row.kit}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono text-indigo-600 font-semibold text-[10px]">{row.numFicha || "-"}</td>
                <td className="px-3 py-2 border-r border-gray-100">
                  <span className={`px-2 py-0.5 rounded font-black text-[9px] ${
                    row.fichaFisica === "OK"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    {row.fichaFisica}
                  </span>
                </td>
                <td className="px-3 py-2 border-r border-gray-100">
                  <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                    row.novoVelho === "NOVO"
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}>
                    {row.novoVelho}
                  </span>
                </td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono">{row.qtdExpedida}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-bold text-slate-400">{row.codMotivo || "-"}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-semibold text-slate-600 text-left">{row.motivo || "-"}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono font-bold text-rose-600">{row.qtdBaixa}</td>
                <td className="px-3 py-2 border-r border-gray-100 text-slate-400">{row.un || "-"}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono">{row.semana}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono whitespace-nowrap">{row.data}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono">{row.carga}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono text-slate-500 text-[10px]">{row.ni}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono font-bold text-slate-600 text-[10px]">{row.cc || "-"}</td>
                <td className="px-3 py-2 border-r border-gray-100">{row.statusBaixa || "-"}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono">{row.uni}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono">{row.centro || "-"}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono">{row.movi || "-"}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono">{row.dep || "-"}</td>
                <td className="px-3 py-2 border-r border-gray-100 font-mono font-bold text-slate-800 text-right pr-4 whitespace-nowrap">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.custo)}
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={() => handleDeleteOne(row.id)}
                    disabled={deletingId === row.id}
                    className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-500 rounded-lg transition-all disabled:opacity-50 font-bold text-base"
                    title="Excluir este lançamento"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}

            {linhas.length === 0 && (
              <tr>
                <td colSpan={25} className="px-4 py-10 text-center text-gray-400 text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">📋</span>
                    <span>Nenhum lançamento encontrado.</span>
                    <span className="text-xs">Use o botão "Importar" para carregar uma planilha ou vá ao "Formulário Afiação" para cadastrar.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>

          {linhas.length > 0 && (
            <tfoot className="bg-slate-50 border-t border-gray-200 sticky bottom-0">
              <tr className="font-bold text-xs text-slate-700">
                <td colSpan={23} className="px-4 py-2.5 text-right text-slate-500 uppercase tracking-wider">
                  Total ({linhas.length} lançamento{linhas.length !== 1 ? "s" : ""}):
                </td>
                <td className="px-4 py-2.5 text-right pr-4 text-emerald-700 whitespace-nowrap text-sm">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    linhas.reduce((sum, row) => sum + (row.custo || 0), 0)
                  )}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
