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
  Gauge,
  Truck, 
  Database,
  Menu,
  CircleDot,
  Moon,
  Sun,
  FileText,
  User,
  LogOut,
  Settings,
  Settings2,
  ShieldCheck,
  Shield,
  Users,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import AlterarSenhaModal from './AlterarSenhaModal';

const navigation = [
  { name: 'Dashboard',                path: '/',                       icon: LayoutDashboard },
  { name: 'Controle de OS',           path: '/os',                     icon: ClipboardList },
  { name: 'Controle de Horímetros',   path: '/preventivas',            icon: Calendar },
  { name: 'Boletim de Pneus',         path: '/pneus',                  icon: CircleDot },
  { name: 'Horímetro',                path: '/horimetro',              icon: Gauge },
  { name: 'Backlog',                  path: '/backlog',                icon: FileText },
  { name: 'Prog. Preventiva',         path: '/programacao-preventiva', icon: Settings2 },
  { name: 'Base de Frotas',           path: '/base-frotas',            icon: Truck },
  { name: 'Base de Dados',            path: '/base-dados',             icon: Database },
  { name: 'PCM',                      path: '/pcm',                    icon: Settings },
  { name: 'Calendário Suzano',        path: '/calendario',             icon: Calendar },
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
    /* ── Root com background de floresta — imagem gerada da floresta de eucalipto ── */
    <div
      className="min-h-screen transition-colors"
      style={{
        backgroundImage: "url('/bg-eunaman.png'), linear-gradient(135deg, #0a1f0a 0%, #1a3a1a 50%, #0d2b0d 100%)",
        backgroundSize: 'cover, cover',
        backgroundPosition: 'center top, center',
        backgroundAttachment: 'fixed, fixed',
        backgroundRepeat: 'no-repeat, no-repeat',
      }}
    >
      {/* ── Overlay escuro sobre fundo ── */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(4,14,4,0.88) 0%, rgba(8,24,8,0.82) 50%, rgba(12,30,12,0.88) 100%)'
            : 'linear-gradient(135deg, rgba(8,30,8,0.68) 0%, rgba(13,43,13,0.58) 40%, rgba(20,55,20,0.65) 100%)',
        }}
      />

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ──────────── SIDEBAR ──────────── */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-[100dvh] w-64 overflow-y-auto flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
        style={{
          background: isDark
            ? 'rgba(4, 12, 4, 0.92)'
            : 'rgba(8, 28, 8, 0.88)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          borderRight: '1px solid rgba(45, 122, 45, 0.22)',
          boxShadow: '4px 0 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* ── Logo / Header ── */}
        <div
          className="flex items-center gap-3 p-5 shrink-0"
          style={{
            borderBottom: '1px solid rgba(45,122,45,0.18)',
            background: 'linear-gradient(135deg, rgba(26,76,26,0.6) 0%, transparent 100%)',
          }}
        >
          {/* ── Logo SVG (alta qualidade) ── */}
          <img
            src="/logo-eunaman.svg"
            alt="EUNAMAN - Forest Support Expert"
            className="h-12 w-auto object-contain"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4)) brightness(1.15)' }}
          />

          {/* Close mobile */}
          <button
            className="lg:hidden ml-auto p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* ── Perfil do Usuário ── */}
        <div
          className="px-4 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(45,122,45,0.15)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="relative shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || 'Usuário'}
                  className="w-10 h-10 rounded-full object-cover"
                  style={{ border: '2px solid rgba(45,122,45,0.5)' }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(45,122,45,0.4), rgba(45,122,45,0.2))',
                    border: '1px solid rgba(45,122,45,0.4)',
                  }}
                >
                  <User size={18} className="text-green-300" />
                </div>
              )}
              {profile?.role === 'admin' && (
                <div
                  className="absolute -bottom-0.5 -right-0.5 rounded-full p-0.5"
                  style={{ background: 'linear-gradient(135deg, #2d8a2d, #1a5c1a)', border: '1.5px solid rgba(10,31,10,0.8)' }}
                  title="Administrador"
                >
                  <ShieldCheck size={9} className="text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {profile?.full_name || 'Usuário'}
              </p>
              <p
                className="text-[10px] font-black uppercase tracking-[0.12em]"
                style={{ color: 'rgba(115, 207, 115, 0.9)' }}
              >
                {authLoading ? 'Carregando...' : (
                  profile?.role === 'admin' ? 'Administrador' :
                  profile?.role === 'pcm' ? 'PCM' :
                  profile?.role === 'gestao' ? 'Gestão' : 'Visitante'
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/perfil"
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(200,240,200,0.85)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              <User size={12} />
              Perfil
            </Link>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
              style={{
                background: 'rgba(239,68,68,0.12)',
                color: 'rgba(252,165,165,0.9)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              {isLoggingOut ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
              Sair
            </button>
          </div>

          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="mt-2 flex items-center justify-center gap-2 w-full py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
            style={{
              background: 'rgba(45,122,45,0.1)',
              color: 'rgba(115,207,115,0.85)',
              border: '1px solid rgba(45,122,45,0.2)',
            }}
          >
            <Shield size={11} />
            Segurança / Alterar Senha
          </button>
        </div>

        {/* ── Navegação ── */}
        <nav className="flex-1 p-3.5 overflow-y-auto">
          <div className="flex items-center justify-between px-2 mb-3">
            <p
              className="text-[9px] font-black uppercase tracking-[0.2em]"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Navegação
            </p>
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="p-1.5 rounded-lg transition-colors"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              title={isDark ? "Modo Claro" : "Modo Escuro"}
            >
              {isDark
                ? <Sun className="w-3.5 h-3.5 text-yellow-300" />
                : <Moon className="w-3.5 h-3.5 text-green-300" />
              }
            </button>
          </div>

          <div className="space-y-0.5">
            {navigation.map((item, index) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group"
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(45,122,45,0.55), rgba(45,122,45,0.30))'
                      : 'transparent',
                    color: isActive ? '#ffffff' : 'rgba(255,255,255,0.80)',
                    border: isActive
                      ? '1px solid rgba(45,122,45,0.45)'
                      : '1px solid transparent',
                    boxShadow: isActive ? '0 2px 12px rgba(45,122,45,0.25)' : 'none',
                    animationDelay: `${index * 40}ms`,
                    animation: 'slideIn 0.3s ease-out',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.10)';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(200,230,200,0.65)';
                    }
                  }}
                >
                  <item.icon
                    className="w-4 h-4 shrink-0 transition-colors"
                    style={{ color: isActive ? '#72cf72' : 'rgba(115,207,115,0.55)' }}
                  />
                  <span className="truncate text-[13px]">{item.name}</span>
                  {isActive && (
                    <div
                      className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ background: '#72cf72', boxShadow: '0 0 6px #72cf72' }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {profile?.role === 'admin' && (
            <>
              <div className="mt-5 mb-2 px-2">
                <p
                  className="text-[9px] font-black uppercase tracking-[0.2em]"
                  style={{ color: 'rgba(115,207,115,0.35)' }}
                >
                  Administração
                </p>
              </div>
              <div className="space-y-0.5">
                {adminNavigation.map((item, index) => {
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200"
                      style={{
                        background: isActive
                          ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(99,102,241,0.15))'
                          : 'transparent',
                        color: isActive ? '#a5b4fc' : 'rgba(200,230,200,0.65)',
                        border: isActive ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                        animationDelay: `${(navigation.length + index) * 40}ms`,
                        animation: 'slideIn 0.3s ease-out',
                      }}
                    >
                      <item.icon
                        className="w-4 h-4 shrink-0"
                        style={{ color: isActive ? '#a5b4fc' : 'rgba(115,207,115,0.55)' }}
                      />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </nav>

        {/* ── Footer da sidebar ── */}
        <div
          className="px-4 py-3 shrink-0"
          style={{ borderTop: '1px solid rgba(45,122,45,0.12)' }}
        >
          <p
            className="text-[9px] text-center font-medium"
            style={{ color: 'rgba(115,207,115,0.3)' }}
          >
            EUNAMAN © {new Date().getFullYear()} · v1.0
          </p>
        </div>
      </aside>

      {/* ── Main content wrapper ── */}
      <div className="lg:pl-64 flex flex-col min-h-screen relative z-10">
        {/* Mobile header */}
        <header
          className="lg:hidden sticky top-0 z-30 px-4 py-3"
          style={{
            background: 'rgba(8,28,8,0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(45,122,45,0.2)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <Menu className="w-5 h-5 text-green-300" />
              </button>
              <div className="flex items-center gap-2">
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693aa6d5db2859afdc9fa993/3c0451f21_04-EPNG.png"
                  alt="Eunaman Logo"
                  className="w-7 h-7 object-contain"
                />
                <span className="font-black text-white tracking-wider text-sm">EUNAMAN</span>
              </div>
            </div>

            <Link href="/perfil" className="lg:hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-8 h-8 rounded-full" style={{ border: '1.5px solid rgba(45,122,45,0.5)' }} />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-green-300 font-bold text-[11px]"
                  style={{ background: 'rgba(45,122,45,0.3)', border: '1px solid rgba(45,122,45,0.4)' }}
                >
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
