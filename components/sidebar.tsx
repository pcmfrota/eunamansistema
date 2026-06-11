"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wrench,
  Disc,
  Clipboard,
  Settings,
  Settings2,
  Menu,
  X,
  Moon,
  Sun,
  LogOut,
  FileText,
  Calendar,
  User,
  Shield,
  BarChart2,
  Droplets,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "./theme-provider";
import { logout } from "@/app/login/actions";
import AlterarSenhaModal from "./AlterarSenhaModal";
import { useAuth } from "./auth-context";

const routes = [
  { name: "Dashboard",                path: "/",                        icon: LayoutDashboard },
  { name: "Controle de OS",           path: "/os",                      icon: FileText },
  { name: "Controle de Horímetros",   path: "/preventivas",             icon: Calendar },
  { name: "Boletim de Pneus",         path: "/pneus",                   icon: Disc },
  { name: "Backlog",                  path: "/backlog",                 icon: Wrench },
  { name: "Prog. Preventiva",         path: "/programacao-preventiva",  icon: Settings2 },
  { name: "Base de Frota",            path: "/base-frotas",             icon: LayoutDashboard },
  { name: "Base de Dados",            path: "/base-dados",              icon: LayoutDashboard },
  { name: "Calendário Suzano",        path: "/calendario",              icon: Calendar },
  { name: "Controle de Lavagens",     path: "/lavagens",                icon: Droplets },
  { name: "Captação de Água",         path: "/captacao",                icon: Droplets },
  { name: "Gestão de Usuários",       path: "/admin/usuarios",          icon: User },
];


export function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { permissions, profile } = useAuth();

  const filteredRoutes = routes.filter(route => 
    profile?.role === 'admin' || permissions.includes(route.path)
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="font-bold text-lg dark:text-white">EUNAMAN PCM</h1>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)}>
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Desktop & Mobile Overlay */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 flex flex-col",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 flex items-center justify-center hidden md:flex border-b border-zinc-200 dark:border-zinc-800 bg-white">
          <img 
            src="/logo-eunaman-full.png" 
            alt="EUNAMAN" 
            className="h-16 w-auto mix-blend-multiply" 
          />
        </div>

        <nav className="flex-1 flex flex-col gap-2 px-4 py-4 overflow-y-auto">
          {filteredRoutes.map((route) => {
            const Icon = route.icon;
            const isActive = pathname === route.path;

            return (
              <Link
                key={route.path}
                href={route.path}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                )}
              >
                <Icon size={18} />
                {route.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 w-full text-left"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            Alternar Tema
          </button>
          
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 w-full text-left font-black uppercase tracking-tighter"
          >
            <Shield size={18} className="text-blue-500" />
            Alterar Senha
          </button>

          <button 
            onClick={() => logout()}
            className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 w-full text-left"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </div>

      <AlterarSenhaModal 
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}
