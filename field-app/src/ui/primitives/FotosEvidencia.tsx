import { useRef } from "react";
import { Camera, Image as ImageIcon, X } from "lucide-react";

/**
 * Grupo de até `max` fotos de evidência — usado no Backlog (evidência de Atividade/
 * Conclusão) e no Checklist Mecânico (Pendências Adicionais). Toque abre a câmera nativa
 * direto (não a galeria), com "escolher da galeria" como opção secundária explícita — ver
 * skill de padronização de câmera (lib/nativeCamera.ts faz a ponte com o EunamanCamera).
 */
export function FotosEvidencia({
  fotos,
  max = 2,
  processando,
  onCapturar,
  onGaleria,
  onRemover,
  onExpandir,
}: {
  fotos: string[];
  max?: number;
  processando: boolean;
  onCapturar: () => void;
  onGaleria: (file: File) => void;
  onRemover: (idx: number) => void;
  onExpandir: (foto: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="grid grid-cols-2 gap-3">
      {fotos.map((foto, idx) => (
        <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-black">
          <img src={foto} alt={`Evidência ${idx + 1}`} className="w-full h-full object-cover" onClick={() => onExpandir(foto)} />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemover(idx); }}
            className="absolute top-1.5 right-1.5 p-1.5 bg-red-600 active:bg-red-700 text-white rounded-full shadow"
            style={{ minWidth: "28px", minHeight: "28px" }}
          >
            <X size={12} className="stroke-[3]" />
          </button>
        </div>
      ))}
      {fotos.length < max && (
        <button
          type="button"
          onClick={onCapturar}
          disabled={processando}
          className="aspect-video rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900 flex flex-col items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {processando ? (
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Processando...</span>
          ) : (
            <>
              <Camera size={20} className="text-zinc-500" />
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tirar Foto</span>
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="flex items-center gap-1 text-[9px] font-bold text-zinc-500 underline underline-offset-2 mt-0.5"
              >
                <ImageIcon size={10} /> ou escolher da galeria
              </span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onGaleria(file);
              e.target.value = "";
            }}
          />
        </button>
      )}
    </div>
  );
}

/** Lightbox simples pra ver uma foto de evidência em tela cheia. */
export function FotoExpandidaOverlay({ foto, onClose }: { foto: string | null; onClose: () => void }) {
  if (!foto) return null;
  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/95 p-4" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-3 bg-zinc-900 text-white rounded-full border border-zinc-800"
        style={{ minWidth: "44px", minHeight: "44px" }}
      >
        <X size={18} />
      </button>
      <img src={foto} className="max-w-full max-h-full object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
