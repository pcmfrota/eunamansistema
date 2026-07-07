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
  const [activeTab, setActiveTab] = useState<"dashboard" | "corrente" | "sabre" | "rolltop" | "estoque" | "transferencias" | "banco" | "formulario" | "planilha" | "auxiliares">("dashboard");
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

  const tabs: { key: "dashboard" | "corrente" | "sabre" | "rolltop" | "estoque" | "transferencias" | "banco" | "formulario" | "planilha" | "auxiliares"; label: string; icon: string }[] = [
    { key: "dashboard",  label: "DASHBOARD",            icon: "📈" },
    { key: "corrente",   label: "CORRENTE",             icon: "⛓️" },
    { key: "sabre",      label: "SABRE",                icon: "🪚" },
    { key: "rolltop",    label: "ROLLTOP",              icon: "⭐" },
    { key: "estoque",    label: "CONTROLE DE ESTOQUE EUNAMAN", icon: "📦" },
    { key: "transferencias", label: "TRANSFERÊNCIAS",     icon: "🔄" },
    { key: "banco",      label: "BANCO DE DADOS",       icon: "🗄️" },
    { key: "formulario", label: "FORMULÁRIO AFIAÇÃO",   icon: "📝" },
    { key: "planilha",   label: "PLANILHA LANÇAMENTOS", icon: "📊" },
    { key: "auxiliares", label: "BASE AUXILIAR",        icon: "⚙️" },
  ];

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-1 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 py-2.5 px-4 text-xs font-bold transition-all border-b-2 ${
              activeTab === t.key
                ? "border-blue-600 text-blue-700 bg-blue-50/50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="pt-4">
        {activeTab === "dashboard" && (
          <AfiacaoDashboard
            afiacoes={afiacoes}
            auxiliares={auxiliares}
          />
        )}
        {activeTab === "corrente" && (
          <AfiacaoCorrenteDashboard
            afiacoes={afiacoes}
            auxiliares={auxiliares}
          />
        )}
        {activeTab === "sabre" && (
          <AfiacaoSabreDashboard
            afiacoes={afiacoes}
            auxiliares={auxiliares}
          />
        )}
        {activeTab === "rolltop" && (
          <AfiacaoRolltopDashboard
            afiacoes={afiacoes}
            auxiliares={auxiliares}
          />
        )}
        {activeTab === "estoque" && (
          <AfiacaoEstoqueDashboard
            afiacoes={afiacoes}
            auxiliares={auxiliares}
          />
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
          <AfiacaoForm
            onSuccess={handleInsert}
            auxiliares={auxiliares}
          />
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
  );
}

