/**
 * OFFLINE MEDIA MANAGER FOR EUNAMAN SISTEMA
 * Handles offline photo and digital signature storage in IndexedDB/Filesystem
 * and automatic synchronization to Supabase Storage when online.
 */

import { localDb } from './offline-db';
import { createClient } from '@/utils/supabase/client';

export interface LocalMediaItem {
  id: string; // e.g. local_photo_169000000
  bucket: string; // e.g. 'checklists', 'ordens_servico', 'assinaturas'
  filePath: string; // e.g. 'checklists/ch_123_foto_1.jpg'
  dataUrl: string; // Base64 or Blob Data URL
  entityId?: string;
  entityTable?: string;
  createdAt: number;
  synced: boolean;
  remoteUrl?: string;
}

export class OfflineMediaManager {
  /**
   * Salva uma foto localmente no IndexedDB antes do envio online
   */
  async savePhotoLocally(
    dataUrlOrBase64: string,
    bucket: string,
    filePath: string,
    entityTable?: string,
    entityId?: string
  ): Promise<string> {
    const id = `local_photo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const mediaItem: LocalMediaItem = {
      id,
      bucket,
      filePath,
      dataUrl: dataUrlOrBase64,
      entityTable,
      entityId,
      createdAt: Date.now(),
      synced: false,
    };

    await localDb.put('fotos_queue', mediaItem);
    return id; // Retorna chave temporária local
  }

  /**
   * Salva uma assinatura digital localmente no IndexedDB
   */
  async saveSignatureLocally(
    base64Data: string,
    bucket: string,
    filePath: string,
    entityTable?: string,
    entityId?: string
  ): Promise<string> {
    const id = `local_sig_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const mediaItem: LocalMediaItem = {
      id,
      bucket,
      filePath,
      dataUrl: base64Data,
      entityTable,
      entityId,
      createdAt: Date.now(),
      synced: false,
    };

    await localDb.put('signatures_queue', mediaItem);
    return id;
  }

  /**
   * Converte DataURL Base64 para Blob para envio via Fetch/Supabase Storage
   */
  private dataURLtoBlob(dataurl: string): Blob {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1] || arr[0]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Sincroniza todas as mídias pendentes (fotos e assinaturas) com o Supabase Storage
   */
  async syncPendingMedia(): Promise<{ syncedPhotos: number; syncedSignatures: number }> {
    const supabase = createClient();
    if (!supabase) return { syncedPhotos: 0, syncedSignatures: 0 };

    let syncedPhotos = 0;
    let syncedSignatures = 0;

    // 1. Sincronizar Fotos Pendentes
    try {
      const pendingPhotos = await localDb.getAll<LocalMediaItem>('fotos_queue');
      for (const item of pendingPhotos) {
        if (item.synced) continue;

        try {
          const blob = this.dataURLtoBlob(item.dataUrl);
          const { data, error } = await supabase.storage
            .from(item.bucket)
            .upload(item.filePath, blob, { upsert: true });

          if (!error && data) {
            const { data: publicUrlData } = supabase.storage
              .from(item.bucket)
              .getPublicUrl(item.filePath);

            const remoteUrl = publicUrlData.publicUrl;
            item.synced = true;
            item.remoteUrl = remoteUrl;
            await localDb.put('fotos_queue', item);

            // Se estiver vinculada a uma entidade, atualiza o campo remoto no banco local
            if (item.entityTable && item.entityId) {
              const entity = await localDb.get(item.entityTable, item.entityId);
              if (entity) {
                entity.foto_url = remoteUrl;
                await localDb.put(item.entityTable, entity);
              }
            }
            syncedPhotos++;
          }
        } catch (photoErr) {
          console.warn(`[MediaSync] Erro ao enviar foto ${item.id}:`, photoErr);
        }
      }
    } catch (e) {
      console.error('[MediaSync] Erro no processamento de fotos:', e);
    }

    // 2. Sincronizar Assinaturas Pendentes
    try {
      const pendingSigs = await localDb.getAll<LocalMediaItem>('signatures_queue');
      for (const item of pendingSigs) {
        if (item.synced) continue;

        try {
          const blob = this.dataURLtoBlob(item.dataUrl);
          const { data, error } = await supabase.storage
            .from(item.bucket)
            .upload(item.filePath, blob, { upsert: true });

          if (!error && data) {
            const { data: publicUrlData } = supabase.storage
              .from(item.bucket)
              .getPublicUrl(item.filePath);

            const remoteUrl = publicUrlData.publicUrl;
            item.synced = true;
            item.remoteUrl = remoteUrl;
            await localDb.put('signatures_queue', item);

            if (item.entityTable && item.entityId) {
              const entity = await localDb.get(item.entityTable, item.entityId);
              if (entity) {
                entity.assinatura_url = remoteUrl;
                await localDb.put(item.entityTable, entity);
              }
            }
            syncedSignatures++;
          }
        } catch (sigErr) {
          console.warn(`[MediaSync] Erro ao enviar assinatura ${item.id}:`, sigErr);
        }
      }
    } catch (e) {
      console.error('[MediaSync] Erro no processamento de assinaturas:', e);
    }

    return { syncedPhotos, syncedSignatures };
  }
}

export const offlineMedia = new OfflineMediaManager();
