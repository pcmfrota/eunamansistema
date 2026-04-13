"use client";

import { CalendarDays, Construction } from "lucide-react";

export default function SemanalPage() {
  return (
    <div className="p-4 md:p-8 flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="p-5 bg-blue-100 dark:bg-blue-900/30 rounded-2xl">
          <CalendarDays size={40} className="text-blue-500 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Programação Semanal
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-md">
            Este módulo está em desenvolvimento. Em breve você poderá planejar
            e visualizar a programação semanal de manutenções aqui.
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
