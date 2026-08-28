import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { MainLayout } from "@/components/main-layout";
import { AuthProvider } from "@/components/auth-context";
import { OfflineProvider } from "@/components/offline-provider";
import { ServiceWorkerRegistrar } from "@/components/sw-registrar";
import { OfflineNavGuard } from "@/components/offline-nav-guard";

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
    <html lang="pt-BR" className="light" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/*
          Rede de seguranca de ultimo nivel, em JS puro fora da arvore React: todas as outras
          travas contra a tela de carregamento presa (o timer de 15s do MainLayout, o watchdog
          nativo da WebView, o timeout no fetch do Service Worker) dependem do React ja estar
          rodando. Se o React nunca chegar a hidratar (erro de hidratacao silencioso, excecao
          antes da montagem, etc.), nenhuma delas executa e a tela SSR de "Carregando Sistema"
          fica visualmente presa para sempre, sem nenhuma saida. Este script roda assim que o
          HTML e parseado, nao depende de nenhum componente ter montado, e so verifica o texto
          visivel na pagina apos 18s (tempo maior que as demais travas, pra so agir quando elas
          de fato falharem).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              setTimeout(function() {
                try {
                  if (document.getElementById('eunaman-boot-fallback')) return;
                  var texto = (document.body && document.body.innerText) || '';
                  if (texto.indexOf('Carregando Sistema') === -1) return;

                  var overlay = document.createElement('div');
                  overlay.id = 'eunaman-boot-fallback';
                  overlay.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;background:#0a0a0a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;font-family:sans-serif;text-align:center;');

                  var msg = document.createElement('p');
                  msg.textContent = 'O aplicativo esta demorando demais para iniciar.';
                  msg.setAttribute('style', 'font-size:14px;opacity:0.8;max-width:280px;margin:0 0 4px;');
                  overlay.appendChild(msg);

                  var btnReload = document.createElement('button');
                  btnReload.textContent = 'RECARREGAR';
                  btnReload.setAttribute('style', 'padding:14px 28px;border-radius:12px;background:#059669;color:#fff;border:none;font-weight:900;font-size:14px;cursor:pointer;width:240px;');
                  btnReload.onclick = function() { window.location.reload(); };
                  overlay.appendChild(btnReload);

                  var btnClear = document.createElement('button');
                  btnClear.textContent = 'LIMPAR DADOS E REINICIAR';
                  btnClear.setAttribute('style', 'padding:12px 28px;border-radius:12px;background:transparent;color:#ef4444;border:1.5px solid #ef4444;font-weight:bold;font-size:12px;cursor:pointer;width:240px;');
                  btnClear.onclick = function() {
                    try {
                      if (window.EunamanApp && window.EunamanApp.clearCache) {
                        window.EunamanApp.clearCache();
                        return;
                      }
                    } catch (e) {}
                    var finalizar = function() { window.location.reload(); };
                    try {
                      localStorage.clear();
                      sessionStorage.clear();
                    } catch (e) {}
                    try {
                      if (window.caches && caches.keys) {
                        caches.keys().then(function(nomes) {
                          return Promise.all(nomes.map(function(n) { return caches.delete(n); }));
                        }).then(function() {
                          if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
                            return navigator.serviceWorker.getRegistrations().then(function(regs) {
                              return Promise.all(regs.map(function(r) { return r.unregister(); }));
                            });
                          }
                        }).then(finalizar, finalizar);
                      } else {
                        finalizar();
                      }
                    } catch (e) {
                      finalizar();
                    }
                  };
                  overlay.appendChild(btnClear);

                  document.body.appendChild(overlay);
                } catch (e) {}
              }, 18000);
            })();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="light" storageKey="eunaman-theme">
          <AuthProvider>
            <OfflineProvider>
              <MainLayout>
                {children}
              </MainLayout>
              <ServiceWorkerRegistrar />
              <OfflineNavGuard />
            </OfflineProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

