"use client";

import { useState } from "react";
import AfiacaoDashboard from "./AfiacaoDashboard";
import AfiacaoCorrenteDashboard from "./AfiacaoCorrenteDashboard";
import AfiacaoSabreDashboard from "./AfiacaoSabreDashboard";
import AfiacaoRolltopDashboard from "./AfiacaoRolltopDashboard";
import AfiacaoEstoqueDashboard from "./AfiacaoEstoqueDashboard";
import AfiacaoTransferencias from "./AfiacaoTransferencias";
import AfiacaoForm from "./AfiacaoForm";
import PlanilhaLancamentos from "./PlanilhaLancamentos";
import BancoDadosAfiacao from "./BancoDadosAfiacao";
import BaseAuxiliarAfiacao from "./BaseAuxiliarAfiacao";
import { buscarAuxiliaresAfiacao } from "./actions";

export default function AfiacaoClient({
  initialAfiacoes,
  initialAuxiliares,
}: {
  initialAfiacoes: any[];
  initialAuxiliares: any[];
}) {
  const [activeTab, setActiveTab] = useState<
    "menu" | "dashboard" | "corrente" | "sabre" | "rolltop" | "estoque" | "transferencias" | "banco" | "formulario" | "planilha" | "auxiliares"
  >("menu");
  const [afiacoes, setAfiacoes] = useState(initialAfiacoes);
  const [auxiliares, setAuxiliares] = useState(initialAuxiliares);

  const handleUpdate = (updated: any) => {
    setAfiacoes((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleDelete = (id: string) => {
    setAfiacoes((prev) => prev.filter((a) => a.id !== id));
  };

  const handleInsert = (newAfiacao: any) => {
    if (newAfiacao) {
      setAfiacoes((prev) => [newAfiacao, ...prev]);
    }
  };

  const atualizarListaAuxiliares = async () => {
    const fresh = await buscarAuxiliaresAfiacao();
    setAuxiliares(fresh);
  };

  // Reorganizado conforme pedido do cliente
  const cards = [
    { key: "formulario",     label: "FORMULÁRIO AFIAÇÃO",         icon: "📝", bg: "bg-blue-600",      desc: "Cadastrar novos lançamentos de afiação e baixas manualmente." },
    { key: "transferencias", label: "TRANSFERÊNCIAS",             icon: "🔄", bg: "bg-emerald-600",   desc: "Registrar transferências e entradas de estoque (materiais novos)." },
    { key: "dashboard",      label: "DASHBOARD",                  icon: "📈", bg: "bg-indigo-600",    desc: "Resumo geral de afiações, entregas e gráficos de consumo." },
    { key: "corrente",       label: "CORRENTE",                   icon: "⛓️", bg: "bg-sky-600",       desc: "Painel de análise detalhado e relatórios de correntes." },
    { key: "sabre",          label: "SABRE",                      icon: "🪚", bg: "bg-cyan-600",      desc: "Painel de análise detalhado e relatórios de sabres." },
    { key: "rolltop",        label: "ROLLTOP",                    icon: "⭐", bg: "bg-purple-600",    desc: "Painel de análise detalhado e relatórios de rolltops." },
    { key: "estoque",        label: "CONTROLE ESTOQUE EUNAMAN",   icon: "📦", bg: "bg-amber-600",     desc: "Inventário de entradas, saídas, valores auditados e diferenças." },
    { key: "planilha",       label: "PLANILHA LANÇAMENTOS",       icon: "📊", bg: "bg-slate-600",     desc: "Grade completa de lançamentos com importador/exportador Excel." },
    { key: "banco",          label: "BANCO DE DADOS",             icon: "🗄️", bg: "bg-zinc-700",      desc: "Visualizar e gerenciar as linhas registradas diretamente no banco." },
    { key: "auxiliares",     label: "BASE AUXILIAR",              icon: "⚙️", bg: "bg-rose-700",      desc: "Cadastrar afiadores autorizados, frotas e módulos operacionais." },
  ] as const;

  return (
    <div className="w-full">
      {/* ── MENU PRINCIPAL (Cards Grid) ── */}
      {activeTab === "menu" ? (
        <div className="space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              ⚙️ Menu do Controle de Afiação
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Selecione uma das opções abaixo para gerenciar os dados ou visualizar os relatórios:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cards.map((c, index) => (
              <button
                key={c.key}
                onClick={() => setActiveTab(c.key)}
                className="group text-left border border-slate-200 rounded-2xl bg-white hover:bg-slate-50/50 p-5 shadow-sm hover:shadow-md transition-all active:scale-[0.98] flex flex-col justify-between min-h-[170px]"
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg text-white font-bold ${c.bg} shadow-sm group-hover:scale-110 transition-transform`}>
                      {c.icon}
                    </span>
                    <h3 className="font-black text-sm text-slate-800 tracking-wide uppercase leading-tight group-hover:text-blue-600 transition-colors">
                      {index + 1} - {c.label}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {c.desc}
                  </p>
                </div>
                <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-4 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Acessar Painel ➔
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── CORPO DA PÁGINA (Com cabeçalho de navegação rápido) ── */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b mb-1">
            <button
              onClick={() => setActiveTab("menu")}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-200 shadow-sm active:scale-95"
            >
              ⬅️ Voltar ao Menu
            </button>
            
            {/* Atalhos Rápidos no Cabeçalho */}
            <div className="flex items-center gap-1 flex-wrap">
              {cards.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setActiveTab(c.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                    activeTab === c.key
                      ? `${c.bg} text-white border-transparent shadow-sm`
                      : "bg-white border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {c.icon} {c.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 animate-in fade-in duration-200">
            {activeTab === "dashboard" && (
              <AfiacaoDashboard afiacoes={afiacoes} auxiliares={auxiliares} />
            )}
            {activeTab === "corrente" && (
              <AfiacaoCorrenteDashboard afiacoes={afiacoes} auxiliares={auxiliares} />
            )}
            {activeTab === "sabre" && (
              <AfiacaoSabreDashboard afiacoes={afiacoes} auxiliares={auxiliares} />
            )}
            {activeTab === "rolltop" && (
              <AfiacaoRolltopDashboard afiacoes={afiacoes} auxiliares={auxiliares} />
            )}
            {activeTab === "estoque" && (
              <AfiacaoEstoqueDashboard afiacoes={afiacoes} auxiliares={auxiliares} />
            )}
            {activeTab === "transferencias" && (
              <AfiacaoTransferencias
                afiacoes={afiacoes}
                auxiliares={auxiliares}
                onInsert={handleInsert}
                onDelete={handleDelete}
              />
            )}
            {activeTab === "banco" && (
              <BancoDadosAfiacao
                afiacoes={afiacoes}
                auxiliares={auxiliares}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            )}
            {activeTab === "formulario" && (
              <AfiacaoForm onSuccess={handleInsert} auxiliares={auxiliares} />
            )}
            {activeTab === "planilha" && (
              <PlanilhaLancamentos afiacoes={afiacoes} auxiliares={auxiliares} />
            )}
            {activeTab === "auxiliares" && (
              <BaseAuxiliarAfiacao
                auxiliares={auxiliares}
                onAdd={atualizarListaAuxiliares}
                onDelete={atualizarListaAuxiliares}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
