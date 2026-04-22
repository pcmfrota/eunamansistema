"use client";

import { PremiumLoader } from "@/components/premium-loader";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 p-6">
      <PremiumLoader 
        type="squares-sequential" 
        text="Gestão de Usuários" 
        subtext="Verificando permissões e acessos..." 
      />
      
      <div className="w-full max-w-5xl space-y-6 mt-4 opacity-5 blur-[1px]">
        <div className="h-12 w-64 bg-zinc-400 rounded-xl animate-pulse" />
        <div className="h-[30rem] bg-zinc-400 rounded-[2.5rem] animate-pulse" />
      </div>
    </div>
  );
}
