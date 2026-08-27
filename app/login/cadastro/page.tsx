"use client";

import { useState } from "react";
import Link from "next/link";
import { User, Mail, KeyRound, Briefcase, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { solicitarCadastro } from "./actions";

const CARGOS = [
  { value: "motorista", label: "Motorista" },
  { value: "mecanico", label: "Mecânico" },
  { value: "pcm", label: "PCM" },
  { value: "admin", label: "Admin" },
  { value: "gestao", label: "Gestão" },
  { value: "afiador", label: "Afiador" },
  { value: "visitante", label: "Visitante" },
];

const inputCls =
  "w-full rounded-xl border border-zinc-300 bg-white px-10 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:ring-blue-500";

export default function CadastroPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const res = await solicitarCadastro(formData);

    if ("error" in res && res.error) {
      setError(res.error);
      setIsSubmitting(false);
      return;
    }

    setEnviado(true);
    setIsSubmitting(false);
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
        <div className="mb-8 flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center p-4 bg-white/95 rounded-3xl shadow-2xl border border-white/20 mb-4">
            <img src="/logo-eunaman-full.png" alt="EUNAMAN" className="h-20 w-auto brightness-110 contrast-110" />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur-xl p-8 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900/60 transition-all duration-300">
          {enviado ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-full">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                Solicitação enviada!
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Seu cadastro foi enviado para aprovação de um administrador. Você vai poder entrar assim que ele for aprovado.
              </p>
              <Link
                href="/login"
                className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-6 text-xl font-semibold text-zinc-800 dark:text-zinc-200 text-center">
                Criar Conta
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label htmlFor="nome" className="text-sm font-medium leading-none text-zinc-700 dark:text-zinc-300">
                      Nome
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                      <input id="nome" name="nome" type="text" placeholder="João" required className={inputCls} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="sobrenome" className="text-sm font-medium leading-none text-zinc-700 dark:text-zinc-300">
                      Sobrenome
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                      <input id="sobrenome" name="sobrenome" type="text" placeholder="Silva" className={inputCls} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium leading-none text-zinc-700 dark:text-zinc-300">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                    <input id="email" name="email" type="email" placeholder="voce@exemplo.com" required className={inputCls} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium leading-none text-zinc-700 dark:text-zinc-300">
                    Senha
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
                    <input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="cargo" className="text-sm font-medium leading-none text-zinc-700 dark:text-zinc-300">
                    Cargo
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400 pointer-events-none" />
                    <select id="cargo" name="cargo" required defaultValue="" className={`${inputCls} appearance-none cursor-pointer`}>
                      <option value="" disabled>Selecione o cargo...</option>
                      {CARGOS.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-900/50 animate-in fade-in duration-200">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group relative w-full overflow-hidden rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 dark:focus:ring-offset-zinc-900"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                      </>
                    ) : (
                      "Enviar Solicitação de Cadastro"
                    )}
                  </span>
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Já tem uma conta?{" "}
                <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500">
          Seu cadastro só é liberado após aprovação de um administrador.
        </p>
      </div>
    </div>
  );
}
