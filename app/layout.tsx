import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { MainLayout } from "@/components/main-layout";
import { AuthProvider } from "@/components/auth-context";
import { OfflineProvider } from "@/components/offline-provider";
import { ServiceWorkerRegistrar } from "@/components/sw-registrar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Eunaman PCM — Gestão de Frota",
  description: "Sistema de Gestão de Frota e PCM Offline-First",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EUNAMAN",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // "dark" aplicado por padrão no servidor para evitar flash sem estilo
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="dark" storageKey="eunaman-theme">
          <AuthProvider>
            <OfflineProvider>
              <MainLayout>
                {children}
              </MainLayout>
              <ServiceWorkerRegistrar />
            </OfflineProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

