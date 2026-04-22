"use client";

import { PremiumLoader } from "@/components/premium-loader";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 p-6">
      <PremiumLoader 
        type="squares-sequential" 
        text="Controle de OS" 
        subtext="Sincronizando frotas e manutenções..." 
      />
      
      {/* Premium Skeleton placeholders */}
      <div className="w-full max-w-5xl space-y-6 mt-4 opacity-10 blur-[1px]">
        <div className="h-16 bg-green-900/20 rounded-2xl animate-pulse" />
        <div className="h-80 bg-green-900/10 rounded-[2rem] animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-40 bg-green-900/10 rounded-3xl animate-pulse" />
          <div className="h-40 bg-green-900/10 rounded-3xl animate-pulse" />
          <div className="h-40 bg-green-900/10 rounded-3xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
