"use client";

import { Settings, Calendar } from "lucide-react";

export default function PCMPage() {
  return (
    <div className="p-4 md:p-8 flex flex-col gap-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400 rounded-lg">
            <Settings size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Painel PCM</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Planejamento e Controle de Manutenção, alertas e agenda preventiva.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-blue-500" />
            Agenda Semanal
          </h2>
          <div className="flex flex-col gap-3">
            <div className="p-3 border border-zinc-100 dark:border-zinc-800 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-900">
              <span className="font-bold">29/03</span> - Preventiva 500h | <span className="text-zinc-500">EXC-01</span>
            </div>
            <div className="p-3 border border-zinc-100 dark:border-zinc-800 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-900">
              <span className="font-bold">30/03</span> - Revisão de Freios | <span className="text-zinc-500">CAM-05</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4 text-red-500">Alertas Automáticos</h2>
          <div className="flex flex-col gap-3">
            <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 rounded-lg">
              <div className="flex justify-between font-bold mb-1">
                <span>Manutenção Programada (100%)</span>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">TRAT-02 atingiu o limite da preventiva de 1000h.</p>
            </div>
            
            <div className="p-4 border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900/50 rounded-lg">
              <div className="flex justify-between font-bold mb-1">
                <span>Atenção (92%)</span>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">EXC-01 está se aproximando da manutenção de 250h.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
