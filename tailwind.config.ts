import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        green: {
          50: "#f4f8f6",
          100: "#e6f0eb",
          200: "#cce0d6",
          300: "#a6c7b7",
          400: "#7aa893",
          500: "#558b73",
          600: "#416e5a",
          700: "#345747",
          800: "#2b463b",
          900: "#243b32",
          950: "#13211b",
        },
        emerald: {
          50: "#f4f8f6",
          100: "#e6f0eb",
          200: "#cce0d6",
          300: "#a6c7b7",
          400: "#7aa893",
          500: "#558b73",
          600: "#416e5a",
          700: "#345747",
          800: "#2b463b",
          900: "#243b32",
          950: "#13211b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
