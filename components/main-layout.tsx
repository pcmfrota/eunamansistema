"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from "./theme-provider";
import { useAuth } from "./auth-context";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Calendar, 
  CalendarDays, 
  Truck, 
  Database,
  Menu,
  CircleDot,
  Moon,
  Sun,
  FileText,
  BadgeDollarSign,
  User,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
  Loader2,
  BarChart2,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import AlterarSenhaModal from './AlterarSenhaModal';
import { Shield } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Controle de OS', path: '/os', icon: ClipboardList },
  { name: 'Programação Preventiva', path: '/preventivas', icon: Calendar },
  { name: 'Boletim de Pneus', path: '/pneus', icon: CircleDot },
  { name: 'Programação Semanal', path: '/semanal', icon: CalendarDays },
  { name: 'Backlog', path: '/backlog', icon: FileText },
  { name: 'Custos', path: '/custos', icon: BadgeDollarSign },
  { name: 'Base de Frotas', path: '/base-frotas', icon: Truck },
  { name: 'Base de Dados', path: '/base-dados', icon: Database },
];

const adminNavigation = [
  { name: 'Gestão de Usuários', path: '/admin/usuarios', icon: Users },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { profile, signOut, loading: authLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
    } catch (error) {
      console.error('Erro ao sair:', error);
      setIsLoggingOut(false);
    }
  };

  const isLoginPage = pathname?.startsWith("/login");

  if (isLoginPage) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-between overflow-x-hidden">
        {children}
      </main>
    );
  }

  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-[100dvh] w-64 border-r overflow-y-auto flex flex-col",
        "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
        "transition-transform duration-300 ease-in-out",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Header/Logo */}
        <div className="flex items-center gap-3 p-6 border-b border-slate-100 dark:border-slate-700">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693aa6d5db2859afdc9fa993/3c0451f21_04-EPNG.png"
            alt="Eunaman Logo"
            className="w-10 h-10 object-contain"
          />
          <div>
            <h1 className="font-bold text-lg text-slate-900 dark:text-white">Eunaman</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Controle de Manutenção</p>
          </div>
        </div>

        {/* User Profile Summary */}
        <div className="px-4 py-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name || 'Usuário'} 
                  className="w-10 h-10 rounded-full object-cover border-2 border-blue-500/20"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <User size={20} />
                </div>
              )}
              {profile?.role === 'admin' && (
                <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full p-0.5" title="Administrador">
                  <ShieldCheck size={10} className="text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {profile?.full_name || 'Usuário'}
              </p>
              <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.1em]">
                {authLoading ? 'CARREGANDO...' : (
                  profile?.role === 'admin' ? 'Administrador' :
                  profile?.role === 'pcm' ? 'PCM' :
                  profile?.role === 'gestao' ? 'Gestão' : 'Visitante'
                )}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Link 
                href="/perfil"
                className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-[11px] font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <User size={12} />
                Perfil
              </Link>
              <button 
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/20 text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <LogOut size={12} />
                )}
                Sair
              </button>
            </div>
            
            <button
               onClick={() => setIsPasswordModalOpen(true)}
               className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600/5 hover:bg-blue-600/10 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-600/10 dark:border-blue-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
            >
               <Shield size={12} />
               Segurança / Alterar Senha
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <div className="flex items-center justify-between px-3 mb-3">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Navegação
            </p>
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="p-1.5 rounded-lg transition-colors bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
              title={isDark ? "Modo Claro" : "Modo Escuro"}
            >
              {isDark
                ? <Sun className="w-4 h-4 text-yellow-400" />
                : <Moon className="w-4 h-4 text-slate-600" />
              }
            </button>
          </div>

          {navigation.map((item, index) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  "hover:scale-[1.02] active:scale-95",
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                )}
                style={{ animationDelay: `${index * 50}ms`, animation: 'slideIn 0.3s ease-out' }}
              >
                <item.icon className={cn(
                  "w-5 h-5",
                  isActive ? "text-blue-500 dark:text-blue-400" : "text-slate-400"
                )} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}

          {profile?.role === 'admin' && (
            <>
              <div className="pt-4 pb-2 px-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Administração</p>
              </div>
              {adminNavigation.map((item, index) => {
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                      "hover:scale-[1.02] active:scale-95",
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                    )}
                    style={{ animationDelay: `${(navigation.length + index) * 50}ms`, animation: 'slideIn 0.3s ease-out' }}
                  >
                    <item.icon className={cn(
                      "w-5 h-5",
                      isActive ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400"
                    )} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>
      </aside>

      {/* Main content wrapper */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 border-b px-4 py-3 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Menu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </button>
              <div className="flex items-center gap-2">
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693aa6d5db2859afdc9fa993/3c0451f21_04-EPNG.png"
                  alt="Eunaman Logo"
                  className="w-8 h-8 object-contain"
                />
                <span className="font-bold text-slate-900 dark:text-white">Eunaman</span>
              </div>
            </div>
            
            {/* Mobile Profile Link */}
            <Link href="/perfil" className="lg:hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-8 h-8 rounded-full border border-slate-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold uppercase text-[10px]">
                  {profile?.full_name?.charAt(0) || <User size={14} />}
                </div>
              )}
            </Link>
          </div>
        </header>

        <main className="flex-1 w-full">
          {children}
        </main>
      </div>
      <AlterarSenhaModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
      />
    </div>
  );
}
