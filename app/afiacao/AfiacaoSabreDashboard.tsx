"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Calendar, RefreshCw } from "lucide-react";
import { extrairLinhas } from "./afiacaoUtils";

interface SabreDashboardProps {
  afiacoes: any[];
  auxiliares: any[];
}

export default function AfiacaoSabreDashboard({ afiacoes, auxiliares }: SabreDashboardProps) {
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
    return (afiacoes || []).flatMap((a) => {
      const rows = extrairLinhas(a, auxiliares);
      return rows.map((r) => {
        const moduloStr = String(r.modulo || "").toUpperCase().trim();
        const unidade = moduloStr.replace(/[0-9]/g, "") || "MA";

        // Filtro por Sabre apenas: códigos 16, 17, 18, 21, 23
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
          isSabre,
          isRecebimento,
          codMotivo: r.codMotivo || "",
          motivo: r.motivo || "",
          qtdExpedida: isSabre && isRecebimento ? r.qtdExpedida : 0,
          qtdBaixa: isSabre && !isRecebimento ? r.qtdBaixa : 0,
        };
      }).filter(d => d.isSabre); // Apenas dados de sabre entram nesse dashboard
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

  // Inicializar todos os módulos disponíveis
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

  // ── Estatísticas do Dashboard de Sabre ──
  const stats = useMemo(() => {
    let recSabre = 0;
    let descAplicSabre = 0;
    let descLubrificacao = 0;
    let descPerda = 0;

    // Detalhamento dos motivos de descarte (Baixas)
    let descartePerda = 0;
    let descarteMalUso = 0;
    let descarteQuebra = 0;
    let descarteLubrificacao = 0;
    let descarteOutros = 0;

    // Detalhamento dos estados de recebimento (Recebimentos)
    let recNormal = 0;
    let recTorcido = 0;
    let recNaoEntregue = 0;
    let recEmpenado = 0;
    let recQuebrado = 0;
    let recNaoUtilizado = 0;

    // Baixas por Módulo
    const baixasPorModuloMap: Record<string, number> = {};

    for (const d of filteredData) {
      if (d.isRecebimento) {
        recSabre += d.qtdExpedida;

        // Mapear por código de motivo do recebimento
        const cod = String(d.codMotivo).toUpperCase().trim();
        const mot = String(d.motivo).toUpperCase().trim();

        if (cod === "E" || mot === "NORMAL") recNormal += d.qtdExpedida;
        else if (cod === "B" || mot.includes("TORCIDA") || mot.includes("TORCIDO")) recTorcido += d.qtdExpedida;
        else if (cod === "J" || mot.includes("NÃO ENTREGUE")) recNaoEntregue += d.qtdExpedida;
        else if (cod === "M" || mot.includes("EMPENADO")) recEmpenado += d.qtdExpedida;
        else if (cod === "H" || mot.includes("QUEBRADA") || mot.includes("QUEBRADO")) recQuebrado += d.qtdExpedida;
        else if (cod === "K" || mot.includes("NÃO UTILIZADA") || mot.includes("NÃO UTILIZADO")) recNaoUtilizado += d.qtdExpedida;
      } else {
        descAplicSabre += d.qtdBaixa;

        // Somar baixas por modulo
        baixasPorModuloMap[d.modulo] = (baixasPorModuloMap[d.modulo] || 0) + d.qtdBaixa;

        // Mapear por motivo do descarte
        const cod = String(d.codMotivo).toUpperCase().trim();
        const mot = String(d.motivo).toUpperCase().trim();

        if (cod === "B" || mot === "PERDA") {
          descPerda += d.qtdBaixa;
          descartePerda += d.qtdBaixa;
        } else if (cod === "A" || mot === "MAL USO") {
          descarteMalUso += d.qtdBaixa;
        } else if (cod === "C" || mot === "QUEBRA") {
          descarteQuebra += d.qtdBaixa;
        } else if (cod === "D" || mot === "LUBRIFICAÇÃO") {
          descLubrificacao += d.qtdBaixa;
          descarteLubrificacao += d.qtdBaixa;
        } else {
          descarteOutros += d.qtdBaixa;
        }
      }
    }

    return {
      recSabre,
      descAplicSabre,
      descLubrificacao,
      descPerda,

      descartePerda,
      descarteMalUso,
      descarteQuebra,
      descarteLubrificacao,
      descarteOutros,

      recNormal,
      recTorcido,
      recNaoEntregue,
      recEmpenado,
      recQuebrado,
      recNaoUtilizado,

      baixasPorModulo: Object.entries(baixasPorModuloMap).map(([modulo, valor]) => ({ modulo, valor })),
    };
  }, [filteredData]);

  // Encontrar o maior valor para dimensionar as barras do gráfico de módulo
  const maxBaixaModulo = useMemo(() => {
    if (stats.baixasPorModulo.length === 0) return 1;
    return Math.max(...stats.baixasPorModulo.map(b => b.valor), 1);
  }, [stats]);

  // Maior valor para dimensionar as colunas do gráfico de motivos
  const maxMotivoDescarte = useMemo(() => {
    return Math.max(stats.descartePerda, stats.descarteMalUso, stats.descarteQuebra, stats.descAplicSabre, 1);
  }, [stats]);

  // Formatação pt-BR para os cartões
  const formatValueCard = (val: number) => {
    if (val === 0) return "-";
    return val.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  };

  return (
    <div 
      className="sabre-dashboard-container space-y-6 p-6 rounded-2xl text-slate-100 shadow-xl overflow-hidden font-sans border border-slate-700/50"
      style={{ 
        backgroundImage: "url('/bg-eunaman.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      
      {/* ── Bloco de Estilo Scoped para Forçar Contraste das Letras ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        .sabre-dashboard-container select,
        .sabre-dashboard-container select option {
          color: #ffffff !important;
          background-color: #333333 !important;
        }
        .sabre-dashboard-container .kpi-card-value {
          color: #ffffff !important;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        .sabre-dashboard-container .kpi-card-label {
          color: #ffffff !important;
          opacity: 1 !important;
          font-weight: 900 !important;
        }
        .sabre-dashboard-container .chart-title {
          color: #ffffff !important;
          font-weight: 900 !important;
          text-shadow: 0 1px 3px rgba(0,0,0,0.6);
        }
        .sabre-dashboard-container .chart-bar-label {
          color: #ffffff !important;
          font-weight: 700 !important;
        }
        .sabre-dashboard-container .status-card-title {
          color: #ffffff !important;
          font-weight: 900 !important;
        }
        .sabre-dashboard-container .status-card-value {
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
              RESUMO DE SABRE
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

      {/* ── Cartões de Métrica (Row com 4 Cards) ── */}
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

        {/* Card 2: DESC. / APLIC. SABRE (Vermelho) */}
        <div className="bg-[#d9534f] py-6 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-5xl font-black tracking-tight">
            {formatValueCard(stats.descAplicSabre)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            DESC. / APLIC. SABRE
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

        {/* Card 4: DESC. / PERDA (Amarelo) */}
        <div className="bg-[#f1c40f] py-6 px-4 rounded-2xl border border-black shadow-md flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-transform duration-200 min-h-[120px]">
          <span className="kpi-card-value text-5xl font-black tracking-tight">
            {formatValueCard(stats.descPerda)}
          </span>
          <span className="kpi-card-label text-[10px] sm:text-xs font-black uppercase tracking-wider mt-2">
            DESC. / PERDA
          </span>
        </div>

      </div>

      {/* ── Seção Intermediária: Ciclos e Baixas por Módulo ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Box Esquerda: Ciclos por troca de sabre (Vazio/Placeholder) */}
        <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-5 shadow-2xl flex flex-col min-h-[220px]">
          <h3 className="chart-title text-center text-sm font-extrabold uppercase tracking-wide mb-4">
            CICLOS POR TROCA DE SABRE
          </h3>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-slate-400 font-extrabold text-lg">-</span>
          </div>
        </div>

        {/* Box Direita: Baixas de Sabre (Gráfico de barras horizontal por módulo) */}
        <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-5 shadow-2xl flex flex-col min-h-[220px]">
          <h3 className="chart-title text-center text-sm font-extrabold uppercase tracking-wide mb-4">
            BAIXA DE SABRE
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

      {/* ── Seção Inferior: Estado de Recebimento e Motivos de Descarte ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Box Esquerda: Estado de Recebimento de Sabre */}
        <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-5 shadow-2xl flex flex-col justify-between min-h-[220px]">
          <h3 className="chart-title text-center text-sm font-extrabold uppercase tracking-wide">
            ESTADO DE RECEBIMENTO DE SABRE
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="kpi-card-value text-5xl font-black">
              {stats.recSabre}
            </span>
            <span className="kpi-card-label text-xs uppercase tracking-wider mt-2 opacity-80">
              Total
            </span>
          </div>
        </div>

        {/* Box Direita: Motivo de Descarte de Sabre (Gráfico de colunas vertical) */}
        <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-5 shadow-2xl flex flex-col min-h-[220px]">
          <h3 className="chart-title text-center text-sm font-extrabold uppercase tracking-wide mb-4">
            MOTIVO DE DESCARTE DE SABRE
          </h3>
          
          <div className="flex-1 flex items-end justify-center gap-4 px-2">
            
            {/* Col 1: PERDA */}
            <div className="flex flex-col items-center flex-1">
              <span className="chart-bar-label text-[10px] font-bold mb-1">{stats.descartePerda}</span>
              <div className="w-full bg-slate-950/80 h-28 flex items-end rounded border border-slate-800">
                <div 
                  className="bg-[#3498db] w-full rounded-t transition-all duration-500" 
                  style={{ height: `${(stats.descartePerda / maxMotivoDescarte) * 100}%` }}
                ></div>
              </div>
              <span className="chart-bar-label text-[9px] uppercase font-black text-center mt-1.5 tracking-wider truncate w-full">PERDA</span>
            </div>

            {/* Col 2: MAL USO */}
            <div className="flex flex-col items-center flex-1">
              <span className="chart-bar-label text-[10px] font-bold mb-1">{stats.descarteMalUso}</span>
              <div className="w-full bg-slate-950/80 h-28 flex items-end rounded border border-slate-800">
                <div 
                  className="bg-[#5dade2] w-full rounded-t transition-all duration-500" 
                  style={{ height: `${(stats.descarteMalUso / maxMotivoDescarte) * 100}%` }}
                ></div>
              </div>
              <span className="chart-bar-label text-[9px] uppercase font-black text-center mt-1.5 tracking-wider truncate w-full">MAL USO</span>
            </div>

            {/* Col 3: QUEBRA */}
            <div className="flex flex-col items-center flex-1">
              <span className="chart-bar-label text-[10px] font-bold mb-1">{stats.descarteQuebra}</span>
              <div className="w-full bg-slate-950/80 h-28 flex items-end rounded border border-slate-800">
                <div 
                  className="bg-[#5dade2] w-full rounded-t transition-all duration-500" 
                  style={{ height: `${(stats.descarteQuebra / maxMotivoDescarte) * 100}%` }}
                ></div>
              </div>
              <span className="chart-bar-label text-[9px] uppercase font-black text-center mt-1.5 tracking-wider truncate w-full">QUEBRA</span>
            </div>

            {/* Col 4: Total */}
            <div className="flex flex-col items-center flex-1">
              <span className="chart-bar-label text-[10px] font-bold mb-1">{stats.descAplicSabre}</span>
              <div className="w-full bg-slate-950/80 h-28 flex items-end rounded border border-slate-800">
                <div 
                  className="bg-[#00b050] w-full rounded-t transition-all duration-500" 
                  style={{ height: `${(stats.descAplicSabre / maxMotivoDescarte) * 100}%` }}
                ></div>
              </div>
              <span className="chart-bar-label text-[9px] uppercase font-black text-center mt-1.5 tracking-wider truncate w-full">TOTAL</span>
            </div>

          </div>
        </div>

      </div>

      {/* ── Seção Inferior: Grid de 6 Cards de Estado de Recebimento de Sabre ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Coluna Esquerda */}
        <div className="space-y-4">
          
          {/* Card: NORMAL */}
          <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col items-center justify-center text-center min-h-[110px]">
            <span className="status-card-title text-[10px] font-black uppercase tracking-wider text-slate-400">
              NORMAL
            </span>
            <span className="status-card-value text-3xl font-black mt-1">
              {formatValueCard(stats.recNormal)}
            </span>
          </div>

          {/* Card: TORCIDO */}
          <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col items-center justify-center text-center min-h-[110px]">
            <span className="status-card-title text-[10px] font-black uppercase tracking-wider text-slate-400">
              TORCIDO
            </span>
            <span className="status-card-value text-3xl font-black mt-1">
              {formatValueCard(stats.recTorcido)}
            </span>
          </div>

          {/* Card: NÃO ENTREGUE */}
          <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col items-center justify-center text-center min-h-[110px]">
            <span className="status-card-title text-[10px] font-black uppercase tracking-wider text-slate-400">
              NÃO ENTREGUE
            </span>
            <span className="status-card-value text-3xl font-black mt-1">
              {formatValueCard(stats.recNaoEntregue)}
            </span>
          </div>

        </div>

        {/* Coluna Direita */}
        <div className="space-y-4">
          
          {/* Card: EMPENADO */}
          <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col items-center justify-center text-center min-h-[110px]">
            <span className="status-card-title text-[10px] font-black uppercase tracking-wider text-slate-400">
              EMPENADO
            </span>
            <span className="status-card-value text-3xl font-black mt-1">
              {formatValueCard(stats.recEmpenado)}
            </span>
          </div>

          {/* Card: QUEBRADO */}
          <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col items-center justify-center text-center min-h-[110px]">
            <span className="status-card-title text-[10px] font-black uppercase tracking-wider text-slate-400">
              QUEBRADO
            </span>
            <span className="status-card-value text-3xl font-black mt-1">
              {formatValueCard(stats.recQuebrado)}
            </span>
          </div>

          {/* Card: NÃO UTILIZADO */}
          <div className="bg-black/55 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col items-center justify-center text-center min-h-[110px]">
            <span className="status-card-title text-[10px] font-black uppercase tracking-wider text-slate-400">
              NÃO UTILIZADO
            </span>
            <span className="status-card-value text-3xl font-black mt-1">
              {formatValueCard(stats.recNaoUtilizado)}
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}
