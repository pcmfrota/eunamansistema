"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  FileText,
  FileSpreadsheet,
  Trash2,
  Edit3,
  Eye,
  X,
  Calendar,
  Truck,
  UserCheck,
  CheckCircle2,
  Copy,
  Share2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { FichaLubrificacao } from "@/src/services/LubrificacaoService";
import { gerarPDFLubrificacao } from "./LubrificacaoPDF";
import { cn } from "@/lib/utils";

interface LubrificacaoHistoricoProps {
  fichas: FichaLubrificacao[];
  onEdit?: (ficha: FichaLubrificacao) => void;
  onDuplicate?: (ficha: FichaLubrificacao) => void;
  onDelete?: (id: string) => void;
}

export function LubrificacaoHistorico({
  fichas,
  onEdit,
  onDuplicate,
  onDelete,
}: LubrificacaoHistoricoProps) {
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [filtroMecanico, setFiltroMecanico] = useState("");
  const [filtroModulo, setFiltroModulo] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  // Modal de Detalhes
  const [selectedFicha, setSelectedFicha] = useState<FichaLubrificacao | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Filtragem dos lançamentos
  const filteredFichas = useMemo(() => {
    return fichas.filter((f) => {
      const matchSearch =
        !searchTerm ||
        (f.placa && f.placa.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.mecanico_responsavel && f.mecanico_responsavel.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.modulo && f.modulo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.local_servico && f.local_servico.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchData = !filtroData || (f.data_registro && f.data_registro.startsWith(filtroData));
      const matchPlaca = !filtroPlaca || (f.placa && f.placa.toLowerCase().includes(filtroPlaca.toLowerCase()));
      const matchMecanico = !filtroMecanico || (f.mecanico_responsavel && f.mecanico_responsavel.toLowerCase().includes(filtroMecanico.toLowerCase()));
      const matchModulo = !filtroModulo || (f.modulo === filtroModulo);
      const matchCliente = !filtroCliente || (f.cliente === filtroCliente);
      const matchStatus = !filtroStatus || (f.status === filtroStatus);

      return matchSearch && matchData && matchPlaca && matchMecanico && matchModulo && matchCliente && matchStatus;
    });
  }, [fichas, searchTerm, filtroData, filtroPlaca, filtroMecanico, filtroModulo, filtroCliente, filtroStatus]);

  const handleExportExcel = () => {
    if (filteredFichas.length === 0) {
      alert("Nenhum registro para exportar.");
      return;
    }

    const dataRows = filteredFichas.map((f) => ({
      ID: f.id,
      Data: new Date(f.data_registro).toLocaleDateString("pt-BR"),
      "Hora Inicio": f.hora_inicio,
      "Hora Fim": f.hora_fim,
      Placa: f.placa,
      Modulo: f.modulo,
      "Local Servico": f.local_servico,
      Cliente: f.cliente,
      "Horimetro Inicial": f.horimetro_inicio,
      "Horimetro Final": f.horimetro_fim,
      "Horas Trabalhadas": f.horimetro_fim - f.horimetro_inicio,
      "Mecanico Responsavel": f.mecanico_responsavel,
      Ajudante: f.ajudante || "",
      Status: f.status,
      Observacoes: f.observacoes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fichas de Lubrificação");
    XLSX.writeFile(wb, `Fichas_Lubrificacao_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleOpenDetail = (f: FichaLubrificacao) => {
    setSelectedFicha(f);
    setModalOpen(true);
  };

  const handleGeneratePDF = async (f: FichaLubrificacao, modo: "download" | "share" = "download") => {
    try {
      setGeneratingPdf(true);
      await gerarPDFLubrificacao(f, modo);
    } catch (e) {
      alert("Erro ao gerar PDF da ficha.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* PAINEL DE BUSCA E FILTROS */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <Filter size={18} className="text-emerald-500" />
              Histórico & Filtros de Lançamentos
            </h3>
            <p className="text-xs text-zinc-500">Exibindo {filteredFichas.length} de {fichas.length} fichas registradas.</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-md hover:shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <FileSpreadsheet size={16} />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Linha 1 de Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-zinc-400" />
            <input
              type="text"
              placeholder="Pesquisar por placa, mecânico, local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <input
              type="date"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <input
              type="text"
              placeholder="Filtrar Placa..."
              value={filtroPlaca}
              onChange={(e) => setFiltroPlaca(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 uppercase font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <input
              type="text"
              placeholder="Filtrar Mecânico..."
              value={filtroMecanico}
              onChange={(e) => setFiltroMecanico(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

        </div>

        {/* Linha 2 de Filtros */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <select
            value={filtroModulo}
            onChange={(e) => setFiltroModulo(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">Todos os Módulos</option>
            <option value="BASE">BASE</option>
            <option value="COLHEITA">COLHEITA</option>
            <option value="SILVICULTURA">SILVICULTURA</option>
            <option value="TRANSPORTE">TRANSPORTE</option>
          </select>

          <select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">Todos os Clientes</option>
            <option value="SUZANO">SUZANO</option>
            <option value="OUTRO">OUTRO</option>
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">Todos os Status</option>
            <option value="CONCLUÍDO">CONCLUÍDO</option>
            <option value="RASCUNHO">RASCUNHO</option>
          </select>

          {(filtroData || filtroPlaca || filtroMecanico || filtroModulo || filtroCliente || filtroStatus || searchTerm) && (
            <button
              onClick={() => {
                setSearchTerm("");
                setFiltroData("");
                setFiltroPlaca("");
                setFiltroMecanico("");
                setFiltroModulo("");
                setFiltroCliente("");
                setFiltroStatus("");
              }}
              className="py-2 px-3 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-50 font-bold uppercase text-[10px]"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* TABELA PRINCIPAL DE HISTÓRICO */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-extrabold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3">Data / Hora</th>
              <th className="px-4 py-3">Equipamento / Placa</th>
              <th className="px-4 py-3">Módulo / Local</th>
              <th className="px-4 py-3 text-center">Horímetro Inic. / Fim</th>
              <th className="px-4 py-3">Mecânico Responsável</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
            {filteredFichas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-400 font-bold uppercase">
                  Nenhuma ficha de lubrificação encontrada.
                </td>
              </tr>
            ) : (
              filteredFichas.map((f) => (
                <tr key={f.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-extrabold">{new Date(f.data_registro).toLocaleDateString("pt-BR")}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{f.hora_inicio} - {f.hora_fim}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-black text-emerald-600 dark:text-emerald-400 font-mono">{f.placa}</div>
                    <div className="text-[10px] text-zinc-500 uppercase">{f.cliente || 'SUZANO'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold">{f.modulo}</div>
                    <div className="text-[10px] text-zinc-500 truncate max-w-[140px]">{f.local_servico}</div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold">
                    <div>{f.horimetro_inicio}h → {f.horimetro_fim}h</div>
                    <div className="text-[9px] text-emerald-500 font-black">+{f.horimetro_fim - f.horimetro_inicio}h trabalhado</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold">{f.mecanico_responsavel}</div>
                    {f.ajudante && <div className="text-[10px] text-zinc-400">Ajudante: {f.ajudante}</div>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase border",
                        f.status === "CONCLUÍDO"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                      )}
                    >
                      {f.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenDetail(f)}
                        className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 transition-colors"
                        title="Ver Detalhes"
                      >
                        <Eye size={15} />
                      </button>

                      <button
                        onClick={() => handleGeneratePDF(f, "download")}
                        className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                        title="Baixar PDF"
                      >
                        <FileText size={15} />
                      </button>

                      <button
                        onClick={() => handleGeneratePDF(f, "share")}
                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        title="Compartilhar PDF"
                      >
                        <Share2 size={15} />
                      </button>

                      {onDuplicate && (
                        <button
                          onClick={() => onDuplicate(f)}
                          className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors"
                          title="Duplicar Serviço"
                        >
                          <Copy size={15} />
                        </button>
                      )}

                      {onEdit && (
                        <button
                          onClick={() => onEdit(f)}
                          className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                          title="Editar Ficha"
                        >
                          <Edit3 size={15} />
                        </button>
                      )}

                      {onDelete && (
                        <button
                          onClick={() => {
                            if (confirm(`Deseja realmente excluir a ficha da placa ${f.placa}?`)) {
                              onDelete(f.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
                          title="Excluir Ficha"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DETALHADO DA FICHA SELECIONADA */}
      {modalOpen && selectedFicha && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <FileText size={20} />
                  Ficha de Lubrificação - Placa {selectedFicha.placa}
                </h3>
                <p className="text-xs text-zinc-500">
                  Data: {new Date(selectedFicha.data_registro).toLocaleDateString("pt-BR")} | Horímetro: {selectedFicha.horimetro_inicio}h → {selectedFicha.horimetro_fim}h
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGeneratePDF(selectedFicha, "download")}
                  disabled={generatingPdf}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-extrabold text-xs uppercase flex items-center gap-1.5 shadow-md hover:bg-blue-700"
                >
                  <FileText size={14} />
                  {generatingPdf ? "Gerando..." : "Baixar PDF"}
                </button>
                <button
                  onClick={() => handleGeneratePDF(selectedFicha, "share")}
                  disabled={generatingPdf}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs uppercase flex items-center gap-1.5 shadow-md hover:bg-emerald-700"
                >
                  <Share2 size={14} />
                  Compartilhar
                </button>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Conteúdo Detalhado */}
            <div className="space-y-6 text-xs">
              
              {/* Header Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-400">Mód. / Cliente</span>
                  <p className="font-bold">{selectedFicha.modulo} • {selectedFicha.cliente}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-400">Mecânico</span>
                  <p className="font-bold">{selectedFicha.mecanico_responsavel}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-400">Local</span>
                  <p className="font-bold">{selectedFicha.local_servico}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-400">Horário</span>
                  <p className="font-bold">{selectedFicha.hora_inicio} às {selectedFicha.hora_fim}</p>
                </div>
              </div>

              {/* Checklist Lubrificação */}
              <div className="space-y-2">
                <h4 className="font-black uppercase text-zinc-700 dark:text-zinc-300">Pontos de Lubrificação Inspecionados</h4>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border rounded-xl overflow-hidden">
                  {Array.isArray(selectedFicha.checklist_lubrificacao) && selectedFicha.checklist_lubrificacao.map((item: any, idx: number) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between bg-white dark:bg-zinc-900">
                      <div>
                        <p className="font-bold text-zinc-800 dark:text-zinc-200">{item.item}</p>
                        {item.observacao && <p className="text-[10px] text-zinc-500 italic">Obs: {item.observacao}</p>}
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-black uppercase",
                        item.status === "Executado" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      )}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calibragem Pneus */}
              {Array.isArray(selectedFicha.calibragem) && selectedFicha.calibragem.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-black uppercase text-zinc-700 dark:text-zinc-300">Calibragem de Pneus</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedFicha.calibragem.map((c: any, idx: number) => (
                      <div key={idx} className="p-2 border rounded-xl bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-emerald-600">{c.posicao} - {c.rotulo}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">{c.status}</span>
                        </div>
                        <div className="text-[11px] font-mono mt-1">
                          {c.pressaoMedida ?? "-"} / {c.pressaoCalibrada ?? "-"} PSI
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fotos de Evidências */}
              {(selectedFicha.fotos_antes?.length > 0 || selectedFicha.fotos_depois?.length > 0) && (
                <div className="space-y-3">
                  <h4 className="font-black uppercase text-zinc-700 dark:text-zinc-300">Fotos de Evidências (Antes & Depois)</h4>
                  
                  {selectedFicha.fotos_antes?.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Fotos Antes:</span>
                      <div className="flex gap-2 overflow-x-auto py-1">
                        {selectedFicha.fotos_antes.map((src, i) => (
                          <img key={i} src={src} className="w-20 h-20 object-cover rounded-xl border" alt="Antes" />
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedFicha.fotos_depois?.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Fotos Depois:</span>
                      <div className="flex gap-2 overflow-x-auto py-1">
                        {selectedFicha.fotos_depois.map((src, i) => (
                          <img key={i} src={src} className="w-20 h-20 object-cover rounded-xl border" alt="Depois" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Assinaturas */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                {selectedFicha.assinatura_mecanico && (
                  <div className="text-center p-2 border rounded-xl">
                    <img src={selectedFicha.assinatura_mecanico} className="h-12 mx-auto object-contain" alt="Assinatura Mecanico" />
                    <span className="text-[10px] font-bold uppercase text-zinc-500">Mecânico: {selectedFicha.mecanico_responsavel}</span>
                  </div>
                )}
                {selectedFicha.assinatura_lider && (
                  <div className="text-center p-2 border rounded-xl">
                    <img src={selectedFicha.assinatura_lider} className="h-12 mx-auto object-contain" alt="Assinatura Líder" />
                    <span className="text-[10px] font-bold uppercase text-zinc-500">Líder Manutenção</span>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
