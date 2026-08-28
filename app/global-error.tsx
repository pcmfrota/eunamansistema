"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError] Erro crítico no layout raiz:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            width: "100%",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
            padding: "24px",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            background: "#09090b",
            color: "#f4f4f5",
          }}
        >
          <div
            style={{
              display: "flex",
              height: "64px",
              width: "64px",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "16px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#ef4444",
            }}
          >
            <AlertTriangle size={30} />
          </div>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
              O aplicativo encontrou um erro
            </h2>
            <p style={{ fontSize: "14px", color: "#a1a1aa", maxWidth: "360px", margin: "8px auto 0" }}>
              Tente novamente. Se estiver offline, algumas telas podem não estar disponíveis ainda neste aparelho.
            </p>
          </div>
          <button
            onClick={reset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "12px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
