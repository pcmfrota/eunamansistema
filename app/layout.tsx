import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { MainLayout } from "@/components/main-layout";
import { AuthProvider } from "@/components/auth-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Eunaman PCM — Gestão de Frota",
  description: "Sistema de Gestão de Frota e PCM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // "dark" aplicado por padrão no servidor para evitar flash sem estilo
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="dark" storageKey="eunaman-theme">
          <AuthProvider>
            <MainLayout>
              {children}
            </MainLayout>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
