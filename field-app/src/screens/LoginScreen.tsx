import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

// Login direto contra o Supabase (sem Server Action) — o AuthProvider real
// (@/components/auth-context, portado de components/auth-context.tsx) já escuta
// onAuthStateChange e assume sozinho assim que o login aqui der certo.
export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) setErro(error.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-5">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h1 className="text-lg font-black text-zinc-50">EUNAMAN Campo</h1>
        <p className="text-xs text-zinc-500">Faça login online pelo menos uma vez — depois disso funciona offline o dia inteiro.</p>
        {erro && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-xl p-3">{erro}</div>}
        <div>
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block mb-1.5">E-mail</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-50 outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block mb-1.5">Senha</label>
          <input
            type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-50 outline-none focus:border-amber-500"
          />
        </div>
        <button type="submit" disabled={enviando} className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold disabled:opacity-50">
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
