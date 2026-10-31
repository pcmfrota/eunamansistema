import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth-context";
import { Fuel, Truck, Circle, ListChecks, Droplets, Clock, Globe } from "lucide-react";

const MODULOS: { chave: string; nome: string; icone: typeof Circle; cor: string }[] = [
  { chave: "pneus", nome: "Boletim de Pneus", icone: Circle, cor: "text-red-500 bg-red-500/10" },
  { chave: "backlog", nome: "Backlog", icone: ListChecks, cor: "text-indigo-500 bg-indigo-500/10" },
  { chave: "captacao", nome: "Captação de Água", icone: Droplets, cor: "text-blue-500 bg-blue-500/10" },
  { chave: "mao-de-obra", nome: "Mão de Obra", icone: Clock, cor: "text-violet-500 bg-violet-500/10" },
  { chave: "equipamentos", nome: "Equipamentos (teste)", icone: Truck, cor: "text-zinc-400 bg-zinc-500/10" },
];

// Ponte JS nativa (android-apk/.../EunamanActivity.java, EunamanJsBridge.openLiveSite())
// — mesma convenção de chamada já usada em components/main-layout.tsx.
function abrirModulosDeEscritorio() {
  if (typeof window !== "undefined" && (window as any).EunamanApp?.openLiveSite) {
    (window as any).EunamanApp.openLiveSite();
  } else {
    alert("Módulos de escritório disponíveis apenas no aplicativo instalado.");
  }
}

export function MenuScreen() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-amber-500/10 rounded-xl shrink-0">
            <Fuel size={20} className="text-amber-500" />
          </div>
          <p className="text-xs text-zinc-500 truncate">{profile?.full_name || profile?.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="px-3 rounded-lg bg-zinc-800 text-xs font-bold text-zinc-300 shrink-0"
          style={{ minHeight: "var(--tap-min)" }}
        >
          Sair
        </button>
      </div>

      <div className="space-y-2">
        {MODULOS.map((m) => {
          const Icone = m.icone;
          return (
            <button
              key={m.chave}
              onClick={() => navigate(`/${m.chave}`)}
              className="w-full flex items-center gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-left active:border-amber-600/50"
              style={{ minHeight: "var(--tap-min)" }}
            >
              <div className={`p-2 rounded-xl ${m.cor}`}>
                <Icone size={18} />
              </div>
              <span className="font-bold text-sm">{m.nome}</span>
            </button>
          );
        })}

        <button
          onClick={abrirModulosDeEscritorio}
          className="w-full flex items-center gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-left active:border-amber-600/50"
          style={{ minHeight: "var(--tap-min)" }}
        >
          <div className="p-2 rounded-xl text-amber-500 bg-amber-500/10">
            <Globe size={18} />
          </div>
          <span className="font-bold text-sm">Módulos de Escritório</span>
        </button>
      </div>
    </div>
  );
}
