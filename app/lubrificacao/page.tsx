import React from "react";
import LubrificacaoClient from "./LubrificacaoClient";

export const metadata = {
  title: "Módulo de Lubrificação | EUNAMAN SISTEMA",
  description: "Controle de lubricidade, calibragem de pneus e manutenção preventiva da frota.",
};

export default function LubrificacaoPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-4">
      <LubrificacaoClient />
    </main>
  );
}
