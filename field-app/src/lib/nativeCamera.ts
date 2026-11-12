import { useEffect, useRef } from "react";

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
 * em primeiro plano — qualquer estado só em memória JS se perde nesse meio-tempo. O
 * resultado da foto chega de volta via window.onEunamanCameraResult (callback global que o
 * Java chama) ou, se a Activity foi recriada, via EunamanCamera.getPendingPhoto() logo no
 * remount. `storageKey` guarda qual campo estava "esperando" a foto para sobreviver a essa
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

  useEffect(() => {
    // Confirma pro Java que o lote foi aplicado (apaga as pendentes lá) e libera o campo —
    // sem isso, reabrir a tela entregava as mesmas fotos de novo via getPendingPhoto.
    const confirmarRecebimento = () => {
      try {
        (window as any).EunamanCamera?.clearPendingPhotos?.();
      } catch {}
      localStorage.removeItem(storageKey);
    };

    (window as any).onEunamanCameraResult = (jsonStr: string) => {
      try {
        const result = JSON.parse(jsonStr);
        // Fotos chegam uma por vez com index/total; o lote pendente chega inteiro (dataUrls)
        // e sem index — nesse caso (e no cancelamento) a entrega já terminou.
        const ultima = result.index == null || result.total == null || result.index >= result.total - 1;
        const alvo = localStorage.getItem(storageKey);
        if (!result.success) {
          if (result.error) console.warn("[EunamanCamera] Erro na ponte nativa:", result.error);
          if (ultima && alvo) confirmarRecebimento();
          return;
        }
        if (!alvo) return;
        const fotos: string[] = Array.isArray(result.dataUrls) ? result.dataUrls : result.dataUrl ? [result.dataUrl] : [];
        // Já vem processada pelo nativo (EXIF + 1600px/80%) — não recomprime.
        for (const foto of fotos) onResultRef.current(alvo, foto);
        if (ultima) confirmarRecebimento();
      } catch (e) {
        console.error("[EunamanCamera] Erro ao processar resultado:", e);
      }
    };

    const timer = setTimeout(() => {
      if ((window as any).EunamanCamera?.getPendingPhoto) {
        try {
          const pending = (window as any).EunamanCamera.getPendingPhoto();
          if (pending) (window as any).onEunamanCameraResult(pending);
        } catch (e) {
          console.warn("[EunamanCamera] Erro ao buscar foto pendente:", e);
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      delete (window as any).onEunamanCameraResult;
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
