"use client";

import { useEffect } from "react";
import { useOffline } from "@/components/offline-provider";

/**
 * Sem isso, clicar num link do menu enquanto offline (ex: Dashboard -> Preventivas) não
 * carrega uma página nova pelo navegador — o Next.js App Router faz a troca de tela via
 * fetch interno (RSC) dos dados da rota, e esse fetch simplesmente falha sem internet, sem
 * fallback pro cache do Service Worker (que só sabe responder por navegação de página
 * completa). O resultado pro usuário é a tela preta/travada ao trocar de módulo offline,
 * mesmo com a página de destino já pré-cacheada.
 *
 * A correção: enquanto offline, qualquer clique num link interno força uma navegação de
 * página inteira (window.location) em vez da troca via JS do Next — só assim o Service
 * Worker entra em ação e serve a página do cache.
 */
export function OfflineNavGuard() {
  const { isOnline } = useOffline();

  useEffect(() => {
    if (isOnline) return;

    const handleClick = (event: MouseEvent) => {
      // Só intercepta clique simples do botão esquerdo, sem modificadores (deixa
      // ctrl/cmd/shift/middle-click abrirem em nova aba normalmente)
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      // Só força navegação completa para rotas internas (mesma origem)
      if (url.origin !== window.location.origin) return;
      // Mesma página (só mudou a âncora/hash) — deixa o navegador tratar normalmente
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.href = url.pathname + url.search + url.hash;
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [isOnline]);

  return null;
}
