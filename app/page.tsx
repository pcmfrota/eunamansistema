"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-context";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Calendar, 
  CircleDot, 
  FileText, 
  Settings2, 
  Truck, 
  Database, 
  Droplets, 
  Users, 
  LogOut, 
  User, 
  ArrowRight,
  Loader2,
  Sun,
  Moon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumLoader } from "@/components/premium-loader";
import { useTheme } from "@/components/theme-provider";

const portalItems = [
  { 
    name: "Dashboard", 
    path: "/dashboard", 
    desc: "Indicadores operacionais, metas e resumos gerais da frota.", 
    icon: LayoutDashboard, 
    color: "from-blue-500 to-indigo-600 bg-blue-500/10 text-blue-400 border-blue-500/20" 
  },
  { 
    name: "Controle de OS", 
    path: "/os", 
    desc: "Abertura, acompanhamento e histórico de Ordens de Serviço.", 
    icon: ClipboardList, 
    color: "from-amber-500 to-orange-600 bg-amber-500/10 text-amber-400 border-amber-500/20" 
  },
  { 
    name: "Controle de Horímetros", 
    path: "/preventivas", 
    desc: "Apontamentos diários de horômetros e paradas de frotas.", 
    icon: Calendar, 
    color: "from-emerald-500 to-teal-600 bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
  },
  { 
    name: "Boletim de Pneus", 
    path: "/pneus", 
    desc: "Inspeção, trocas, calibragem e histórico de pneus da frota.", 
    icon: CircleDot, 
    color: "from-rose-500 to-pink-600 bg-rose-500/10 text-rose-400 border-rose-500/20" 
  },
  { 
    name: "Backlog", 
    path: "/backlog", 
    desc: "Gerenciamento de pendências, criticidades e prazos (aging).", 
    icon: FileText, 
    color: "from-indigo-500 to-purple-600 bg-indigo-500/10 text-indigo-400 border-indigo-500/20" 
  },
  { 
    name: "Prog. Preventiva", 
    path: "/programacao-preventiva", 
    desc: "Planejamento semanal e alinhamento de preventivas.", 
    icon: Settings2, 
    color: "from-cyan-500 to-blue-600 bg-cyan-500/10 text-cyan-400 border-cyan-500/20" 
  },
  { 
    name: "Base de Frota", 
    path: "/base-frotas", 
    desc: "Cadastro geral de caminhões, módulos e especificações.", 
    icon: Truck, 
    color: "from-sky-500 to-blue-600 bg-sky-500/10 text-sky-400 border-sky-500/20" 
  },
  { 
    name: "Base de Dados", 
    path: "/base-dados", 
    desc: "Visualização do banco local offline e fila de sincronização.", 
    icon: Database, 
    color: "from-slate-500 to-zinc-600 bg-slate-500/10 text-slate-400 border-slate-500/20" 
  },
  { 
    name: "Calendário Suzano", 
    path: "/calendario", 
    desc: "Calendário operacional da Suzano e escalas de turmas.", 
    icon: Calendar, 
    color: "from-green-500 to-emerald-600 bg-green-500/10 text-green-400 border-green-500/20" 
  },
  { 
    name: "Controle de Lavagens", 
    path: "/lavagens", 
    desc: "Registros diários e histórico de lavagens de veículos.", 
    icon: Droplets, 
    color: "from-cyan-400 to-teal-500 bg-cyan-400/10 text-cyan-300 border-cyan-400/20" 
  }
];

const adminPortalItems = [
  { 
    name: "Gestão de Usuários", 
    path: "/admin/usuarios", 
    desc: "Controle de acessos, perfis, permissões e novos cadastros.", 
    icon: Users, 
    color: "from-violet-500 to-fuchsia-600 bg-violet-500/10 text-violet-400 border-violet-500/20" 
  }
];

export default function PortalPage() {
  const { profile, signOut, loading: authLoading, permissions } = useAuth();
  const { theme, setTheme } = useTheme();
  const [greeting, setGreeting] = useState("Olá");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isDark = theme === "dark";

  useEffect(() => {
    setMounted(true);
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) setGreeting("Bom dia");
    else if (hr >= 12 && hr < 18) setGreeting("Boa tarde");
    else setGreeting("Boa noite");
  }, []);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
    } catch (error) {
      console.error("Erro ao sair:", error);
      window.location.replace("/login");
    }
  };

  const getFilteredItems = () => {
    if (!profile) return [];
    if (profile.role === "admin") {
      return [...portalItems, ...adminPortalItems];
    }
    if (profile.role === "visitante") {
      return portalItems.filter(item => 
        ["/dashboard", "/preventivas", "/backlog", "/calendario"].includes(item.path)
      );
    }
    if (!permissions || permissions.length === 0) {
      return [portalItems[0]]; // Default a ver pelo menos o dashboard
    }
    
    const allowed = portalItems.filter(item => permissions.includes(item.path));
    if (permissions.includes("/admin/usuarios")) {
      allowed.push(...adminPortalItems);
    }
    return allowed;
  };

  const allowedItems = getFilteredItems();

  if (!mounted || authLoading || !profile) {
    return (
      <div className={cn("min-h-screen w-full flex items-center justify-center transition-colors duration-300", isDark ? "bg-[#040e04] text-zinc-100" : "bg-[#f9fafb] text-zinc-800")}>
        <PremiumLoader type="squares-sequential" text="Carregando Acessos" subtext="EUNAMAN SISTEMA • PCM" />
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen w-full flex flex-col relative transition-colors duration-300 overflow-x-hidden select-none",
      isDark ? "text-zinc-100 bg-[#040e04]" : "text-zinc-800 bg-[#f9fafb]"
    )}>
      {/* Background visual effects */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=2074&auto=format&fit=crop')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          opacity: isDark ? 0.60 : 0.98
        }}
      />
      <div
        className={cn(
          "fixed inset-0 pointer-events-none z-0 transition-all duration-300",
          isDark 
            ? "bg-gradient-to-br from-zinc-950/65 via-zinc-950/45 to-indigo-950/20" 
            : "bg-gradient-to-br from-white/30 via-white/15 to-green-50/5"
        )}
      />

      {/* Top Navbar */}
      <header className={cn(
        "relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b backdrop-blur-md transition-colors duration-300",
        isDark ? "border-white/5" : "border-zinc-200"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-white/10 p-2">
            <img src="/logo-eunaman-full.png" alt="EUNAMAN" className="object-contain" />
          </div>
          <div>
            <h1 className={cn("text-lg font-black uppercase tracking-wider", isDark ? "text-white" : "text-green-950")}>EUNAMAN</h1>
            <p className={cn("text-[9px] font-bold uppercase tracking-widest leading-none", isDark ? "text-zinc-500" : "text-green-800")}>PCM • Gestão de Frota</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className={cn("w-10 h-10 rounded-full object-cover border-2", isDark ? "border-indigo-500/30" : "border-green-500/30")} />
            ) : (
              <div className={cn("w-10 h-10 rounded-full border flex items-center justify-center", isDark ? "bg-indigo-600/20 border-indigo-500/30" : "bg-green-600/10 border-green-500/20")}>
                <User size={16} className={isDark ? "text-indigo-400" : "text-green-600"} />
              </div>
            )}
            <div className="hidden sm:block text-right">
              <p className={cn("text-xs font-black", isDark ? "text-white" : "text-green-950")}>{profile?.full_name || "Colaborador"}</p>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border",
                isDark ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" : "text-green-700 bg-green-50 border-green-200"
              )}>
                {profile?.role === "admin" ? "Administrador" : profile?.role?.toUpperCase() || "Visitante"}
              </span>
            </div>
          </div>
          
          {/* Botão de Alternar Tema (Claro/Escuro) */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={cn(
              "p-3 border rounded-2xl transition-all shadow-md flex items-center justify-center active:scale-90",
              isDark 
                ? "bg-zinc-800/50 border-zinc-700 text-yellow-300 hover:bg-zinc-700" 
                : "bg-white border-zinc-200 text-green-600 hover:bg-zinc-100"
            )}
            title={isDark ? "Modo Claro" : "Modo Escuro"}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={cn(
              "p-3 border rounded-2xl hover:text-white transition-all shadow-md flex items-center justify-center active:scale-90 disabled:opacity-50",
              isDark 
                ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500" 
                : "bg-red-50 border-red-200 text-red-600 hover:bg-red-600"
            )}
            title="Sair do Sistema"
          >
            {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
          </button>
        </div>
      </header>

      {/* Hero Welcome Message */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 py-12 flex flex-col justify-center gap-10">
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <span className={cn("text-xs font-black uppercase tracking-[0.2em]", isDark ? "text-indigo-400" : "text-green-800")}>
            {greeting}, {profile?.full_name ? profile.full_name.split(" ")[0] : "Colaborador"}!
          </span>
          <h2 className={cn("text-3xl sm:text-4xl font-black uppercase italic tracking-tight", isDark ? "text-white" : "text-green-950")}>
            Selecione o Módulo para Acessar
          </h2>
          <p className={cn("text-sm max-w-lg", isDark ? "text-zinc-400" : "text-zinc-800")}>
            Bem-vindo ao Portal Eunaman. Escolha uma das abas de serviços e gerenciamentos habilitados para a sua conta abaixo para continuar.
          </p>
        </div>

        {/* Portal Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-12 duration-1000">
          {allowedItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                style={{ animationDelay: `${idx * 40}ms` }}
                className={cn(
                  "group flex flex-col justify-between p-6 border rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden backdrop-blur-md",
                  isDark 
                    ? "bg-zinc-950/55 border-white/5 hover:border-indigo-500/40 hover:bg-zinc-950/75" 
                    : "bg-white/60 border-zinc-200/80 hover:border-green-500/40 hover:bg-white/85"
                )}
              >
                {/* Visual hover background flare */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-tr opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                  isDark ? "from-indigo-500/0 via-indigo-500/0 to-indigo-500/5" : "from-green-500/0 via-green-500/0 to-green-500/5"
                )} />
                
                <div className="flex items-start justify-between gap-4 relative z-10">
                  <div className={cn("p-4 rounded-[1.5rem] border shrink-0", item.color)}>
                    <Icon size={24} />
                  </div>
                  <div className={cn(
                    "p-2 rounded-xl transition-all duration-300",
                    isDark 
                      ? "bg-white/5 text-zinc-500 group-hover:text-white group-hover:bg-indigo-600" 
                      : "bg-zinc-100 text-zinc-400 group-hover:text-white group-hover:bg-green-600"
                  )}>
                    <ArrowRight size={16} className="transform -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                  </div>
                </div>

                <div className="mt-8 relative z-10">
                  <h3 className={cn(
                    "text-lg font-black uppercase italic tracking-tight transition-colors",
                    isDark ? "text-white group-hover:text-indigo-400" : "text-green-950 group-hover:text-green-700"
                  )}>
                    {item.name}
                  </h3>
                  <p className={cn(
                    "text-xs font-bold tracking-wide leading-relaxed mt-2 transition-colors",
                    isDark ? "text-zinc-400 group-hover:text-zinc-300" : "text-zinc-850 group-hover:text-zinc-950"
                  )}>
                    {item.desc}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className={cn(
        "relative z-10 w-full max-w-7xl mx-auto px-6 py-6 border-t flex items-center justify-between text-[10px] font-black uppercase tracking-wider transition-colors duration-300",
        isDark ? "border-white/5" : "border-white/20"
      )}>
        <span className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] transition-colors duration-300">
          EUNAMAN SISTEMA · PCM
        </span>
        <span className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] transition-colors duration-300">
          TODOS OS DIREITOS RESERVADOS © {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}
