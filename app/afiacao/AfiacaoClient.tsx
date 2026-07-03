"use client";

import { useState } from "react";
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
  const [activeTab, setActiveTab] = useState<"banco" | "formulario" | "planilha" | "auxiliares">("banco");
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
    setActiveTab("banco");
  };

  const atualizarListaAuxiliares = async () => {
    const fresh = await buscarAuxiliaresAfiacao();
    setAuxiliares(fresh);
  };

  const tabs: { key: "banco" | "formulario" | "planilha" | "auxiliares"; label: string; icon: string }[] = [
    { key: "banco",      label: "BANCO DE DADOS",       icon: "🗄️" },
    { key: "formulario", label: "FORMULÁRIO AFIAÇÃO",   icon: "📝" },
    { key: "planilha",   label: "PLANILHA LANÇAMENTOS", icon: "📊" },
    { key: "auxiliares", label: "BASE AUXILIAR",        icon: "⚙️" },
  ];

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 py-2.5 px-5 text-sm font-semibold transition-all border-b-2 ${
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
          <PlanilhaLancamentos afiacoes={afiacoes} />
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

