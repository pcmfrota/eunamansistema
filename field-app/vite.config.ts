import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// App de campo (Vite+React, sem Next.js/Server Actions) embutido no APK Android —
// ver o plano em C:\Users\pcmeu\.claude\plans\misty-bubbling-cookie.md.
//
// Os aliases abaixo reaproveitam lib/ e components/ do repo principal SEM duplicar
// código: lib/offline-db.ts, offline-sync.ts etc. são puro TypeScript sem nada do
// Next.js, então importam igual aqui. A ÚNICA exceção é "@/utils/supabase/client":
// o arquivo original lê process.env.NEXT_PUBLIC_* (convenção do Next.js/webpack),
// que não existe no bundle do Vite — por isso esse import específico é redirecionado
// pro shim local (src/lib/supabase-client.ts), que lê import.meta.env.VITE_* em vez
// disso. Tudo que os arquivos reaproveitados importam como "@/utils/supabase/client"
// continua funcionando sem precisar tocar no arquivo original.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Mais específicos primeiro (a ordem do array decide qual regra vence).
      { find: "@/utils/supabase/client", replacement: path.resolve(__dirname, "src/lib/supabase-client.ts") },
      { find: "@/components/auth-context", replacement: path.resolve(__dirname, "src/compat/auth-context.tsx") },
      // offline-provider.tsx original importa dinamicamente lib/offline-actions.ts, que
      // por sua vez importa as actions "use server" de TODO o sistema (a maioria ainda
      // não portada) — por isso usa uma cópia local que só sabe sobre os módulos já
      // portados, e troca a checagem de conectividade de /api/ping (não existe aqui)
      // por um fetch direto no Supabase.
      { find: "@/components/offline-provider", replacement: path.resolve(__dirname, "src/compat/offline-provider.tsx") },
      // "style jsx" (Next.js) não compila no Vite sem o compilador dele — cópia local
      // troca por um <style> comum (ver o arquivo).
      { find: "@/components/premium-loader", replacement: path.resolve(__dirname, "src/compat/premium-loader.tsx") },
      // Repositórios com acesso a dados precisam do client (não server) do Supabase —
      // cópias locais com só essa troca de import (ver field-app/src/repositories/).
      { find: "@/src/repositories/PneusRepository", replacement: path.resolve(__dirname, "src/repositories/PneusRepository.ts") },
      { find: "@/src/repositories/EquipamentoRepository", replacement: path.resolve(__dirname, "src/repositories/EquipamentoRepository.ts") },
      // Resto de lib/ e components/ é puro TypeScript sem nada do Next.js — reaproveita
      // direto do repo principal, sem copiar.
      { find: "@/lib", replacement: path.resolve(__dirname, "../lib") },
      { find: "@/components", replacement: path.resolve(__dirname, "../components") },
      { find: "@/hooks", replacement: path.resolve(__dirname, "../hooks") },
      { find: "@/src/models", replacement: path.resolve(__dirname, "../src/models") },
      { find: "@/src/utils", replacement: path.resolve(__dirname, "../src/utils") },
      { find: "@/utils", replacement: path.resolve(__dirname, "../utils") },
      { find: "@", replacement: path.resolve(__dirname, "..") },
    ],
  },
  base: "./", // caminhos relativos nos assets gerados — necessário pra abrir via file:// dentro do APK
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
