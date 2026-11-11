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
export function compressPhoto(
  dataUrl: string,
  maxWidth = 900,
  maxHeight = 900,
  quality = 0.65
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
 * @param onResult chamado com (fieldKey, dataUrl-já-comprimido) quando uma foto chega,
 *   seja pelo callback em tempo real ou recuperada após recriação da Activity.
 */
export function useNativeCamera(
  storageKey: string,
  onResult: (fieldKey: string, compressedDataUrl: string) => void
) {
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    (window as any).onEunamanCameraResult = async (jsonStr: string) => {
      try {
        const result = JSON.parse(jsonStr);
        if (!result.success || !result.dataUrl) {
          if (!result.success) console.warn("[EunamanCamera] Erro na ponte nativa:", result.error);
          return;
        }
        const alvo = localStorage.getItem(storageKey);
        if (!alvo) return;
        const compressed = await compressPhoto(result.dataUrl);
        onResultRef.current(alvo, compressed);
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

  /** Abre a câmera nativa já marcando qual campo deve receber o resultado. */
  const openCamera = (fieldKey: string, onUnavailable?: () => void) => {
    localStorage.setItem(storageKey, fieldKey);
    if ((window as any).EunamanCamera?.openCamera) {
      try {
        (window as any).EunamanCamera.openCamera();
      } catch {
        onUnavailable?.();
      }
    } else {
      onUnavailable?.();
    }
  };

  return { hasNativeCamera: hasNativeCamera(), openCamera };
}
