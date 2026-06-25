"use client";

import { useState } from "react";
import AfiacaoForm from "./AfiacaoForm";
import PlanilhaLancamentos from "./PlanilhaLancamentos";

export default function AfiacaoClient({ initialAfiacoes }: { initialAfiacoes: any[] }) {
  const [activeTab, setActiveTab] = useState<"banco" | "formulario" | "planilha">("formulario");
  const [afiacoes, setAfiacoes] = useState(initialAfiacoes);

  return (
    <div className="w-full">
      {/* Tabs List */}
      <div className="flex border-b border-gray-200">
        <button
          className={`py-2 px-4 text-sm font-medium ${
            activeTab === "banco"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("banco")}
        >
          BANCO DE DADOS
        </button>
        <button
          className={`py-2 px-4 text-sm font-medium ${
            activeTab === "formulario"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("formulario")}
        >
          FORMULÁRIO AFIAÇÃO
        </button>
        <button
          className={`py-2 px-4 text-sm font-medium ${
            activeTab === "planilha"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("planilha")}
        >
          PLANILHA LANÇAMENTOS
        </button>
      </div>

      {/* Tabs Content */}
      <div className="pt-4">
        {activeTab === "banco" && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Afiador</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Módulo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Máquina</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Letra</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kit</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Detalhes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {afiacoes.map((a: any, i) => (
                  <tr key={a.id || i}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{a.data}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{a.afiador}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{a.modulo}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{a.maquina}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{a.letra}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{a.kit}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{a.tipo_formulario}</td>
                    <td className="px-4 py-2 text-sm">{JSON.stringify(a.detalhes)}</td>
                  </tr>
                ))}
                {afiacoes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-4 text-center text-sm text-gray-500">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {activeTab === "formulario" && (
          <AfiacaoForm onSuccess={(newAfiacao: any) => setAfiacoes([newAfiacao, ...afiacoes])} />
        )}

        {activeTab === "planilha" && (
          <PlanilhaLancamentos afiacoes={afiacoes} />
        )}
      </div>
    </div>
  );
}
