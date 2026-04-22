"use client";

import { PremiumLoader } from "@/components/premium-loader";

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
      <PremiumLoader type="squares-sequential" text="Carregando" />
    </div>
  );
}
