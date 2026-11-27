// Certificados do Controle de Baterias no Supabase Storage (bucket privado) — lado do
// aparelho. Usado pela tela (online) e pelo reenvio da fila offline (lib/offline-actions.ts).

import { createClient } from "@/utils/supabase/client";
import { salvarBateria, type CertificadoInfo, type SalvarBateriaPayload } from "@/app/controle-baterias/actions";
import { BUCKET_CERTIFICADOS, TIPOS_CERTIFICADO, TAMANHO_MAX_CERTIFICADO, nomeArquivoSeguro, type DadosBateria } from "@/lib/baterias";

export type ArquivoLocal = { dataUrl: string; nome: string; tipo: string };

/** O que vai pra fila offline (e o que a tela envia online). */
export type EnvioBateria = DadosBateria & {
  id: string;
  observacoes?: string | null;
  /** Arquivo novo a enviar. */
  certificado_arquivo?: ArquivoLocal | null;
  /** true = remover o certificado atual (sem substituir). */
  remover_certificado?: boolean;
};

export function validarArquivoCertificado(f: { type: string; size: number }): string | null {
  if (!(TIPOS_CERTIFICADO as readonly string[]).includes(f.type)) return "Formato não aceito. Envie PDF, JPG, JPEG ou PNG.";
  if (f.size > TAMANHO_MAX_CERTIFICADO) return "Arquivo maior que 10 MB.";
  return null;
}

export function lerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function dataUrlParaBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

async function enviarArquivo(bateriaId: string, arq: ArquivoLocal): Promise<CertificadoInfo> {
  const supabase = createClient();
  const path = `${bateriaId}/${Date.now()}_${nomeArquivoSeguro(arq.nome)}`;
  const blob = await dataUrlParaBlob(arq.dataUrl);
  const { error } = await supabase.storage.from(BUCKET_CERTIFICADOS).upload(path, blob, { contentType: arq.tipo, upsert: false });
  if (error) throw new Error("Falha ao enviar o certificado: " + error.message);
  return { path, nome: arq.nome, tipo: arq.tipo };
}

/**
 * Envia o certificado (se houver) e grava a bateria. Se o banco recusar, apaga o arquivo
 * recém-enviado pra não deixar órfão no Storage.
 */
export async function enviarBateria(envio: EnvioBateria) {
  const { certificado_arquivo, remover_certificado, ...dados } = envio;
  let certificado: CertificadoInfo | null | undefined = undefined;
  if (certificado_arquivo) certificado = await enviarArquivo(envio.id, certificado_arquivo);
  else if (remover_certificado) certificado = null;

  const payload: SalvarBateriaPayload = { ...dados, certificado };
  const res = await salvarBateria(payload);
  if ("error" in res && certificado) {
    await createClient().storage.from(BUCKET_CERTIFICADOS).remove([certificado.path]).catch(() => undefined);
  }
  return res;
}

/** URL temporária (1 h) pra ver ou baixar o certificado. */
export async function urlCertificado(path: string, baixarComo?: string): Promise<string> {
  const { data, error } = await createClient().storage
    .from(BUCKET_CERTIFICADOS)
    .createSignedUrl(path, 3600, baixarComo ? { download: baixarComo } : undefined);
  if (error || !data?.signedUrl) throw new Error("Não foi possível abrir o certificado: " + (error?.message || "sem URL"));
  return data.signedUrl;
}
