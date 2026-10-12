import type { Config } from "tailwindcss";
import baseConfig from "../tailwind.config";

// Reaproveita o tema do app principal (cores/tokens) pra manter a mesma identidade
// visual quando os componentes reais forem portados nas próximas fases — só troca
// os caminhos de "content" pros deste projeto Vite + os diretórios reaproveitados.
const config: Config = {
  ...baseConfig,
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../components/**/*.{ts,tsx}",
  ],
};
export default config;
