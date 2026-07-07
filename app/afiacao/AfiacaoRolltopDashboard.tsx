"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Calendar, RefreshCw } from "lucide-react";
import { extrairLinhas } from "./PlanilhaLancamentos";

interface RolltopDashboardProps {
  afiacoes: any[];
  auxiliares: any[];
}

export default function AfiacaoRolltopDashboard({ afiacoes, auxiliares }: RolltopDashboardProps) {
  // ── Estados de Filtros ──
  const [filtroCliente, setFiltroCliente] = useState("Todos");
  const [filtroUnidade, setFiltroUnidade] = useState("Todos");
  const [filtroMaquina, setFiltroMaquina] = useState("Todos");
  const [filtroKit, setFiltroKit] = useState("Todos");
  const [filtroLetra, setFiltroLetra] = useState("Todos");
  
  // Datas de início e fim
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  // Módulos Selecionados
  const [modulosSelecionados, setModulosSelecionados] = useState<string[]>([]);

  // ── Extrair Valores Únicos a partir do Banco ──
  const parsedData = useMemo(() => {
    return afiacoes.flatMap((a) => {
      const rows = extrairLinhas(a, auxiliares);
      return rows.map((r) => {
        const moduloStr = String(r.modulo || "").toUpperCase().trim();
        const unidade = moduloStr.replace(/[0-9]/g, "") || "MA";

        const isRolltop = r.codigo === "15";
        const isSabre = ["16", "17", "18", "21", "23"].includes(r.codigo);

        const tipoForm = String(a.tipo_formulario || "").trim();
        const isRecebimento = tipoForm.includes("RECEBIMENTO");

        return {
          id: a.id,
          cliente: "SUZANO",
          unidade,
          maquina: r.equipamento || "DESCONHECIDA",
          modulo: moduloStr,
          kit: String(r.kit || "1").trim(),
          letra: String(r.letra || "A").trim().toUpperCase(),
          data: a.data ? a.data.split("T")[0] : "", // YYYY-MM-DD
          isRolltop,
          isSabre,
          isRecebimento,
          codMotivo: r.codMotivo || "",
          motivo: r.motivo || "",
          // O card 1 mostra REC. SABRE no power bi de rolltop, calculamos as expedidas de sabre
          qtdExpedidaSabre: isSabre && isRecebimento ? r.qtdExpedida : 0,
          qtdBaixaRolltop: isRolltop && !isRecebimento ? r.qtdBaixa : 0,
        };
      });
    });
  }, [afiacoes, auxiliares]);

  // Inicializar datas com min/max das datas disponíveis
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

  // Módulos disponíveis para Rolltop (baseados em baixas de rolltop ou dados gerais)
  const todosModulos = useMemo(() => {
    const list = Array.from(new Set(parsedData.map((d) => d.modulo).filter(Boolean)));
    return list.sort();
  }, [parsedData]);

  useEffect(() => {
    if (todosModulos.length > 0 && modulosSelecionados.length === 0) {
      setModulosSelecionados(todosModulos);
    }
  }, [todosModulos]);

  // Listas de opções
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

  // ── Filtrar Dados ──
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

  // ── Estatísticas do Dashboard de Rolltop ──
  const stats = useMemo(() => {
    let recSabre = 0; // Card 1 (REC. SABRE)
    let descAplicRolltop = 0; // Card 2 (DESC. / APLIC. ROLLTOP)
    let descLubrificacao = 0; // Card 3 (DESC. / LUBRIFICAÇÃO)
    let descQuebra = 0; // Card 4 (DESC. / QUEBRA)

    // Detalhamento dos motivos de descarte para Rolltop
    let descarteQuebra = 0;
    let descarteMalUso = 0;
    let descartePerda = 0;
    let descarteTorcao = 0;
    let descarteLubrificacao = 0;
    let descarteAcidente = 0;

    // Mapas para agrupamento por máquina para cada motivo
    const machineQuebraMap: Record<string, number> = {};
    const machineMalUsoMap: Record<string, number> = {};
    const machinePerdaMap: Record<string, number> = {};
    const machineTorcaoMap: Record<string, number> = {};
    const machineLubrificacaoMap: Record<string, number> = {};
    const machineAcidenteMap: Record<string, number> = {};

    // Baixas por Módulo
    const baixasPorModuloMap: Record<string, number> = {};

    for (const d of filteredData) {
      // Somar recebimentos de sabre para o card 1
      recSabre += d.qtdExpedidaSabre;

      if (d.isRolltop && !d.isRecebimento) {
        descAplicRolltop += d.qtdBaixaRolltop;

        // Módulo
        baixasPorModuloMap[d.modulo] = (baixasPorModuloMap[d.modulo] || 0) + d.qtdBaixaRolltop;

        // Classificar por motivo
        const cod = String(d.codMotivo).toUpperCase().trim();
        const mot = String(d.motivo).toUpperCase().trim();

        if (cod === "C" || mot === "QUEBRA") {
          descQuebra += d.qtdBaixaRolltop;
          descarteQuebra += d.qtdBaixaRolltop;
          machineQuebraMap[d.maquina] = (machineQuebraMap[d.maquina] || 0) + d.qtdBaixaRolltop;
        } else if (cod === "A" || mot === "MAL USO") {
          descarteMalUso += d.qtdBaixaRolltop;
          machineMalUsoMap[d.maquina] = (machineMalUsoMap[d.maquina] || 0) + d.qtdBaixaRolltop;
        } else if (cod === "B" || mot === "PERDA") {
          descartePerda += d.qtdBaixaRolltop;
          machinePerdaMap[d.maquina] = (machinePerdaMap[d.maquina] || 0) + d.qtdBaixaRolltop;
        } else if (cod === "G" || mot === "TORÇÃO") {
          descarteTorcao += d.qtdBaixaRolltop;
          machineTorcaoMap[d.maquina] = (machineTorcaoMap[d.maquina] || 0) + d.qtdBaixaRolltop;
        } else if (cod === "D" || mot === "LUBRIFICAÇÃO") {
          descLubrificacao += d.qtdBaixaRolltop;
          descarteLubrificacao += d.qtdBaixaRolltop;
          machineLubrificacaoMap[d.maquina] = (machineLubrificacaoMap[d.maquina] || 0) + d.qtdBaixaRolltop;
        } else if (cod === "F" || mot === "ACIDENTE") {
          descarteAcidente += d.qtdBaixaRolltop;
          machineAcidenteMap[d.maquina] = (machineAcidenteMap[d.maquina] || 0) + d.qtdBaixaRolltop;
        }
      }
    }

    // Helper de conversão para array ordenado
    const toSortedArray = (map: Record<string, number>) => {
      return Object.entries(map)
        .map(([maquina, valor]) => ({ maquina, valor }))
        .sort((a, b) => b.valor - a.valor);
    };

    return {
      recSabre,
      descAplicRolltop,
      descLubrificacao,
      descQuebra,

      descarteQuebra,
      descarteMalUso,
      descartePerda,
      descarteTorcao,
      descarteLubrificacao,
      descarteAcidente,

      baixasPorModulo: Object.entries(baixasPorModuloMap).map(([modulo, valor]) => ({ modulo, valor })),

      quebraByMachine: toSortedArray(machineQuebraMap),
      malUsoByMachine: toSortedArray(machineMalUsoMap),
      perdaByMachine: toSortedArray(machinePerdaMap),
      torcaoByMachine: toSortedArray(machineTorcaoMap),
      lubrificacaoByMachine: toSortedArray(machineLubrificacaoMap),
      acidenteByMachine: toSortedArray(machineAcidenteMap),
    };
  }, [filteredData]);

  // Max valor para módulo
  const maxBaixaModulo = useMemo(() => {
    if (stats.baixasPorModulo.length === 0) return 1;
    return Math.max(...stats.baixasPorModulo.map(b => b.valor), 1);
  }, [stats]);

  // Max valor para motivos
  const maxMotivoDescarte = useMemo(() => {
    return Math.max(stats.descarteQuebra, stats.descarteMalUso, stats.descartePerda, stats.descarteTorcao, stats.descAplicRolltop, 1);
  }, [stats]);

  // Formatação pt-BR para cartões
  const formatValueCard = (val: number) => {
    if (val === 0) return "-";
    return val.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  };

  return (
    <div 
      className="rolltop-dashboard-container space-y-6 p-6 rounded-2xl text-slate-100 shadow-xl overflow-hidden font-sans border border-slate-700/50"
      style={{ 
        backgroundImage: "url('/bg-eunaman.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      
      {/* ── Bloco de Estilo Scoped para Forçar Contraste das Letras ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        .rolltop-dashboard-container select,
        .rolltop-dashboard-container select option {
          color: #ffffff !important;
          background-color: #333333 !important;
        }
        .rolltop-dashboard-container .kpi-card-value {
          color: #ffffff !important;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        .rolltop-dashboard-container .kpi-card-label {
          color: #ffffff !important;
          opacity: 1 !important;
          font-weight: 900 !important;
        }
        .rolltop-dashboard-container .chart-title {
          color: #ffffff !important;
          font-weight: 900 !important;
          text-shadow: 0 1px 3px rgba(0,0,0,0.6);
        }
        .rolltop-dashboard-container .chart-bar-label {
          color: #ffffff !important;
          font-weight: 700 !important;
        }
        .rolltop-dashboard-container .status-card-title {
          color: #ffffff !important;
          font-weight: 900 !important;
        }
        .rolltop-dashboard-container .status-card-value {
          color: #ffffff !important;
          font-weight: 950 !important;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
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

        {/* Lado Direito: Caixa de Filtros */}
        <div className="flex-1 bg-black/75 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-5 shadow-2xl">
          
          {/* Título Principal */}
          <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-700/60">
            <div className="w-10"></div>
            <h1 className="text-center text-3xl font-black text-white uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
              RESUMO DE ROLLTOP
            </h1>
            
            <button
              onClick={handleLimparFiltros}
              className="flex items-center gap-1 px-2.5 py-1 border border-slate-600 bg-slate-900/80 hover:bg-slate-800 text-white rounded text-[10px] font-black uppercase tracking-wider transition-all"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              Limpar
            </button>
          </div>

          {/* Grid de Dropdowns */}
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

            {/* PERIODO */}
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

          {/* Slicer de Módulos */}
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
                          ? "bg-[#00b050] text-white"
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

      {/* ── Cartões de Métrica ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Card 1: REC. SABRE (Verde) */}
        <div className="bg-[#00b050] py-6 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-5xl font-black tracking-tight">
            {formatValueCard(stats.recSabre)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            REC. SABRE
          </span>
        </div>

        {/* Card 2: DESC. / APLIC. ROLLTOP (Vermelho) */}
        <div className="bg-[#d9534f] py-6 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-5xl font-black tracking-tight">
            {formatValueCard(stats.descAplicRolltop)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            DESC. / APLIC. ROLLTOP
          </span>
        </div>

        {/* Card 3: DESC. / LUBRIFICAÇÃO (Azul) */}
        <div className="bg-[#007acc] py-6 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-5xl font-black tracking-tight">
            {formatValueCard(stats.descLubrificacao)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            DESC. / LUBRIFICAÇÃO
          </span>
        </div>

        {/* Card 4: DESC. / QUEBRA (Amarelo) */}
        <div className="bg-[#f1c40f] py-6 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-5xl font-black tracking-tight">
            {formatValueCard(stats.descQuebra)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            DESC. / QUEBRA
          </span>
        </div>

      </div>

      {/* ── Seção Intermediária: Ciclos e Baixas por Módulo ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Box Esquerda: Ciclos por troca de rolltop */}
        <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-5 shadow-2xl flex flex-col min-h-[220px]">
          <h3 className="chart-title text-center text-sm font-extrabold uppercase tracking-wide mb-4">
            CICLOS POR TROCA DE ROLLTOP
          </h3>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-slate-400 font-extrabold text-lg">-</span>
          </div>
        </div>

        {/* Box Direita: Baixas de Rolltop */}
        <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-5 shadow-2xl flex flex-col min-h-[220px]">
          <h3 className="chart-title text-center text-sm font-extrabold uppercase tracking-wide mb-4">
            BAIXA DE ROLLTOP
          </h3>
          
          <div className="flex-1 flex flex-col justify-center gap-3">
            {stats.baixasPorModulo.length === 0 ? (
              <div className="text-center text-slate-400 font-extrabold">Sem Dados</div>
            ) : (
              stats.baixasPorModulo.map((item) => {
                const widthPercent = (item.valor / maxBaixaModulo) * 100;
                return (
                  <div key={item.modulo} className="flex items-center gap-3">
                    <span className="chart-bar-label w-12 text-right font-mono font-bold text-xs uppercase">
                      {item.modulo}
                    </span>
                    <div className="flex-1 bg-slate-950/80 h-7 rounded overflow-hidden border border-slate-800">
                      <div 
                        className="bg-[#00b050] h-full flex items-center px-3 font-bold text-xs text-white justify-end transition-all duration-500"
                        style={{ width: `${Math.max(widthPercent, 5)}%` }}
                      >
                        {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ── Seção Inferior: Motivo de Descarte de Rolltop ── */}
      <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-5 shadow-2xl flex flex-col min-h-[220px]">
        <h3 className="chart-title text-center text-sm font-extrabold uppercase tracking-wide mb-4">
          MOTIVO DE DESCARTE DE ROLLTOP
        </h3>
        
        <div className="flex-1 flex items-end justify-center gap-6 px-4 max-w-2xl mx-auto w-full pb-2">
          
          {/* QUEBRA */}
          <div className="flex flex-col items-center flex-1">
            <span className="chart-bar-label text-[10px] font-bold mb-1">{stats.descarteQuebra}</span>
            <div className="w-full bg-slate-950/80 h-28 flex items-end rounded border border-slate-800">
              <div 
                className="bg-[#00b050] w-full rounded-t transition-all duration-500" 
                style={{ height: `${(stats.descarteQuebra / maxMotivoDescarte) * 100}%` }}
              ></div>
            </div>
            <span className="chart-bar-label text-[10px] uppercase font-black text-center mt-1.5 tracking-wider truncate w-full">QUEBRA</span>
          </div>

          {/* MAL USO */}
          <div className="flex flex-col items-center flex-1">
            <span className="chart-bar-label text-[10px] font-bold mb-1">{stats.descarteMalUso}</span>
            <div className="w-full bg-slate-950/80 h-28 flex items-end rounded border border-slate-800">
              <div 
                className="bg-[#00b050] w-full rounded-t transition-all duration-500" 
                style={{ height: `${(stats.descarteMalUso / maxMotivoDescarte) * 100}%` }}
              ></div>
            </div>
            <span className="chart-bar-label text-[10px] uppercase font-black text-center mt-1.5 tracking-wider truncate w-full">MAL USO</span>
          </div>

          {/* PERDA */}
          <div className="flex flex-col items-center flex-1">
            <span className="chart-bar-label text-[10px] font-bold mb-1">{stats.descartePerda}</span>
            <div className="w-full bg-slate-950/80 h-28 flex items-end rounded border border-slate-800">
              <div 
                className="bg-[#00b050] w-full rounded-t transition-all duration-500" 
                style={{ height: `${(stats.descartePerda / maxMotivoDescarte) * 100}%` }}
              ></div>
            </div>
            <span className="chart-bar-label text-[10px] uppercase font-black text-center mt-1.5 tracking-wider truncate w-full">PERDA</span>
          </div>

          {/* TORÇÃO */}
          <div className="flex flex-col items-center flex-1">
            <span className="chart-bar-label text-[10px] font-bold mb-1">{stats.descarteTorcao}</span>
            <div className="w-full bg-slate-950/80 h-28 flex items-end rounded border border-slate-800">
              <div 
                className="bg-[#00b050] w-full rounded-t transition-all duration-500" 
                style={{ height: `${(stats.descarteTorcao / maxMotivoDescarte) * 100}%` }}
              ></div>
            </div>
            <span className="chart-bar-label text-[10px] uppercase font-black text-center mt-1.5 tracking-wider truncate w-full">TORÇÃO</span>
          </div>

          {/* Total */}
          <div className="flex flex-col items-center flex-1">
            <span className="chart-bar-label text-[10px] font-bold mb-1">{stats.descAplicRolltop}</span>
            <div className="w-full bg-slate-950/80 h-28 flex items-end rounded border border-slate-800">
              <div 
                className="bg-[#3498db] w-full rounded-t transition-all duration-500" 
                style={{ height: `${(stats.descAplicRolltop / maxMotivoDescarte) * 100}%` }}
              ></div>
            </div>
            <span className="chart-bar-label text-[10px] uppercase font-black text-center mt-1.5 tracking-wider truncate w-full">TOTAL</span>
          </div>

        </div>
      </div>

      {/* ── Seção de Grade com Gráficos Detalhados por Máquina ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: DESC. LUBRIFICAÇÃO */}
        <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col min-h-[220px]">
          <h4 className="chart-title text-center text-xs font-black uppercase tracking-wider text-slate-350">
            DESC. LUBRIFICAÇÃO
          </h4>
          <MachineBarChart data={stats.lubrificacaoByMachine} color="#3498db" />
        </div>

        {/* Card 2: DESC. QUEBRA */}
        <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col min-h-[220px]">
          <h4 className="chart-title text-center text-xs font-black uppercase tracking-wider text-slate-350">
            DESC. QUEBRA
          </h4>
          <MachineBarChart data={stats.quebraByMachine} color="#f1c40f" />
        </div>

        {/* Card 3: DESC. MAL USO */}
        <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col min-h-[220px]">
          <h4 className="chart-title text-center text-xs font-black uppercase tracking-wider text-slate-350">
            DESC. MAL USO
          </h4>
          <MachineBarChart data={stats.malUsoByMachine} color="#d9534f" />
        </div>

        {/* Card 4: DESC. PERDA */}
        <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col min-h-[220px]">
          <h4 className="chart-title text-center text-xs font-black uppercase tracking-wider text-slate-350">
            DESC. PERDA
          </h4>
          <MachineBarChart data={stats.perdaByMachine} color="#2ecc71" />
        </div>

        {/* Card 5: DESC. ACIDENTE */}
        <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col min-h-[220px]">
          <h4 className="chart-title text-center text-xs font-black uppercase tracking-wider text-slate-350">
            DESC. ACIDENTE
          </h4>
          <MachineBarChart data={stats.acidenteByMachine} color="#9b59b6" />
        </div>

        {/* Card 6: DESC. TORÇÃO */}
        <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col min-h-[220px]">
          <h4 className="chart-title text-center text-xs font-black uppercase tracking-wider text-slate-350">
            DESC. TORÇÃO
          </h4>
          <MachineBarChart data={stats.torcaoByMachine} color="#f1c40f" />
        </div>

      </div>

    </div>
  );
}

// ── Sub-componente Interno para Plotar Gráficos por Máquina ──
interface MachineBarChartProps {
  data: { maquina: string; valor: number }[];
  color: string;
}

function MachineBarChart({ data, color }: MachineBarChartProps) {
  const maxVal = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(...data.map(d => d.valor), 1);
  }, [data]);
  
  if (data.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 font-extrabold text-xs">
        Sem Lançamentos
      </div>
    );
  }

  // Pegamos apenas as top 30 máquinas para caber no contêiner com rolagem horizontal
  const topData = data.slice(0, 30);

  return (
    <div className="flex-1 overflow-x-auto custom-scrollbar flex items-end justify-start gap-2.5 pb-2 pt-4 px-2 select-none">
      {topData.map((item) => {
        // Reduzir altura máxima para 65% para sobrar espaço para o rótulo vertical
        const heightPercent = (item.valor / maxVal) * 65;
        return (
          <div key={item.maquina} className="flex flex-col items-center shrink-0 w-8">
            <span className="text-[9px] font-bold text-white mb-0.5">{item.valor}</span>
            <div className="w-3.5 bg-slate-950/80 h-16 flex items-end rounded border border-slate-800">
              <div 
                className="w-full rounded-t transition-all duration-500" 
                style={{ height: `${Math.max(heightPercent, 5)}%`, backgroundColor: color }}
              ></div>
            </div>
            <span className="text-[8px] font-black text-slate-300 mt-2 tracking-wide uppercase [writing-mode:vertical-lr] rotate-180 h-12 truncate text-center">
              {item.maquina}
            </span>
          </div>
        );
      })}
    </div>
  );
}
