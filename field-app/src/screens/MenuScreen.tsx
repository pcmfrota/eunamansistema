import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth-context";
import { Fuel, Truck, Circle, ListChecks, Droplets, Clock, Globe, Gauge, Wrench, ClipboardCheck, Hammer } from "lucide-react";

// 5 módulos de maior uso em campo — mesma prioridade da barra fixa (BottomNav.tsx).
const MODULOS_PRIORITARIOS: { chave: string; nome: string; icone: typeof Circle; cor: string }[] = [
  { chave: "backlog", nome: "Backlog", icone: ListChecks, cor: "text-indigo-500 bg-indigo-500/10" },
  { chave: "pneus", nome: "Boletim de Pneus", icone: Circle, cor: "text-red-500 bg-red-500/10" },
  { chave: "os", nome: "Ordens de Serviço", icone: Hammer, cor: "text-sky-500 bg-sky-500/10" },
  { chave: "checklist-mecanicos", nome: "Checklist Mecânico", icone: ClipboardCheck, cor: "text-rose-500 bg-rose-500/10" },
  { chave: "captacao", nome: "Captação de Água", icone: Droplets, cor: "text-blue-500 bg-blue-500/10" },
];

// Demais módulos — mesma função, só não ficam na barra fixa nem no topo do Início por
// serem de uso menos frequente em campo.
const OUTROS_MODULOS: { chave: string; nome: string; icone: typeof Circle; cor: string }[] = [
  { chave: "mao-de-obra", nome: "Mão de Obra", icone: Clock, cor: "text-violet-500 bg-violet-500/10" },
  { chave: "lavagens", nome: "Lavagens", icone: Droplets, cor: "text-cyan-500 bg-cyan-500/10" },
  { chave: "preventivas", nome: "Preventivas", icone: Gauge, cor: "text-orange-500 bg-orange-500/10" },
  { chave: "lubrificacao", nome: "Lubrificação", icone: Wrench, cor: "text-lime-500 bg-lime-500/10" },
  { chave: "insumos", nome: "Insumos", icone: Fuel, cor: "text-amber-500 bg-amber-500/10" },
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
  const { profile, signOut, permissions, isAdmin } = useAuth();

  // Camada 1: só mostra o que o usuário realmente tem permissão de abrir — "equipamentos"
  // é uma tela de teste/dev sem entrada em user_module_permissions, por isso fica de fora
  // dessa checagem (sempre visível, como já era antes desta mudança).
  const autorizado = (chave: string) => isAdmin || chave === "equipamentos" || permissions.includes(`/${chave}`);
  const prioritarios = MODULOS_PRIORITARIOS.filter((m) => autorizado(m.chave));
  const outros = OUTROS_MODULOS.filter((m) => autorizado(m.chave));

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
        {prioritarios.map((m) => {
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
      </div>

      {outros.length > 0 && (
        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-6 mb-2 ml-1">Outros Módulos</p>
      )}
      <div className="space-y-2">
        {outros.map((m) => {
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
