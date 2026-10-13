// Tela única da Fase 0 — prova de conceito. Objetivo: confirmar, num aparelho de
// verdade, que uma página carregada via file:// dentro do APK consegue (1) autenticar
// e (2) buscar dados reais do Supabase pra dentro do IndexedDB, e que depois disso a
// MESMA lista continua aparecendo com o aparelho em modo avião. Reaproveita
// lib/offline-db.ts e lib/offline-sync.ts do app principal sem nenhuma alteração.
import { useEffect, useState } from "react";
import { localDb } from "@/lib/offline-db";
import { ChevronLeft } from "lucide-react";

type Equipamento = { id: string; placa: string; modelo: string | null; tipo: string };

export function EquipamentosScreen({ onVoltar }: { onVoltar: () => void }) {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [status, setStatus] = useState("Carregando do aparelho...");
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      // Sempre lê primeiro do IndexedDB (local-first) — funciona offline mesmo que a
      // sincronização abaixo falhe ou nunca rode.
      const cache = await localDb.getAll<Equipamento>("equipamentos");
      if (ativo) {
        setEquipamentos(cache.sort((a, b) => a.placa.localeCompare(b.placa)));
        setStatus(cache.length ? `${cache.length} equipamento(s) no aparelho.` : "Nenhum dado local ainda — conecte à internet uma vez.");
      }

      if (navigator.onLine) {
        try {
          const { syncTables } = await import("@/lib/offline-sync");
          const ok = await syncTables(["equipamentos"]);
          if (ok) {
            const atualizado = await localDb.getAll<Equipamento>("equipamentos");
            if (ativo) {
              setEquipamentos(atualizado.sort((a, b) => a.placa.localeCompare(b.placa)));
              setStatus(`${atualizado.length} equipamento(s) — sincronizado agora.`);
            }
          }
        } catch (err) {
          console.warn("[EquipamentosScreen] Falha ao sincronizar:", err);
        }
      }
    }

    carregar();
    return () => { ativo = false; };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-5">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onVoltar} className="p-2 rounded-xl bg-zinc-800 text-zinc-300">
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-lg font-black">Equipamentos (teste)</h1>
      </div>

      <div className={`mb-4 px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 ${isOnline ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900" : "bg-amber-950/50 text-amber-400 border border-amber-900"}`}>
        {isOnline ? "Online" : "Offline (modo avião)"}
      </div>

      <p className="text-xs text-zinc-400 mb-3">{status}</p>

      <div className="space-y-2">
        {equipamentos.map((eq) => (
          <div key={eq.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <div className="font-bold text-sm">{eq.placa}</div>
            <div className="text-xs text-zinc-500">{eq.modelo || "-"} · {eq.tipo}</div>
          </div>
        ))}
        {equipamentos.length === 0 && (
          <div className="text-center text-xs text-zinc-500 py-10 border border-dashed border-zinc-800 rounded-xl">
            Nenhum equipamento carregado ainda.
          </div>
        )}
      </div>
    </div>
  );
}
