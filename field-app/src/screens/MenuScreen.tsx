import { useAuth } from "@/components/auth-context";
import { useOffline } from "@/components/offline-provider";
import { Fuel, Truck, Circle } from "lucide-react";

const MODULOS: { chave: string; nome: string; icone: typeof Circle; cor: string }[] = [
  { chave: "pneus", nome: "Boletim de Pneus", icone: Circle, cor: "text-red-500 bg-red-500/10" },
  { chave: "equipamentos", nome: "Equipamentos (teste)", icone: Truck, cor: "text-zinc-400 bg-zinc-500/10" },
];

export function MenuScreen({ onSelecionar }: { onSelecionar: (chave: string) => void }) {
  const { profile, signOut } = useAuth();
  const { isOnline, pendingCount } = useOffline();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 rounded-xl">
            <Fuel size={20} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-base font-black">EUNAMAN Campo</h1>
            <p className="text-xs text-zinc-500">{profile?.full_name || profile?.email}</p>
          </div>
        </div>
        <button onClick={() => signOut()} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs font-bold text-zinc-300">
          Sair
        </button>
      </div>

      <div className={`mb-5 px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 ${isOnline ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900" : "bg-amber-950/50 text-amber-400 border border-amber-900"}`}>
        {isOnline ? "Online" : "Offline"}
        {pendingCount > 0 && <span className="bg-black/30 px-1.5 py-0.5 rounded-md">{pendingCount} pendente(s)</span>}
      </div>

      <div className="space-y-2">
        {MODULOS.map((m) => {
          const Icone = m.icone;
          return (
            <button
              key={m.chave}
              onClick={() => onSelecionar(m.chave)}
              className="w-full flex items-center gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-left hover:border-amber-600/50"
            >
              <div className={`p-2 rounded-xl ${m.cor}`}>
                <Icone size={18} />
              </div>
              <span className="font-bold text-sm">{m.nome}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
