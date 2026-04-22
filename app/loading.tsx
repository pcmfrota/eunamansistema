import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 gap-4 animate-in fade-in duration-500">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-zinc-100 dark:border-zinc-800 border-t-green-600 animate-spin" />
        <Loader2 className="absolute inset-0 m-auto w-6 h-6 text-green-600/30 animate-pulse" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs animate-pulse">
          Carregando conteúdo...
        </p>
        <p className="text-[10px] text-zinc-400">Preparando seus dados com segurança</p>
      </div>
    </div>
  );
}
