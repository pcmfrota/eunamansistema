"use client";

import { useRef, useState } from "react";
import { Camera, X, Loader2, ImagePlus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { FotoEvidencia } from "./types";

interface Props {
  fotos: FotoEvidencia[];
  onChange: (fotos: FotoEvidencia[]) => void;
  max?: number;
  disabled?: boolean;
}

export default function FotosUploader({ fotos, onChange, max = 10, disabled }: Props) {
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const restantes = max - fotos.length;
    if (restantes <= 0) {
      setErro(`Máximo de ${max} fotos por lançamento.`);
      return;
    }
    const selecionados = Array.from(files).slice(0, restantes);
    setUploading(true);
    setErro("");
    try {
      const supabase = createClient();
      const novas: FotoEvidencia[] = [];
      for (const file of selecionados) {
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("programacao-mecanica-fotos").upload(fileName, file);
        if (uploadError) throw new Error(uploadError.message);
        const { data: { publicUrl } } = supabase.storage.from("programacao-mecanica-fotos").getPublicUrl(fileName);
        novas.push({ path: fileName, url: publicUrl });
      }
      onChange([...fotos, ...novas]);
    } catch (err: any) {
      setErro(err.message || "Erro ao enviar foto.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remover(path: string) {
    onChange(fotos.filter(f => f.path !== path));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
          Evidências Fotográficas ({fotos.length}/{max})
        </label>
        {!disabled && fotos.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs font-bold text-green-600 flex items-center gap-1 disabled:opacity-60"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            Adicionar fotos
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      {erro && <p className="text-xs text-red-600 mb-2">{erro}</p>}
      {fotos.length > 0 ? (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {fotos.map(f => (
            <div key={f.path} className="relative group aspect-square rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="Evidência" className="w-full h-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remover(f.path)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-400">
          <ImagePlus size={20} />
          <p className="text-[11px] mt-1">Nenhuma foto adicionada</p>
        </div>
      )}
    </div>
  );
}
