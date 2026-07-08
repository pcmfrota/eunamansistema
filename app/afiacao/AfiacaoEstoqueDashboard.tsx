"use client";

import React, { useState, useMemo, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { extrairLinhas } from "./afiacaoUtils";

interface EstoqueDashboardProps {
  afiacoes: any[];
  auxiliares: any[];
}

interface ItemEstoque {
  item: string; // Código/NI para exibição
  descricao: string;
  ni: string;
  codigosMaterial: string[]; // Códigos de materiais associados no MATERIAIS_DB
  entradaFactor?: number; // Fator de conversão de entrada se necessário
}

export default function AfiacaoEstoqueDashboard({ afiacoes, auxiliares }: EstoqueDashboardProps) {
  // ── Filtro de Depósito ──
  const [filtroDeposito, setFiltroDeposito] = useState("AF01");

  // ── Estado do Auditado (Persistido no LocalStorage) ──
  const [auditados, setAuditados] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem("afiacao_estoque_auditados");
    if (saved) {
      try {
        setAuditados(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar auditados:", e);
      }
    } else {
      // Salvar os padrões do Power BI no localStorage na primeira execução
      const padroes = {
        "25301352": "6",
        "25301353": "379",
        "25301351": "379",
        "25045282": "153",
        "27095494": "20",
        "27104167": "1",
        "27190176": "899",
        "27076237": "24",
        "27276133": "33",
        "27274881": "108"
      };
      setAuditados(padroes);
      localStorage.setItem("afiacao_estoque_auditados", JSON.stringify(padroes));
    }
  }, []);

  const handleUpdateAuditado = (ni: string, val: string) => {
    // Sanitizar entrada para aceitar números e decimais no formato pt-BR
    const next = { ...auditados, [ni]: val };
    setAuditados(next);
    localStorage.setItem("afiacao_estoque_auditados", JSON.stringify(next));
  };

  const handleLimparAuditados = () => {
    if (confirm("Deseja limpar todos os valores auditados preenchidos?")) {
      setAuditados({});
      localStorage.removeItem("afiacao_estoque_auditados");
    }
  };

  // ── Mapeamento dos Itens Estáticos conforme Imagem do Power BI ──
  const itensDefinidos = useMemo<ItemEstoque[]>(() => [
    {
      item: "25301352-",
      descricao: "CORRENTE OREGON/18HX 370E",
      ni: "25301352-",
      codigosMaterial: ["13", "14"],
    },
    {
      item: "25301352",
      descricao: "CORRENTE OREGON/18HX V132",
      ni: "25301352",
      codigosMaterial: ["12"],
    },
    {
      item: "25301353",
      descricao: "EMENDA UNIAO OREGON/512935 MACHO",
      ni: "25301353",
      codigosMaterial: ["2"],
    },
    {
      item: "25301351",
      descricao: "EMENDA UNIAO OREGON/518853 FEMEA",
      ni: "25301351",
      codigosMaterial: ["3"],
    },
    {
      item: "25045282",
      descricao: "ESTRELA P/BARRA HARVESTER OREGON/101918 (ROLTOP)",
      ni: "25045282",
      codigosMaterial: ["15"],
    },
    {
      item: "27095494",
      descricao: "BOLSA SABRE FLORENSTEC BS1345",
      ni: "27095494",
      codigosMaterial: ["10", "11"],
    },
    {
      item: "27104167",
      descricao: "CHAPA MAQNOVA/P0239",
      ni: "27104167",
      codigosMaterial: ["20"],
    },
    {
      item: "27190176",
      descricao: "REBITE MAQNOVA",
      ni: "27190176",
      codigosMaterial: ["22"],
    },
    {
      item: "27076237",
      descricao: "SABRE MAQNOVA/P0199",
      ni: "27076237",
      codigosMaterial: ["21"],
    },
    {
      item: "27276133",
      descricao: "SABRE ROTARY-AX",
      ni: "27276133",
      codigosMaterial: ["23"],
    },
    {
      item: "27274881",
      descricao: "CHAPA ROTARY-AX (PONTEIRA)",
      ni: "27274881",
      codigosMaterial: ["40"],
    },
  ], []);

  // ── Extrair e Agrupar Dados do Banco ──
  const parsedRows = useMemo(() => {
    // Processar lançamentos
    const lines = afiacoes.flatMap((a) => {
      const rows = extrairLinhas(a, auxiliares);
      return rows.map((r) => {
        const tipoForm = String(a.tipo_formulario || "").trim();
        const isRecebimento = tipoForm.includes("RECEBIMENTO") || tipoForm === "TRANSFERÊNCIA";

        return {
          codigo: r.codigo,
          ni: r.ni,
          dep: String(r.dep || "").toUpperCase().trim() || "AF01",
          isRecebimento,
          qtdExpedida: r.qtdExpedida || 0,
          qtdBaixa: r.qtdBaixa || 0,
          status: String(a.detalhes?.status || "").toUpperCase(),
          ficha: String(a.detalhes?.ficha || "").toUpperCase()
        };
      });
    });

    // Filtrar por depósito se selecionado
    const filteredLines = lines.filter((l) => {
      if (filtroDeposito !== "Todos" && l.dep !== filtroDeposito) return false;
      return true;
    });

    // Saldos Iniciais Estáticos conforme Power BI
    const saldosIniciais: Record<string, { entrada: number; saida: number }> = {
      "25301352-": { entrada: 0, saida: 0 },
      "25301352":  { entrada: 1311.72, saida: 1309.34 },
      "25301353":  { entrada: 34002.00, saida: 33623.00 },
      "25301351":  { entrada: 28131.00, saida: 27752.00 },
      "25045282":  { entrada: 18118.00, saida: 17965.00 },
      "27095494":  { entrada: 1439.00, saida: 1419.00 },
      "27104167":  { entrada: 13140.00, saida: 13139.00 },
      "27190176":  { entrada: 31041.00, saida: 30142.00 },
      "27076237":  { entrada: 3165.00, saida: 3141.00 },
      "27276133":  { entrada: 1812.00, saida: 1779.00 },
      "27274881":  { entrada: 2915.00, saida: 2807.00 }
    };

    // Calcular Entrada e Saída para cada item da grade
    return itensDefinidos.map((it) => {
      const saldoIni = saldosIniciais[it.ni] || { entrada: 0, saida: 0 };
      let entrada = saldoIni.entrada;
      let saida = saldoIni.saida;

      for (const line of filteredLines) {
        if (it.codigosMaterial.includes(line.codigo)) {
          // Ignorar linhas de Saldo Inicial importadas para evitar contagem dupla
          const isSaldoInicial = line.status.includes("SALDO INICIAL") || line.status.includes("AUDITORIA") || line.ficha.includes("AUDITORIA");
          if (isSaldoInicial) continue;

          if (line.isRecebimento) {
            entrada += line.qtdExpedida;
          } else {
            const isCorrente = it.codigosMaterial.some(c => ["12", "13", "14"].includes(c));
            if (isCorrente) {
              saida += line.qtdExpedida;
            } else {
              saida += line.qtdBaixa;
            }
          }
        }
      }

      // Arredondar para duas casas decimais
      entrada = Math.round(entrada * 100) / 100;
      saida = Math.round(saida * 100) / 100;

      const totalEstoque = Math.round((entrada - saida) * 100) / 100;

      // Obter valor auditado do estado
      const auditadoStr = auditados[it.ni] || "";
      // Substituir vírgula por ponto para parsear corretamente
      const auditadoVal = auditadoStr ? parseFloat(auditadoStr.replace(",", ".")) : null;

      const diferenca = auditadoVal !== null ? Math.round((auditadoVal - totalEstoque) * 100) / 100 : null;

      return {
        ...it,
        entrada,
        saida,
        totalEstoque,
        auditadoStr,
        auditadoVal,
        diferenca,
      };
    });
  }, [afiacoes, auxiliares, filtroDeposito, itensDefinidos, auditados]);

  // Lista de Depósitos únicos presentes nos dados para alimentar o filtro
  const depositosDisponiveis = useMemo(() => {
    const deps = new Set<string>();
    deps.add("AF01"); // Garantir que AF01 apareça sempre
    for (const a of afiacoes) {
      const rows = extrairLinhas(a, auxiliares);
      for (const r of rows) {
        if (r.dep) {
          deps.add(String(r.dep).toUpperCase().trim());
        }
      }
    }
    return ["Todos", ...Array.from(deps).sort()];
  }, [afiacoes, auxiliares]);

  // ── Totais Gerais ──
  const totais = useMemo(() => {
    let entrada = 0;
    let saida = 0;
    let totalEstoque = 0;
    let auditado = 0;
    let diferenca = 0;
    let temAuditado = false;

    for (const r of parsedRows) {
      entrada += r.entrada;
      saida += r.saida;
      totalEstoque += r.totalEstoque;
      if (r.auditadoVal !== null) {
        auditado += r.auditadoVal;
        diferenca += r.diferenca || 0;
        temAuditado = true;
      }
    }

    return {
      entrada: Math.round(entrada * 100) / 100,
      saida: Math.round(saida * 100) / 100,
      totalEstoque: Math.round(totalEstoque * 100) / 100,
      auditado: temAuditado ? Math.round(auditado * 100) / 100 : null,
      diferenca: temAuditado ? Math.round(diferenca * 100) / 100 : null,
    };
  }, [parsedRows]);

  // Formatação pt-BR de valores decimais
  const formatDec = (val: number | null) => {
    if (val === null || val === 0) return "-";
    return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDif = (val: number | null) => {
    if (val === null) return "-";
    if (val === 0) return "-";
    return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div 
      className="estoque-dashboard-container space-y-6 p-6 rounded-2xl text-slate-100 shadow-xl overflow-hidden font-sans border border-slate-700/50"
      style={{ 
        backgroundImage: "url('/bg-eunaman.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      {/* ── Bloco de Estilo Scoped para Sobrescrever CSS Global (Forçando Contraste Máximo) ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        .estoque-dashboard-container select,
        .estoque-dashboard-container select option {
          color: #ffffff !important;
          background-color: #333333 !important;
        }
        .estoque-dashboard-container table th {
          color: #ffffff !important;
          font-weight: 900 !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
        }
        .estoque-dashboard-container table td {
          color: #1e293b !important;
          font-weight: 700 !important;
          font-size: 11px !important;
        }
        .estoque-dashboard-container .footer-row td {
          color: #ffffff !important;
          font-weight: 900 !important;
        }
        .estoque-dashboard-container input::placeholder {
          color: #94a3b8 !important;
        }
      `}} />

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch justify-between">
        
        {/* Lado Esquerdo: Logotipo da Eunaman */}
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

        {/* Lado Direito: Parâmetros Informativos de Conversão */}
        <div className="bg-black/60 backdrop-blur-sm border border-slate-700/80 rounded-xl p-3 shadow-md flex flex-col justify-center text-xs font-mono tracking-wide text-slate-300 gap-1 min-w-[200px]">
          <div className="flex justify-between border-b border-slate-700/50 pb-1">
            <span className="font-bold text-emerald-400">UN 370:</span>
            <span className="font-black text-white">0,06061</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold text-emerald-400">UN V132:</span>
            <span className="font-black text-white">0,05882</span>
          </div>
        </div>

      </div>

      {/* ── Tabela e Barra de Filtros ── */}
      <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Barra superior de Filtro e Ações */}
        <div className="bg-[#002060] px-5 py-4 border-b border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Título e Caixa de Dropdown do Depósito */}
          <div className="flex items-center gap-3">
            <div className="bg-[#0f1d3a] text-white px-4 py-1.5 rounded-lg text-xs font-black uppercase border border-slate-700 tracking-wider">
              DEPÓSITO
            </div>
            
            <select
              value={filtroDeposito}
              onChange={(e) => setFiltroDeposito(e.target.value)}
              className="bg-[#333] border border-slate-600 hover:border-slate-500 text-white rounded px-3 py-1.5 text-xs text-center font-black outline-none cursor-pointer min-w-[120px]"
            >
              {depositosDisponiveis.map((d) => (
                <option key={d} value={d} className="bg-[#222] text-white font-bold">
                  {d}
                </option>
              ))}
            </select>
          </div>

          <h2 className="text-white text-base md:text-lg font-black tracking-widest uppercase text-center sm:text-left drop-shadow-md">
            CONTROLE DE ESTOQUE EUNAMAN
          </h2>

          {/* Botão para limpar valores auditados */}
          <button
            onClick={handleLimparAuditados}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-500 bg-[#0f1d3a] hover:bg-slate-900 text-white rounded text-[10px] font-black uppercase tracking-wider transition-all"
            title="Limpar Auditados"
          >
            <RefreshCw className="w-3 h-3" />
            Limpar Auditados
          </button>
        </div>

        {/* Tabela Principal */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-xs font-bold text-center border-collapse">
            
            {/* Headers da Tabela */}
            <thead className="bg-[#002060] uppercase text-white sticky top-0 divide-x divide-blue-900/50">
              <tr className="divide-x divide-slate-400">
                <th className="px-4 py-3 text-center min-w-[100px]">ITEM</th>
                <th className="px-4 py-3 text-left min-w-[280px]">DESCRIÇÃO</th>
                <th className="px-4 py-3 text-center min-w-[100px]">NI</th>
                <th className="px-3 py-3 text-center min-w-[90px]">ENTRADA</th>
                <th className="px-3 py-3 text-center min-w-[90px]">SAÍDA</th>
                <th className="px-3 py-3 text-center bg-[#fbc02d] text-slate-900 min-w-[110px]">TOTAL ESTOQUE</th>
                <th className="px-3 py-3 text-center bg-[#7b1fa2] text-white min-w-[110px]">AUDITADO</th>
                <th className="px-3 py-3 text-center min-w-[120px]">DIFERENÇA SISTEMA</th>
              </tr>
            </thead>

            {/* Corpo da Tabela */}
            <tbody className="divide-y divide-slate-300">
              {parsedRows.map((row) => {
                return (
                  <tr 
                    key={row.ni} 
                    className="hover:bg-slate-50 transition-colors text-[11px]"
                  >
                    {/* ITEM */}
                    <td className="px-4 py-2.5 bg-[#e2f0d9] border-r border-slate-300 font-mono text-center">
                      {row.item}
                    </td>

                    {/* DESCRIÇÃO */}
                    <td className="px-4 py-2.5 bg-[#e2f0d9] border-r border-slate-300 text-left font-sans">
                      {row.descricao}
                    </td>

                    {/* NI */}
                    <td className="px-4 py-2.5 bg-[#e2f0d9] border-r border-slate-300 font-mono text-center">
                      {row.ni}
                    </td>

                    {/* ENTRADA */}
                    <td className="px-3 py-2.5 bg-[#e2f0d9] border-r border-slate-300 font-mono text-center">
                      {formatDec(row.entrada)}
                    </td>

                    {/* SAÍDA */}
                    <td className="px-3 py-2.5 bg-[#e2f0d9] border-r border-slate-300 font-mono text-center">
                      {formatDec(row.saida)}
                    </td>

                    {/* TOTAL ESTOQUE (Amarelo) */}
                    <td className="px-3 py-2.5 bg-[#fff2cc] border-r border-slate-300 font-mono font-extrabold text-slate-800 text-center">
                      {formatDec(row.totalEstoque)}
                    </td>

                    {/* AUDITADO (Editável/Input) */}
                    <td className="px-2 py-1 bg-slate-100 border-r border-slate-300 text-center">
                      <input
                        type="text"
                        value={row.auditadoStr}
                        placeholder="-"
                        onChange={(e) => handleUpdateAuditado(row.ni, e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-center font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-purple-500 shadow-sm"
                      />
                    </td>

                    {/* DIFERENÇA SISTEMA */}
                    <td className="px-3 py-2.5 bg-[#e2f0d9] border-r border-slate-300 font-mono text-center">
                      {formatDif(row.diferenca)}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Linha de Totais da Tabela */}
            <tfoot className="footer-row bg-[#107c41] text-white border-t border-emerald-600 font-black text-[11px] uppercase tracking-wide sticky bottom-0 divide-x divide-emerald-700/50">
              <tr>
                <td className="px-4 py-3 text-center" colSpan={3}>Total</td>
                
                {/* Total Entrada */}
                <td className="px-3 py-3 text-center font-mono">
                  {formatDec(totais.entrada)}
                </td>

                {/* Total Saída */}
                <td className="px-3 py-3 text-center font-mono">
                  {formatDec(totais.saida)}
                </td>

                {/* Total Estoque (Amarelo no rodapé) */}
                <td className="px-3 py-3 text-center bg-[#fbc02d] text-slate-900 font-mono">
                  {formatDec(totais.totalEstoque)}
                </td>

                {/* Total Auditado */}
                <td className="px-3 py-3 text-center bg-[#7b1fa2] text-white font-mono">
                  {formatDec(totais.auditado)}
                </td>

                {/* Total Diferença */}
                <td className="px-3 py-3 text-center font-mono">
                  {formatDif(totais.diferenca)}
                </td>
              </tr>
            </tfoot>

          </table>
        </div>

      </div>

    </div>
  );
}
