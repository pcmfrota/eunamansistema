"use client";

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { KeyRound, Mail, AlertCircle, Loader2 } from 'lucide-react'

// Renderizamos aqui a UI Premium para Login
export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(searchParams?.error || null);
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string || '').trim();
    const password = formData.get('password') as string;

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      const user = data.user;
      if (user) {
        // 1. Busca o perfil e permissões imediatamente para preencher o cache local
        const userEmailBase = user.email?.toLowerCase().trim() || '';
        const isMasterAdmin = 
          userEmailBase.includes('marcos.rocha') || 
          userEmailBase.includes('marcos.aurelio') ||
          userEmailBase.includes('marcos.aurelio.rocha') ||
          userEmailBase.includes('douglas.torres') ||
          userEmailBase.includes('jessica') ||
          userEmailBase.includes('pcmfrota') ||
          userEmailBase.includes('marcos.eunaman') ||
          userEmailBase.includes('eunaman.sistema') ||
          userEmailBase.endsWith('@eunaman.com.br');

        // Busca do banco em paralelo
        const [profileRes, permRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, role, avatar_url, status').eq('id', user.id).maybeSingle(),
          supabase.from('role_permissions').select('role, allowed_tabs')
        ]);

        // Cadastro feito pelo próprio usuário fica travado até um admin aprovar — a senha
        // já é válida no Auth, mas ninguém entra de fato enquanto status !== 'aprovado'.
        if (profileRes?.data && profileRes.data.status && profileRes.data.status !== 'aprovado') {
          await supabase.auth.signOut();
          throw new Error(
            profileRes.data.status === 'rejeitado'
              ? 'Seu cadastro foi rejeitado. Fale com um administrador para mais informações.'
              : 'Seu cadastro ainda está aguardando aprovação de um administrador.'
          );
        }

        const profileData = profileRes?.data;
        const allPerms = permRes?.data || [];

        const tokenRole = user.app_metadata?.role || user.user_metadata?.role;
        const finalRole = 
          (profileData?.role as any) || 
          (tokenRole as any) || 
          (isMasterAdmin ? 'admin' : 'visitante');

        const finalProfile = {
          id: user.id,
          email: user.email || '',
          full_name: profileData?.full_name || userEmailBase.split('@')[0] || 'Usuário',
          role: finalRole,
          avatar_url: profileData?.avatar_url || null
        };

        const rolePerm = allPerms.find(p => p.role === finalRole);
        let finalPerms: string[] = [];
        const allTabs = ['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens', '/captacao', '/documentos', '/admin/usuarios'];
        
        if (rolePerm?.allowed_tabs && rolePerm.allowed_tabs.length > 0) {
          finalPerms = rolePerm.allowed_tabs;
        } else {
          if (finalRole === 'admin') finalPerms = allTabs;
          else if (finalRole === 'visitante') finalPerms = ['/', '/preventivas', '/backlog', '/calendario', '/documentos'];
          else if (finalRole === 'mecanico') finalPerms = ['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/calendario', '/captacao', '/documentos'];
          else if (finalRole === 'motorista') finalPerms = ['/', '/pneus', '/calendario', '/lavagens', '/captacao', '/documentos'];
          else finalPerms = allTabs.filter(t => t !== '/admin/usuarios');
        }

        // Salva tudo no localStorage para o AuthProvider restaurar instantaneamente
        localStorage.setItem(`eunaman_profile_${user.id}`, JSON.stringify(finalProfile));
        localStorage.setItem(`eunaman_perms_${user.id}`, JSON.stringify(finalPerms));
        localStorage.setItem('eunaman_last_user_id', user.id);
        
        // Define o cookie de role temporário imediatamente no cliente para a middleware
        document.cookie = `x-user-role=${finalRole}; path=/; max-age=3600; SameSite=Lax`;
      }

      // 2. Aguarda até que o cookie do Supabase apareça no navegador (evitando redirecionamento prematuro sem sessão)
      const startCheck = Date.now();
      let cookieFound = false;
      while (Date.now() - startCheck < 1000) {
        if (document.cookie.split(';').some(c => c.trim().startsWith('sb-'))) {
          cookieFound = true;
          break;
        }
        await new Promise(r => setTimeout(r, 50));
      }
      
      // Fallback: se não achar, aguarda no mínimo 250ms totais para gravação assíncrona
      if (!cookieFound) {
        const elapsed = Date.now() - startCheck;
        if (elapsed < 250) {
          await new Promise(r => setTimeout(r, 250 - elapsed));
        }
      }

      // Recarrega o roteador e redireciona definitivamente
      router.refresh();
      window.location.replace('/');
    } catch (err: any) {
      console.error('[Login] Erro ao entrar:', err);
      setError(err.message || 'Credenciais inválidas ou erro ao conectar');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-zinc-50 dark:bg-black p-4 items-center justify-center overflow-hidden">
      {/* Background Image Oficial EUNAMAN */}
      <div className="absolute inset-0 z-0 bg-zinc-950">
        <img 
          src="/bg-eunaman.png" 
          alt="EUNAMAN Background" 
          className="h-full w-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?q=80&w=2076&auto=format&fit=crop";
          }}
        />
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
      </div>

      <div className="z-10 w-full max-w-md">
        <div className="mb-10 flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center p-4 bg-white/95 rounded-3xl shadow-2xl border border-white/20 mb-4">
            <img 
              src="/logo-eunaman-full.png" 
              alt="EUNAMAN" 
              className="h-24 w-auto brightness-110 contrast-110"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-xl p-8 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900/60 transition-all duration-300">
          <h2 className="mb-6 text-xl font-semibold text-zinc-800 dark:text-zinc-200 text-center">
            Bem-vindo de volta
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
            <div className="space-y-2">
              <label 
                htmlFor="email" 
                className="text-sm font-medium leading-none text-zinc-700 dark:text-zinc-300"
              >
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="voce@exemplo.com"
                  required
                  className="w-full rounded-xl border border-zinc-300 bg-white px-10 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label 
                  htmlFor="password" 
                  className="text-sm font-medium leading-none text-zinc-700 dark:text-zinc-300"
                >
                  Senha
                </label>
                <a 
                  href="/login/forgot-password" 
                  className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  Esqueci minha senha
                </a>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-zinc-300 bg-white px-10 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:ring-blue-500"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-900/50 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <LoginButton isSubmitting={isSubmitting} />
          </form>

          <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Não tem uma conta?{" "}
            <Link href="/login/cadastro" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
              Criar cadastro
            </Link>
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500">
          Esta é uma área restrita. O acesso não autorizado é proibido.
        </p>
      </div>
    </div>
  )
}

function LoginButton({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className="group relative w-full overflow-hidden rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 dark:focus:ring-offset-zinc-900"
    >
      <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
        <div className="relative h-full w-8 bg-white/20" />
      </div>
      <span className="relative z-10 flex items-center justify-center gap-2">
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Entrando...
          </>
        ) : (
          "Entrar no Sistema"
        )}
      </span>
    </button>
  );
}
