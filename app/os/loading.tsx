import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-zinc-200 dark:border-zinc-800 animate-pulse" />
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin absolute inset-0" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Carregando Controle de OS</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Processando ordens e equipamentos...</p>
      </div>
      
      {/* Skeleton placeholders */}
      <div className="w-full max-w-4xl space-y-4 mt-8 opacity-20">
        <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-3xl" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
          <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
          <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
