"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Filter, Calendar, ChevronUp, ChevronDown, RefreshCw, BarChart2 } from "lucide-react";
import { extrairLinhas } from "./afiacaoUtils";

interface DashboardProps {
  afiacoes: any[];
  auxiliares: any[];
}

export default function AfiacaoDashboard({ afiacoes, auxiliares }: DashboardProps) {
  // ── Estados de Filtros ──
  const [filtroCliente, setFiltroCliente] = useState("Todos");
  const [filtroUnidade, setFiltroUnidade] = useState("Todos");
  const [filtroMaquina, setFiltroMaquina] = useState("Todos");
  const [filtroKit, setFiltroKit] = useState("Todos");
  const [filtroLetra, setFiltroLetra] = useState("Todos");
  
  // Datas de início e fim
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  // Módulos Selecionados (Filtro por botões estilo Slicer)
  const [modulosSelecionados, setModulosSelecionados] = useState<string[]>([]);

  // Estado de Ordenação da Tabela
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "descCorrente",
    direction: "desc",
  });

  // ── Extrair Valores Únicos para os Dropdowns a partir do Banco ──
  const parsedData = useMemo(() => {
    return (afiacoes || []).flatMap((a) => {
      const rows = extrairLinhas(a, auxiliares);
      return rows.map((r) => {
        // Encontrar unidade a partir do prefixo do modulo (ex: MA05 -> MA)
        const moduloStr = String(r.modulo || "").toUpperCase().trim();
        const unidade = moduloStr.replace(/[0-9]/g, "") || "MA";

        // Determinar "Não Entregue" baseado no motivo
        const motivoNorm = String(r.motivo || "").toUpperCase().trim();
        const isNaoEntregue = motivoNorm === "PEÇA NÃO ENTREGUE" || r.codMotivo === "J";

        const isCorrente = ["12", "13", "14"].includes(r.codigo);
        const isSabre = ["16", "17", "18", "21", "23"].includes(r.codigo);
        const isRolltop = r.codigo === "15";
        const isChapa = ["20", "40"].includes(r.codigo);
        const isEmendaMacho = r.codigo === "2";
        const isEmendaFemea = r.codigo === "3";
        const isRebite = r.codigo === "22";
        const isBolsa = ["10", "11"].includes(r.codigo);

        const tipoForm = String(a.tipo_formulario || "").trim();
        const isRecebimento = tipoForm.includes("RECEBIMENTO");

        return {
          id: a.id,
          cliente: "SUZANO", // Valor padrão conforme regra do negócio
          unidade,
          maquina: r.equipamento || "DESCONHECIDA",
          modulo: moduloStr,
          kit: String(r.kit || "1").trim(),
          letra: String(r.letra || "A").trim().toUpperCase(),
          data: a.data ? a.data.split("T")[0] : "", // YYYY-MM-DD
          custo: r.custo || 0,
          
          recebCorrente: (tipoForm === "ESTADO DE RECEBIMENTO CORRENTE" || (isRecebimento && isCorrente)) ? r.qtdExpedida : 0,
          descCorrente: (tipoForm === "BAIXA DE MATERIAL CORRENTE" || (!isRecebimento && isCorrente)) ? r.qtdExpedida : 0,
          
          recebSabre: (tipoForm === "ESTADO DE RECEBIMENTO SABRE" || (isRecebimento && isSabre)) ? r.qtdExpedida : 0,
          descSabre: (tipoForm === "BAIXA DE MATERIAL SABRE" || (!isRecebimento && isSabre)) ? r.qtdBaixa : 0,

          baixaRolltop: (tipoForm === "BAIXA DE MATERIAL ROLLTOP" || (!isRecebimento && isRolltop)) ? r.qtdBaixa : 0,
          baixaChapas: (tipoForm === "BAIXA DE CHAPA MAQNOVA" || tipoForm === "BAIXA DE CHAPA ROTARY-AX" || (!isRecebimento && isChapa)) ? r.qtdBaixa : 0,
          
          rebite: (isRebite && !isRecebimento) ? r.qtdBaixa : 0,
          emendaMacho: (isEmendaMacho && !isRecebimento) ? r.qtdBaixa : 0,
          emendaFemea: (isEmendaFemea && !isRecebimento) ? r.qtdBaixa : 0,
          bolsas: (isBolsa && !isRecebimento) ? r.qtdBaixa : 0,

          correntesNaoEntregues: (isCorrente && isRecebimento && isNaoEntregue) ? r.qtdExpedida : 0,
          sabresNaoEntregues: (isSabre && isRecebimento && isNaoEntregue) ? r.qtdExpedida : 0,
        };
      });
    });
  }, [afiacoes, auxiliares]);

  // Inicializar datas de período com min/max das datas disponíveis
  useEffect(() => {
    if (parsedData.length > 0) {
      const dates = parsedData.map((d) => d.data).filter(Boolean);
      if (dates.length > 0) {
        const minDate = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
        const maxDate = dates.reduce((max, d) => (d > max ? d : max), dates[0]);
        setFiltroDataInicio(minDate);
        setFiltroDataFim(maxDate);
      }
    }
  }, [parsedData]);

  // Inicializar todos os módulos como selecionados no primeiro carregamento
  const todosModulos = useMemo(() => {
    const list = Array.from(new Set(parsedData.map((d) => d.modulo).filter(Boolean)));
    return list.sort();
  }, [parsedData]);

  useEffect(() => {
    if (todosModulos.length > 0 && modulosSelecionados.length === 0) {
      setModulosSelecionados(todosModulos);
    }
  }, [todosModulos]);

  // Listas de opções dos filtros
  const clientesOptions = ["Todos", "SUZANO"];
  const unidadesOptions = useMemo(() => {
    const list = Array.from(new Set(parsedData.map((d) => d.unidade).filter(Boolean)));
    return ["Todos", ...list.sort()];
  }, [parsedData]);

  const maquinasOptions = useMemo(() => {
    const list = Array.from(new Set(parsedData.map((d) => d.maquina).filter(Boolean)));
    return ["Todos", ...list.sort()];
  }, [parsedData]);

  const kitsOptions = useMemo(() => {
    const list = Array.from(new Set(parsedData.map((d) => d.kit).filter(Boolean)));
    return ["Todos", ...list.sort((a, b) => Number(a) - Number(b))];
  }, [parsedData]);

  const letrasOptions = useMemo(() => {
    const list = Array.from(new Set(parsedData.map((d) => d.letra).filter(Boolean)));
    return ["Todos", ...list.sort()];
  }, [parsedData]);

  // Alternar seleção do módulo
  const handleToggleModulo = (mod: string) => {
    setModulosSelecionados((prev) => {
      if (prev.includes(mod)) {
        // Não permitir esvaziar totalmente
        if (prev.length === 1) return todosModulos;
        return prev.filter((m) => m !== mod);
      } else {
        return [...prev, mod];
      }
    });
  };

  const handleSelectTodosModulos = () => {
    setModulosSelecionados(todosModulos);
  };

  const handleLimparFiltros = () => {
    setFiltroCliente("Todos");
    setFiltroUnidade("Todos");
    setFiltroMaquina("Todos");
    setFiltroKit("Todos");
    setFiltroLetra("Todos");
    setModulosSelecionados(todosModulos);
    if (parsedData.length > 0) {
      const dates = parsedData.map((d) => d.data).filter(Boolean);
      const minDate = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
      const maxDate = dates.reduce((max, d) => (d > max ? d : max), dates[0]);
      setFiltroDataInicio(minDate);
      setFiltroDataFim(maxDate);
    }
  };

  // ── Filtrar Dados do Dashboard ──
  const filteredData = useMemo(() => {
    return parsedData.filter((d) => {
      if (filtroCliente !== "Todos" && d.cliente !== filtroCliente) return false;
      if (filtroUnidade !== "Todos" && d.unidade !== filtroUnidade) return false;
      if (filtroMaquina !== "Todos" && d.maquina !== filtroMaquina) return false;
      if (filtroKit !== "Todos" && d.kit !== filtroKit) return false;
      if (filtroLetra !== "Todos" && d.letra !== filtroLetra) return false;
      if (filtroDataInicio && d.data < filtroDataInicio) return false;
      if (filtroDataFim && d.data > filtroDataFim) return false;
      if (modulosSelecionados.length > 0 && !modulosSelecionados.includes(d.modulo)) return false;
      return true;
    });
  }, [parsedData, filtroCliente, filtroUnidade, filtroMaquina, filtroKit, filtroLetra, filtroDataInicio, filtroDataFim, modulosSelecionados]);

  // ── Calcular Somatórios dos Cartões de KPI ──
  const kpiStats = useMemo(() => {
    let recebCorrente = 0;
    let descCorrente = 0;
    let baixaRolltop = 0;
    let baixaChapas = 0;
    let recebSabre = 0;
    let descSabre = 0;
    let emendaMacho = 0;
    let emendaFemea = 0;
    let correntesNaoEntregues = 0;
    let sabresNaoEntregues = 0;
    let rebite = 0;
    let bolsas = 0;

    for (const d of filteredData) {
      recebCorrente += d.recebCorrente;
      descCorrente += d.descCorrente;
      baixaRolltop += d.baixaRolltop;
      baixaChapas += d.baixaChapas;
      recebSabre += d.recebSabre;
      descSabre += d.descSabre;
      emendaMacho += d.emendaMacho;
      emendaFemea += d.emendaFemea;
      correntesNaoEntregues += d.correntesNaoEntregues;
      sabresNaoEntregues += d.sabresNaoEntregues;
      rebite += d.rebite;
      bolsas += d.bolsas;
    }

    return {
      recebCorrente,
      descCorrente,
      baixaRolltop,
      baixaChapas,
      recebSabre,
      descSabre,
      emendaMacho,
      emendaFemea,
      correntesNaoEntregues,
      sabresNaoEntregues,
      rebite,
      bolsas,
    };
  }, [filteredData]);

  // ── Agrupamento por Máquina ──
  const machineRows = useMemo(() => {
    const map = new Map<string, any>();

    for (const d of filteredData) {
      const key = d.maquina;
      if (!map.has(key)) {
        map.set(key, {
          maquina: key,
          recebCorrente: 0,
          descCorrente: 0,
          recebSabre: 0,
          descSabre: 0,
          baixaRolltop: 0,
          baixaChapas: 0,
          rebite: 0,
          emendaMacho: 0,
          emendaFemea: 0,
          bolsas: 0,
        });
      }

      const row = map.get(key);
      row.recebCorrente += d.recebCorrente;
      row.descCorrente += d.descCorrente;
      row.recebSabre += d.recebSabre;
      row.descSabre += d.descSabre;
      row.baixaRolltop += d.baixaRolltop;
      row.baixaChapas += d.baixaChapas;
      row.rebite += d.rebite;
      row.emendaMacho += d.emendaMacho;
      row.emendaFemea += d.emendaFemea;
      row.bolsas += d.bolsas;
    }

    const arr = Array.from(map.values());

    // Ordenar os dados
    if (sortConfig.key) {
      arr.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (typeof valA === "string" && typeof valB === "string") {
          return sortConfig.direction === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        } else {
          const numA = Number(valA) || 0;
          const numB = Number(valB) || 0;
          return sortConfig.direction === "asc" ? numA - numB : numB - numA;
        }
      });
    }

    return arr;
  }, [filteredData, sortConfig]);

  // Handler de Ordenação
  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  // Helper de Renderização de Ordenação
  const renderSortIcon = (key: string) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "desc" ? (
      <ChevronDown className="w-3.5 h-3.5 inline ml-1 text-white" />
    ) : (
      <ChevronUp className="w-3.5 h-3.5 inline ml-1 text-white" />
    );
  };

  // Helper para Formatação pt-BR de números (ou exibir '-' se 0/nulo)
  const formatValueCard = (val: number) => {
    if (val === 0) return "-";
    return val.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  };

  const formatValueTableDecimal = (val: number) => {
    if (val === 0) return "";
    return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatValueTableWhole = (val: number) => {
    if (val === 0) return "";
    return val.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  };

  // Totais da tabela
  const tableTotals = useMemo(() => {
    let recebCorrente = 0;
    let descCorrente = 0;
    let recebSabre = 0;
    let descSabre = 0;
    let baixaRolltop = 0;
    let baixaChapas = 0;
    let rebite = 0;
    let emendaMacho = 0;
    let emendaFemea = 0;
    let bolsas = 0;

    for (const r of machineRows) {
      recebCorrente += r.recebCorrente;
      descCorrente += r.descCorrente;
      recebSabre += r.recebSabre;
      descSabre += r.descSabre;
      baixaRolltop += r.baixaRolltop;
      baixaChapas += r.baixaChapas;
      rebite += r.rebite;
      emendaMacho += r.emendaMacho;
      emendaFemea += r.emendaFemea;
      bolsas += r.bolsas;
    }

    return {
      recebCorrente,
      descCorrente,
      recebSabre,
      descSabre,
      baixaRolltop,
      baixaChapas,
      rebite,
      emendaMacho,
      emendaFemea,
      bolsas,
    };
  }, [machineRows]);

  return (
    <div 
      className="afiacao-dashboard-container space-y-6 p-6 rounded-2xl text-slate-100 shadow-xl overflow-hidden font-sans border border-slate-700/50"
      style={{ 
        backgroundImage: "url('/bg-eunaman.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      
      {/* ── Bloco de Estilo Scoped para Sobrescrever CSS Global (Forçando Contraste Máximo) ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        .afiacao-dashboard-container select,
        .afiacao-dashboard-container select option {
          color: #ffffff !important;
          background-color: #333333 !important;
        }
        .afiacao-dashboard-container .kpi-card-value {
          color: #ffffff !important;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        .afiacao-dashboard-container .kpi-card-label {
          color: #ffffff !important;
          opacity: 1 !important;
          font-weight: 900 !important;
        }
        .afiacao-dashboard-container table th {
          color: #ffffff !important;
          font-weight: 900 !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
        }
        .afiacao-dashboard-container table td {
          color: inherit !important;
          font-weight: 700 !important;
        }
        .afiacao-dashboard-container .plate-dark {
          color: #ffffff !important;
          background-color: #107c41 !important;
        }
        .afiacao-dashboard-container .plate-light {
          color: #1e293b !important;
          background-color: #e2f0d9 !important;
        }
        .afiacao-dashboard-container .row-odd td:not(.plate-dark) {
          color: #1e293b !important;
        }
        .afiacao-dashboard-container .row-even td:not(.plate-light) {
          color: #1e293b !important;
        }
        .afiacao-dashboard-container .footer-row td {
          color: #ffffff !important;
          font-weight: 900 !important;
        }
      `}} />
      
      {/* ── Cabeçalho e Painel de Filtros ── */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* Lado Esquerdo: Botão Voltar e Logotipo da Eunaman */}
        <div className="flex flex-col items-center lg:items-start gap-3 shrink-0 justify-center">
          <button 
            onClick={() => window.history.back()}
            className="w-10 h-10 bg-black/60 hover:bg-black/80 text-white rounded-full border border-slate-600 shadow-md flex items-center justify-center font-bold text-lg transition active:scale-95"
            title="Voltar"
          >
            ←
          </button>
          <img 
            src="/logo-eunaman-full.png" 
            alt="Eunaman Logo" 
            className="w-52 sm:w-60 h-auto drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]"
          />
        </div>

        {/* Lado Direito: Caixa de Slicers/Filtros */}
        <div className="flex-1 bg-black/75 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-5 shadow-2xl">
          
          {/* Título Principal Centrado */}
          <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-700/60">
            <div className="w-10"></div> {/* Espaçador */}
            <h1 className="text-center text-3xl font-black text-white uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
              RESUMO GERAL
            </h1>
            
            {/* Limpar filtros */}
            <button
              onClick={handleLimparFiltros}
              className="flex items-center gap-1 px-2.5 py-1 border border-slate-600 bg-slate-900/80 hover:bg-slate-800 text-white rounded text-[10px] font-black uppercase tracking-wider transition-all"
              title="Limpar Filtros"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              Limpar
            </button>
          </div>

          {/* Grid de Dropdowns de Filtro */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            
            {/* CLIENTE */}
            <div className="text-center">
              <label className="block text-xs font-bold text-white mb-1.5 uppercase tracking-wide">CLIENTE</label>
              <select
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
                className="w-full bg-[#333] border border-slate-600 hover:border-slate-500 text-white rounded px-2.5 py-1.5 text-xs text-center font-bold outline-none cursor-pointer"
              >
                {clientesOptions.map((c) => (
                  <option key={c} value={c} className="bg-[#222] text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* UNIDADE */}
            <div className="text-center">
              <label className="block text-xs font-bold text-white mb-1.5 uppercase tracking-wide">UNIDADE</label>
              <select
                value={filtroUnidade}
                onChange={(e) => setFiltroUnidade(e.target.value)}
                className="w-full bg-[#333] border border-slate-600 hover:border-slate-500 text-white rounded px-2.5 py-1.5 text-xs text-center font-bold outline-none cursor-pointer"
              >
                {unidadesOptions.map((u) => (
                  <option key={u} value={u} className="bg-[#222] text-white">
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* MÁQUINA */}
            <div className="text-center">
              <label className="block text-xs font-bold text-white mb-1.5 uppercase tracking-wide">MÁQUINA</label>
              <select
                value={filtroMaquina}
                onChange={(e) => setFiltroMaquina(e.target.value)}
                className="w-full bg-[#333] border border-slate-600 hover:border-slate-500 text-white rounded px-2.5 py-1.5 text-xs text-center font-bold outline-none cursor-pointer"
              >
                {maquinasOptions.map((m) => (
                  <option key={m} value={m} className="bg-[#222] text-white">
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* KIT */}
            <div className="text-center">
              <label className="block text-xs font-bold text-white mb-1.5 uppercase tracking-wide">KIT</label>
              <select
                value={filtroKit}
                onChange={(e) => setFiltroKit(e.target.value)}
                className="w-full bg-[#333] border border-slate-600 hover:border-slate-500 text-white rounded px-2.5 py-1.5 text-xs text-center font-bold outline-none cursor-pointer"
              >
                {kitsOptions.map((k) => (
                  <option key={k} value={k} className="bg-[#222] text-white">
                    {k === "Todos" ? "Todos" : `Kit ${k}`}
                  </option>
                ))}
              </select>
            </div>

            {/* LETRA */}
            <div className="text-center">
              <label className="block text-xs font-bold text-white mb-1.5 uppercase tracking-wide">LETRA</label>
              <select
                value={filtroLetra}
                onChange={(e) => setFiltroLetra(e.target.value)}
                className="w-full bg-[#333] border border-slate-600 hover:border-slate-500 text-white rounded px-2.5 py-1.5 text-xs text-center font-bold outline-none cursor-pointer"
              >
                {letrasOptions.map((l) => (
                  <option key={l} value={l} className="bg-[#222] text-white">
                    {l === "Todos" ? "Todos" : `Letra ${l}`}
                  </option>
                ))}
              </select>
            </div>

            {/* PERIODO (Datas Lado a Lado) */}
            <div className="text-center">
              <label className="block text-xs font-bold text-white mb-1.5 uppercase tracking-wide">PERIODO</label>
              <div className="flex items-center gap-1 justify-center flex-wrap sm:flex-nowrap">
                <input
                  type="date"
                  className="bg-[#333] border border-slate-600 text-white rounded px-2 py-1.5 text-xs font-bold text-center outline-none w-[115px] sm:w-[120px] cursor-pointer"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                />
                <input
                  type="date"
                  className="bg-[#333] border border-slate-600 text-white rounded px-2 py-1.5 text-xs font-bold text-center outline-none w-[115px] sm:w-[120px] cursor-pointer"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                />
              </div>
            </div>

          </div>

          {/* ── MÓDULO Segmented Green Bar ── */}
          {todosModulos.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-700/60 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                MÓDULO
              </p>
              <div className="flex justify-center max-w-lg mx-auto rounded-lg overflow-hidden border border-emerald-600 bg-slate-900">
                {todosModulos.map((mod, idx) => {
                  const selected = modulosSelecionados.includes(mod);
                  const isLast = idx === todosModulos.length - 1;
                  const borderClass = !isLast ? "border-r border-emerald-600" : "";

                  return (
                    <button
                      key={mod}
                      onClick={() => handleToggleModulo(mod)}
                      className={`flex-1 py-2 text-xs font-black transition-all duration-200 uppercase tracking-wide text-center ${borderClass} ${
                        selected
                          ? "bg-[#00b050] text-white hover:bg-[#009b45]"
                          : "bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                      }`}
                    >
                      {mod}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Cartões de Métrica (KPIs) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* ROW 1: Correntes e Chapas */}
        <div className="bg-[#3498db] py-5 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-4xl font-extrabold tracking-tight">
            {formatValueCard(kpiStats.recebCorrente)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            RECEB. CORRENTE
          </span>
        </div>

        <div className="bg-[#1b75bb] py-5 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-4xl font-extrabold tracking-tight">
            {formatValueCard(kpiStats.descCorrente)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            BAIXAS CORRENTE
          </span>
        </div>

        <div className="bg-[#005fa3] py-5 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-4xl font-extrabold tracking-tight">
            {formatValueCard(kpiStats.baixaRolltop)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            BAIXA ROLLTOP
          </span>
        </div>

        <div className="bg-[#007acc] py-5 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-4xl font-extrabold tracking-tight">
            {formatValueCard(kpiStats.baixaChapas)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            CHAPAS
          </span>
        </div>

        {/* ROW 2: Sabres e Emendas */}
        <div className="bg-[#2ecc71] py-5 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-4xl font-extrabold tracking-tight">
            {formatValueCard(kpiStats.recebSabre)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            RECEB. SABRE
          </span>
        </div>

        <div className="bg-[#27ae60] py-5 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-4xl font-extrabold tracking-tight">
            {formatValueCard(kpiStats.descSabre)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            BAIXAS SABRE
          </span>
        </div>

        <div className="bg-[#20a354] py-5 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-4xl font-extrabold tracking-tight">
            {formatValueCard(kpiStats.emendaMacho)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            EMEN. MACHO
          </span>
        </div>

        <div className="bg-[#107c41] py-5 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-4xl font-extrabold tracking-tight">
            {formatValueCard(kpiStats.emendaFemea)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            EMEN. FÊMEA
          </span>
        </div>

        {/* ROW 3: Pendências, Rebite e Bolsas */}
        <div className="bg-[#c0392b] py-5 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-4xl font-extrabold tracking-tight">
            {formatValueCard(kpiStats.correntesNaoEntregues)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            CORRENTES NÃO ENTREGUES
          </span>
        </div>

        <div className="bg-[#d9534f] py-5 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-4xl font-extrabold tracking-tight">
            {formatValueCard(kpiStats.sabresNaoEntregues)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            SABRES NÃO ENTREGUES
          </span>
        </div>

        <div className="bg-[#d4ac0d] py-5 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-4xl font-extrabold tracking-tight">
            {formatValueCard(kpiStats.rebite)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            REBITE
          </span>
        </div>

        <div className="bg-[#f39c12] py-5 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-4xl font-extrabold tracking-tight">
            {formatValueCard(kpiStats.bolsas)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            BOLSAS
          </span>
        </div>

      </div>

      {/* ── Tabela Principal ── */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-xs font-bold text-center border-collapse">
            
            {/* Headers da Tabela */}
            <thead className="bg-[#107c41] uppercase sticky top-0 divide-x divide-emerald-700/50">
              <tr>
                <th
                  onClick={() => requestSort("maquina")}
                  className="px-4 py-3 text-left border-r border-emerald-700 cursor-pointer hover:bg-[#0c5c30] select-none min-w-[120px]"
                >
                  MÁQUINA {renderSortIcon("maquina")}
                </th>
                <th
                  onClick={() => requestSort("recebCorrente")}
                  className="px-3 py-3 border-r border-emerald-700 cursor-pointer hover:bg-[#0c5c30] select-none"
                >
                  RECEB. CORRENTE {renderSortIcon("recebCorrente")}
                </th>
                <th
                  onClick={() => requestSort("descCorrente")}
                  className="px-3 py-3 border-r border-emerald-700 cursor-pointer hover:bg-[#0c5c30] select-none"
                >
                  DESC. CORRENTE {renderSortIcon("descCorrente")}
                </th>
                <th
                  onClick={() => requestSort("recebSabre")}
                  className="px-3 py-3 border-r border-emerald-700 cursor-pointer hover:bg-[#0c5c30] select-none"
                >
                  RECEB. SABRE {renderSortIcon("recebSabre")}
                </th>
                <th
                  onClick={() => requestSort("descSabre")}
                  className="px-3 py-3 border-r border-emerald-700 cursor-pointer hover:bg-[#0c5c30] select-none"
                >
                  DESC. SABRE {renderSortIcon("descSabre")}
                </th>
                <th
                  onClick={() => requestSort("baixaRolltop")}
                  className="px-3 py-3 border-r border-emerald-700 cursor-pointer hover:bg-[#0c5c30] select-none"
                >
                  BAIXA ROLLTOP {renderSortIcon("baixaRolltop")}
                </th>
                <th
                  onClick={() => requestSort("baixaChapas")}
                  className="px-3 py-3 border-r border-emerald-700 cursor-pointer hover:bg-[#0c5c30] select-none"
                >
                  BAIXA CHAPAS {renderSortIcon("baixaChapas")}
                </th>
                <th
                  onClick={() => requestSort("rebite")}
                  className="px-3 py-3 border-r border-emerald-700 cursor-pointer hover:bg-[#0c5c30] select-none"
                >
                  REBITE {renderSortIcon("rebite")}
                </th>
                <th
                  onClick={() => requestSort("emendaMacho")}
                  className="px-3 py-3 border-r border-emerald-700 cursor-pointer hover:bg-[#0c5c30] select-none"
                >
                  EMEN. MACHO {renderSortIcon("emendaMacho")}
                </th>
                <th
                  onClick={() => requestSort("emendaFemea")}
                  className="px-3 py-3 border-r border-emerald-700 cursor-pointer hover:bg-[#0c5c30] select-none"
                >
                  EMEN. FÊMEA {renderSortIcon("emendaFemea")}
                </th>
                <th
                  onClick={() => requestSort("bolsas")}
                  className="px-3 py-3 cursor-pointer hover:bg-[#0c5c30] select-none"
                >
                  BOLSAS {renderSortIcon("bolsas")}
                </th>
              </tr>
            </thead>

            {/* Corpo da Tabela */}
            <tbody className="divide-y divide-slate-200">
              {machineRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center text-slate-500 text-sm font-medium bg-white">
                    Nenhum dado encontrado para o período e filtros selecionados.
                  </td>
                </tr>
              ) : (
                machineRows.map((row, idx) => {
                  const isOdd = idx % 2 === 0;

                  // Linhas ímpares: Fundo Verde Claro. Linhas pares: Fundo Branco.
                  const rowClass = isOdd ? "row-odd bg-[#e2f0d9]" : "row-even bg-white";

                  // Destaque da primeira coluna (MÁQUINA):
                  const maquinaCellClass = isOdd
                    ? "plate-dark font-black"
                    : "plate-light font-black";

                  return (
                    <tr key={row.maquina} className={`transition-colors text-[11px] ${rowClass}`}>
                      
                      {/* Máquina */}
                      <td className={`px-4 py-2.5 text-left font-mono border-r border-slate-350 ${maquinaCellClass}`}>
                        {row.maquina}
                      </td>

                      {/* Decimais */}
                      <td className="px-3 py-2.5 border-r border-slate-350 font-mono">
                        {formatValueTableDecimal(row.recebCorrente)}
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-350 font-mono font-extrabold text-[#1b75bb]">
                        {formatValueTableDecimal(row.descCorrente)}
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-350 font-mono">
                        {formatValueTableDecimal(row.recebSabre)}
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-350 font-mono">
                        {formatValueTableDecimal(row.descSabre)}
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-350 font-mono">
                        {formatValueTableDecimal(row.baixaRolltop)}
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-350 font-mono">
                        {formatValueTableDecimal(row.baixaChapas)}
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-350 font-mono">
                        {formatValueTableDecimal(row.rebite)}
                      </td>

                      {/* Inteiros */}
                      <td className="px-3 py-2.5 border-r border-slate-350 font-mono">
                        {formatValueTableWhole(row.emendaMacho)}
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-350 font-mono">
                        {formatValueTableWhole(row.emendaFemea)}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {formatValueTableWhole(row.bolsas)}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Linha de Totais da Tabela */}
            {machineRows.length > 0 && (
              <tfoot className="footer-row bg-[#107c41] text-white border-t border-emerald-600 font-black text-[11px] uppercase tracking-wide sticky bottom-0">
                <tr>
                  <td className="px-4 py-3 text-left border-r border-emerald-600">Total</td>
                  <td className="px-3 py-3 border-r border-emerald-600 font-mono">
                    {formatValueTableDecimal(tableTotals.recebCorrente) || "0,00"}
                  </td>
                  <td className="px-3 py-3 border-r border-emerald-600 font-mono">
                    {formatValueTableDecimal(tableTotals.descCorrente) || "0,00"}
                  </td>
                  <td className="px-3 py-3 border-r border-emerald-600 font-mono">
                    {formatValueTableDecimal(tableTotals.recebSabre) || "0,00"}
                  </td>
                  <td className="px-3 py-3 border-r border-emerald-600 font-mono">
                    {formatValueTableDecimal(tableTotals.descSabre) || "0,00"}
                  </td>
                  <td className="px-3 py-3 border-r border-emerald-600 font-mono">
                    {formatValueTableDecimal(tableTotals.baixaRolltop) || "0,00"}
                  </td>
                  <td className="px-3 py-3 border-r border-emerald-600 font-mono">
                    {formatValueTableDecimal(tableTotals.baixaChapas) || "0,00"}
                  </td>
                  <td className="px-3 py-3 border-r border-emerald-600 font-mono">
                    {formatValueTableDecimal(tableTotals.rebite) || "0,00"}
                  </td>
                  <td className="px-3 py-3 border-r border-emerald-600 font-mono">
                    {formatValueTableWhole(tableTotals.emendaMacho) || "0"}
                  </td>
                  <td className="px-3 py-3 border-r border-emerald-600 font-mono">
                    {formatValueTableWhole(tableTotals.emendaFemea) || "0"}
                  </td>
                  <td className="px-3 py-3 font-mono">
                    {formatValueTableWhole(tableTotals.bolsas) || "0"}
                  </td>
                </tr>
              </tfoot>
            )}

          </table>
        </div>
      </div>

    </div>
  );
}
