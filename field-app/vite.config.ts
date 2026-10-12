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
      { find: "@/utils/supabase/client", replacement: path.resolve(__dirname, "src/lib/supabase-client.ts") },
      { find: "@/lib", replacement: path.resolve(__dirname, "../lib") },
      { find: "@/components", replacement: path.resolve(__dirname, "../components") },
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
