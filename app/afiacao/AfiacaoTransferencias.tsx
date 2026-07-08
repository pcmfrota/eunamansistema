"use client";

import React, { useState, useMemo, useRef } from "react";
import { Plus, Trash2, X, Calendar } from "lucide-react";
import { salvarAfiacao, deletarAfiacao } from "./actions";
import { MATERIAIS_DB, buscarMaterialPorCodigo } from "./materiaisDB";

const AFIADORES = [
  "KHAYNAN FERNANDES FERREIRA","FELYPE DANIEL MACEDO VIEIRA","JOSIEL DA SILVA RIBEIRO",
  "GEOVANE DE ARAUJO MORAES","LUCAS PEREIRA ALVES",
];

interface TransferenciasProps {
  afiacoes: any[];
  auxiliares: any[];
  onInsert: (newAfiacao: any) => void;
  onDelete: (id: string) => void;
}

export default function AfiacaoTransferencias({
  afiacoes,
  auxiliares,
  onInsert,
  onDelete,
}: TransferenciasProps) {
  // ── Estados de Exibição e Filtros ──
  const [pesquisa, setPesquisa] = useState("");
  const [filtroDeposito, setFiltroDeposito] = useState("Todos");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Estados do Formulário de Cadastro ──
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formAfiador, setFormAfiador] = useState("");
  const [formMaterialSearch, setFormMaterialSearch] = useState("");
  const [formMaterial, setFormMaterial] = useState<typeof MATERIAIS_DB[0] | null>(null);
  const [formQtd, setFormQtd] = useState("");
  const [formOrigem, setFormOrigem] = useState("SUZANO");
  const [formDestino, setFormDestino] = useState("AF01");
  const [formFicha, setFormFicha] = useState(() => "761" + Math.floor(100000 + Math.random() * 900000).toString());
  const [formStatus, setFormStatus] = useState("");

  // ── Extrair e Mapear Linhas de Transferência ──
  const transferencias = useMemo(() => {
    return afiacoes
      .filter((a) => a.tipo_formulario === "TRANSFERÊNCIA")
      .map((a) => {
        const det = a.detalhes || {};
        
        // Data formatada para exibição (DD/MM/AAAA)
        let dataExibicao = "-";
        if (a.data) {
          const partes = a.data.split("T")[0].split("-");
          dataExibicao = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }

        const qtd = parseFloat(det.qtd_expedida) || 0;

        return {
          id: a.id,
          data: a.data,
          dataExibicao,
          origem: det.origem || "INICIAL",
          destino: det.dep || det.destino || "AF01",
          quantidade: qtd,
          ficha: det.ficha || "AUDITORIA",
          afiacao: a.afiador || "CRISTIANO",
          item: det.cod || "-",
          descricao: det.desc || "-",
          ni: det.ni || "-",
          status: det.status || "REQ-AUDITORIA-SALDO INICIAL",
        };
      })
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [afiacoes]);

  // Lista de Depósitos únicos nas transferências
  const depositosDisponiveis = useMemo(() => {
    const deps = new Set<string>();
    for (const t of transferencias) {
      if (t.destino) deps.add(t.destino.toUpperCase().trim());
    }
    return ["Todos", ...Array.from(deps).sort()];
  }, [transferencias]);

  // ── Filtragem de Dados ──
  const filteredTransfers = useMemo(() => {
    return transferencias.filter((t) => {
      // Filtro Depósito
      if (filtroDeposito !== "Todos" && t.destino !== filtroDeposito) return false;

      // Filtro de Pesquisa (NI, Descrição, Ficha, Afiador)
      if (pesquisa) {
        const query = pesquisa.toLowerCase();
        const matchNi = t.ni.toLowerCase().includes(query);
        const matchDesc = t.descricao.toLowerCase().includes(query);
        const matchFicha = t.ficha.toLowerCase().includes(query);
        const matchAfiador = t.afiacao.toLowerCase().includes(query);
        return matchNi || matchDesc || matchFicha || matchAfiador;
      }

      return true;
    });
  }, [transferencias, filtroDeposito, pesquisa]);

  // Autocomplete de Materiais no Formulário
  const filteredMaterials = useMemo(() => {
    if (!formMaterialSearch) return [];
    const query = formMaterialSearch.toLowerCase();
    return MATERIAIS_DB.filter(
      (m) =>
        m.material.toLowerCase().includes(query) ||
        m.ni.toLowerCase().includes(query) ||
        m.cod.includes(query)
    ).slice(0, 5);
  }, [formMaterialSearch]);

  // ── Ações ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAfiador) {
      alert("Por favor, selecione o Afiador / Usuário.");
      return;
    }
    if (!formMaterial) {
      alert("Por favor, selecione um Material.");
      return;
    }
    if (!formQtd || parseFloat(formQtd) <= 0) {
      alert("Por favor, insira uma quantidade válida.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        data: formDate,
        afiador: formAfiador.toUpperCase(),
        modulo: "MA05",
        maquina: "ESTOQUE",
        letra: "A",
        kit: "1",
        tipo_formulario: "TRANSFERÊNCIA",
        detalhes: {
          cod: formMaterial.cod,
          ni: formMaterial.ni,
          desc: formMaterial.material,
          qtd_expedida: String(parseFloat(formQtd)),
          qtd_baixas: "0",
          dep: formDestino.toUpperCase(),
          origem: formOrigem.toUpperCase(),
          destino: formDestino.toUpperCase(),
          ficha: formFicha,
          status: formStatus || `REQ-${formFicha}-${formAfiador.split(" ")[0].toUpperCase()}`,
        },
      };

      const res = await salvarAfiacao(payload);
      if (res.success && res.data) {
        onInsert(res.data);
        setShowModal(false);
        // Resetar form
        setFormMaterial(null);
        setFormMaterialSearch("");
        setFormQtd("");
        setFormStatus("");
        setFormFicha("761" + Math.floor(100000 + Math.random() * 900000).toString());
        alert("✅ Entrada de estoque registrada com sucesso!");
      } else {
        alert("❌ Erro ao salvar: " + res.error);
      }
    } catch (err: any) {
      alert("❌ Ocorreu um erro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOne = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta entrada de transferência? Isso impactará o estoque.")) {
      return;
    }
    try {
      const res = await deletarAfiacao(id);
      if (res.success) {
        onDelete(id);
        alert("✅ Transferência excluída com sucesso!");
      } else {
        alert("❌ Erro ao excluir: " + res.error);
      }
    } catch (err: any) {
      alert("❌ Ocorreu um erro: " + err.message);
    }
  };

  // Formatação pt-BR
  const formatQtd = (val: number) => {
    return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      
      {/* ── Barra de Ações e Filtros ── */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Lado Esquerdo: Botão e Filtro de Depósito */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            REGISTRAR ENTRADA
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-semibold uppercase">DEP. DESTINO:</span>
            <select
              value={filtroDeposito}
              onChange={(e) => setFiltroDeposito(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-500"
            >
              {depositosDisponiveis.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lado Direito: Barra de Pesquisa */}
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </span>
          <input
            type="text"
            placeholder="Pesquisar por NI, descrição, ficha..."
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
          />
          {pesquisa && (
            <button
              onClick={() => setPesquisa("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

      </div>

      {/* ── Tabela de Dados (Layout do Power BI) ── */}
      <div className="bg-white border border-gray-300 rounded-2xl overflow-hidden shadow-lg">
        
        {/* Cabeçalho da Tabela */}
        <div className="bg-[#002060] px-5 py-4 border-b border-gray-300 flex items-center justify-between">
          <h2 className="text-white text-sm md:text-base font-black tracking-widest uppercase">
            PLANILHA DE TRANSFERÊNCIAS (ENTRADAS DE ESTOQUE)
          </h2>
          <span className="text-[10px] bg-blue-900 text-white font-black px-2.5 py-1 rounded-full uppercase">
            {filteredTransfers.length} Registro(s)
          </span>
        </div>

        {/* Grade de Dados */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-xs font-bold text-center border-collapse">
            
            {/* Headers */}
            <thead className="bg-[#002060] uppercase text-white sticky top-0 divide-x divide-blue-900/50">
              <tr className="divide-x divide-slate-400">
                <th className="px-3 py-3 text-center min-w-[90px] text-xs font-black text-white">DATA</th>
                <th className="px-3 py-3 text-center min-w-[90px] text-xs font-black text-white">ORIGEM</th>
                <th className="px-3 py-3 text-center min-w-[90px] text-xs font-black text-white">DESTINO</th>
                <th className="px-3 py-3 text-center min-w-[100px] text-xs font-black text-white">QUANTIDADE</th>
                <th className="px-3 py-3 text-center min-w-[110px] text-xs font-black text-white">FICHA EUNAMAN</th>
                <th className="px-3 py-3 text-left min-w-[180px] text-xs font-black text-white">AFIAÇÃO / RESP.</th>
                <th className="px-3 py-3 text-center min-w-[80px] text-xs font-black text-white">ITEM</th>
                <th className="px-4 py-3 text-left min-w-[280px] text-xs font-black text-white">DESCRIÇÃO</th>
                <th className="px-3 py-3 text-center min-w-[100px] text-xs font-black text-white">NI</th>
                <th className="px-4 py-3 text-left min-w-[240px] text-xs font-black text-white">STATUS / OBS</th>
                <th className="px-2 py-3 text-center min-w-[60px] text-xs font-black text-white">AÇÕES</th>
              </tr>
            </thead>

            {/* Linhas */}
            <tbody className="divide-y divide-slate-300">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-gray-500 font-semibold italic bg-slate-50">
                    Nenhum registro de transferência encontrado.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors text-[11px] text-[#1e293b]">
                    <td className="px-3 py-2.5 bg-slate-50/50 border-r border-slate-300 font-mono text-center">{t.dataExibicao}</td>
                    <td className="px-3 py-2.5 bg-slate-50/50 border-r border-slate-300 font-sans text-center">{t.origem}</td>
                    <td className="px-3 py-2.5 bg-slate-50/50 border-r border-slate-300 font-sans text-center">{t.destino}</td>
                    <td className="px-3 py-2.5 bg-[#e2f0d9] border-r border-slate-300 font-mono text-center text-emerald-800 font-black">{formatQtd(t.quantidade)}</td>
                    <td className="px-3 py-2.5 bg-slate-50/50 border-r border-slate-300 font-mono text-center">{t.ficha}</td>
                    <td className="px-3 py-2.5 bg-slate-50/50 border-r border-slate-300 text-left truncate font-sans max-w-[180px]">{t.afiacao}</td>
                    <td className="px-3 py-2.5 bg-slate-50/50 border-r border-slate-300 font-mono text-center">{t.item}</td>
                    <td className="px-4 py-2.5 bg-slate-50/50 border-r border-slate-300 text-left font-sans">{t.descricao}</td>
                    <td className="px-3 py-2.5 bg-slate-50/50 border-r border-slate-300 font-mono text-center">{t.ni}</td>
                    <td className="px-4 py-2.5 bg-slate-50/50 border-r border-slate-300 text-left font-sans italic text-gray-500">{t.status}</td>
                    <td className="px-2 py-2.5 text-center">
                      <button
                        onClick={() => handleDeleteOne(t.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition active:scale-95"
                        title="Excluir entrada"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

          </table>
        </div>

      </div>

      {/* ── Modal de Cadastro de Entrada de Estoque ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header Modal */}
            <div className="bg-[#002060] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-black text-sm uppercase tracking-wider">REGISTRAR ENTRADA (TRANSFERÊNCIA)</h3>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-white hover:text-gray-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-semibold text-[#1e293b]">
              
              {/* Data e Ficha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Data da Entrada *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ficha Eunaman</label>
                  <input
                    type="text"
                    required
                    value={formFicha}
                    onChange={(e) => setFormFicha(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Afiador / Usuário */}
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Afiador / Responsável *</label>
                <select
                  required
                  value={formAfiador}
                  onChange={(e) => setFormAfiador(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                >
                  <option value="">Selecione o responsável...</option>
                  {AFIADORES.map((af) => (
                    <option key={af} value={af}>
                      {af}
                    </option>
                  ))}
                </select>
              </div>

              {/* Material Dropdown Selection (Lista Suspensa) */}
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Material *</label>
                <select
                  required
                  value={formMaterial?.cod || ""}
                  onChange={(e) => {
                    const selectedCod = e.target.value;
                    const found = MATERIAIS_DB.find((m) => m.cod === selectedCod);
                    setFormMaterial(found || null);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                >
                  <option value="">Selecione o material...</option>
                  {MATERIAIS_DB.map((m) => (
                    <option key={m.cod} value={m.cod}>
                      {m.material} ({m.ni})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantidade e Origem/Destino */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Qtd Entrada *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.001"
                    placeholder="Ex: 50"
                    value={formQtd}
                    onChange={(e) => setFormQtd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Origem *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: SUZANO"
                    value={formOrigem}
                    onChange={(e) => setFormOrigem(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Destino *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: AF01"
                    value={formDestino}
                    onChange={(e) => setFormDestino(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                  />
                </div>
              </div>

              {/* Status / Observações */}
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Status / Observação</label>
                <input
                  type="text"
                  placeholder="Ex: REQ-AUDITORIA-SALDO INICIAL"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                />
              </div>

              {/* Botões do Formulário */}
              <div className="flex gap-2 justify-end pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 bg-white rounded hover:bg-slate-50 text-[11px] font-bold uppercase transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold uppercase tracking-wider transition shadow active:scale-95 disabled:bg-blue-300"
                >
                  {loading ? "Salvando..." : "Salvar Entrada"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
