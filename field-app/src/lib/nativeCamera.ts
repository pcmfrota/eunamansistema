import { useEffect, useRef, useState } from "react";

/**
 * Ponte única com a câmera nativa do APK (CameraX embutido no processo do app, classe
 * Java EunamanCameraBridge — ver android-apk/.../EunamanCameraActivity.java). Antes desta
 * extração, 5 módulos (OS, Lubrificação, Lavagens, Insumos, Captação) reimplementavam o
 * mesmo código à mão, com pequenas divergências entre si. Todo módulo com captura de foto
 * deve usar só isto, para a experiência (e os bugs corrigidos aqui) ficarem iguais em
 * todos os lugares.
 *
 * Por que precisa de localStorage (não um useState/closure comum): em aparelhos com pouca
 * RAM, o Android pode recriar a Activity do WebView enquanto a tela da câmera nativa está
 * em primeiro plano — qualquer estado só em memória JS se perde nesse meio-tempo. As fotos
 * são sempre BUSCADAS com EunamanCamera.getPendingPhoto() (no aviso onEunamanFotosProntas
 * ou na montagem da tela); erro/cancelamento chega por onEunamanCameraResult. `storageKey` guarda qual campo estava "esperando" a foto para sobreviver a essa
 * recriação; o restante do formulário sobrevive à parte, com o próprio rascunho que cada
 * módulo já persiste em localStorage quando abre sua ficha/sheet.
 */
// Padrão 1600px/80% — mesma configuração da câmera nativa (EunamanActivity.MAX_IMAGE_SIZE_PX
// / JPEG_QUALITY). Usado só pra fotos que NÃO vêm da câmera nativa (ex: input de galeria do
// navegador); a foto da câmera nativa já chega processada e não passa mais por aqui.
export function compressPhoto(
  dataUrl: string,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
      } else {
        if (h > maxHeight) { w = Math.round((w * maxHeight) / h); h = maxHeight; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
  });
}

type LoteFotos = { alvo: string; fotos: string[]; aplicadoPor: number | null; renderAplicado: number };
/** Lotes buscados do nativo e ainda não confirmados por um render, por storageKey. */
function lotesEmMemoria(): Record<string, LoteFotos> {
  const w = window as any;
  return (w.__eunamanLotesFotos ||= {});
}
let proximoIdInstancia = 1;

export function hasNativeCamera(): boolean {
  return typeof window !== "undefined" && !!(window as any).EunamanCamera?.openCamera;
}

/**
 * @param storageKey chave própria do módulo (ex: "eunaman_pneus_active_photo_field") —
 *   isola o "campo ativo" entre módulos diferentes que possam estar montados.
 * @param onResult chamado com (fieldKey, dataUrl) UMA VEZ POR FOTO — num campo com várias
 *   fotos (openCamera com max > 1) é chamado várias vezes seguidas, uma pra cada. Vale
 *   tanto pro callback em tempo real quanto pro lote recuperado após recriação da Activity.
 */
export function useNativeCamera(
  storageKey: string,
  onResult: (fieldKey: string, compressedDataUrl: string) => void
) {
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const idRef = useRef(0);
  if (!idRef.current) idRef.current = proximoIdInstancia++;
  const renderRef = useRef(0);
  renderRef.current++;
  const [, forcarRender] = useState(0);

  // Depois de cada commit: se esta instância aplicou um lote e já renderizou com ele, o lote
  // está no estado da tela (e no rascunho que a tela salva no mesmo commit) — pode descartar.
  useEffect(() => {
    const lote = lotesEmMemoria()[storageKey];
    if (lote && lote.aplicadoPor === idRef.current && renderRef.current > lote.renderAplicado) {
      delete lotesEmMemoria()[storageKey];
    }
  });

  useEffect(() => {
    const w = window as any;
    // Modelo "puxar": o Java processa o lote inteiro, grava num arquivo e só então avisa
    // (onEunamanFotosProntas). A tela BUSCA o lote com getPendingPhoto(), que já o consome no
    // lado nativo. Se o aviso chegar com a tela desmontada, a busca feita na montagem pega o lote.
    //
    // Depois de buscado, o lote fica guardado em memória JS (sobrevive à remontagem do React)
    // até a tela RENDERIZAR com ele: ao voltar da câmera o app remonta a tela quase no mesmo
    // instante em que as fotos chegam — se elas forem aplicadas na instância que está saindo,
    // o estado nunca é gravado e se perderiam. Nesse caso a instância nova reaplica o lote
    // (por cima do rascunho restaurado, que não tem essas fotos), sem duplicar.
    let pronta = false;
    const aplicar = () => {
      const lote = lotesEmMemoria()[storageKey];
      if (!lote || lote.aplicadoPor !== null) return;
      lote.aplicadoPor = idRef.current;
      lote.renderAplicado = renderRef.current;
      // Já vem processada pelo nativo (EXIF + 1600px/80%) — não recomprime.
      for (const foto of lote.fotos) onResultRef.current(lote.alvo, foto);
      forcarRender((n) => n + 1);
    };
    const drenar = () => {
      if (!pronta) return; // a busca da montagem cuida disso
      const alvo = localStorage.getItem(storageKey);
      if (alvo && w.EunamanCamera?.getPendingPhoto) {
        let pending = "";
        try {
          pending = w.EunamanCamera.getPendingPhoto();
        } catch (e) {
          console.warn("[EunamanCamera] Erro ao buscar fotos:", e);
        }
        if (pending) {
          localStorage.removeItem(storageKey);
          try {
            const result = JSON.parse(pending);
            const fotos: string[] = Array.isArray(result.dataUrls) ? result.dataUrls : result.dataUrl ? [result.dataUrl] : [];
            if (fotos.length) lotesEmMemoria()[storageKey] = { alvo, fotos, aplicadoPor: null, renderAplicado: 0 };
          } catch (e) {
            console.error("[EunamanCamera] Erro ao processar fotos:", e);
          }
        }
      }
      aplicar();
    };

    // Erro/cancelamento: libera o campo que esperava a foto.
    const onErro = (jsonStr: string) => {
      try {
        const result = JSON.parse(jsonStr);
        if (result.success) return;
        if (result.error) console.warn("[EunamanCamera]", result.error);
      } catch {}
      localStorage.removeItem(storageKey);
    };

    // Registro compartilhado: mais de uma tela pode usar o hook ao mesmo tempo (chaves
    // diferentes) e o callback global é um só.
    const drenos: Set<() => void> = (w.__eunamanDrenosFotos ||= new Set());
    const erros: Set<(s: string) => void> = (w.__eunamanErrosFotos ||= new Set());
    drenos.add(drenar);
    erros.add(onErro);
    w.onEunamanFotosProntas = () => drenos.forEach((d) => d());
    w.onEunamanCameraResult = (s: string) => erros.forEach((f) => f(s));

    // Espera a tela restaurar o próprio rascunho antes de aplicar as fotos (senão a
    // restauração sobrescreveria as fotos recém-adicionadas).
    const timer = setTimeout(() => {
      pronta = true;
      drenar();
    }, 700);

    return () => {
      clearTimeout(timer);
      drenos.delete(drenar);
      erros.delete(onErro);
      // Desmontou antes de renderizar com o lote: devolve pra próxima instância aplicar.
      const lote = lotesEmMemoria()[storageKey];
      if (lote && lote.aplicadoPor === idRef.current) lote.aplicadoPor = null;
    };
  }, [storageKey]);

  /**
   * Abre a câmera nativa já marcando qual campo deve receber o resultado.
   * @param opts.max quantas fotos o campo ainda aceita (padrão 1 = campo de foto única). Com
   *   max > 1 o usuário pode tirar várias seguidas e/ou escolher várias da galeria.
   */
  const openCamera = (fieldKey: string, onUnavailable?: () => void, opts?: { max?: number }) => {
    const max = Math.max(1, Math.floor(opts?.max ?? 1));
    const cam = (window as any).EunamanCamera;
    if (!cam?.openCamera) {
      onUnavailable?.();
      return;
    }
    localStorage.setItem(storageKey, fieldKey);
    try {
      if (max > 1 && cam.openCameraMulti) cam.openCameraMulti(max);
      else cam.openCamera();
    } catch {
      localStorage.removeItem(storageKey);
      onUnavailable?.();
    }
  };

  return { hasNativeCamera: hasNativeCamera(), openCamera };
}
