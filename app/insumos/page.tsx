"use client";

import { Fuel, Construction } from "lucide-react";

export default function InsumosPage() {
  return (
    <div className="p-4 md:p-8 flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="p-5 bg-amber-100 dark:bg-amber-900/30 rounded-2xl">
          <Fuel size={40} className="text-amber-500 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Controle de Insumos
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-md">
            Digitalização da Ficha de Abastecimento e da Ficha de Recarga de Insumos
            dos comboios. O cadastro base (módulos, materiais e frota) já está pronto —
            as telas de lançamento chegam nas próximas etapas.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-400 text-sm font-medium">
          <Construction size={16} />
          Em Desenvolvimento
        </div>
      </div>
    </div>
  );
}
