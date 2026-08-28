"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, WifiOff, Home } from "lucide-react";
import { useOffline } from "@/components/offline-provider";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { isOnline } = useOffline();

  useEffect(() => {
    console.error("[ErrorBoundary] Erro capturado na tela:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500">
        <AlertTriangle size={30} />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
          Algo deu errado ao carregar esta tela
        </h2>
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          {isOnline
            ? "Ocorreu um erro inesperado. Tente novamente."
            : "Isso pode acontecer quando alguma informação ainda não foi salva neste aparelho."}
        </p>
      </div>

      {!isOnline && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <WifiOff size={14} />
          Você está offline no momento
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-blue-700"
        >
          <RefreshCw size={16} />
          Tentar novamente
        </button>
        <a
          href="/"
          className="flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Home size={16} />
          Ir para o início
        </a>
      </div>
    </div>
  );
}
