/**
 * CLIENT-SIDE INDEXEDDB DATABASE WRAPPER FOR EUNAMAN SISTEMA
 * Native promise-based wrapper for local caching and synchronization queues.
 */

export interface SyncItem {
  id?: number;
  entity: 'os' | 'preventiva' | 'horimetro' | 'pneu' | 'backlog' | 'colaborador' | 'captacao' | 'lavagem' | 'calendario' | 'prev_prog_semanal' | 'docs_tacografo' | 'docs_civ_cipp' | 'docs_laudo_eletromecanico' | 'docs_laudo_implemento' | 'docs_crlve_pesados' | 'docs_crlve_leve' | 'checklists_mecanicos' | 'ficha_mao_obra';
  action: 'create' | 'update' | 'delete' | 'bulk_delete' | 'import' | 'update_status' | 'register' | 'close' | 'add_lancamento' | 'delete_lancamento' | 'validate' | 'save_calendario' | 'update_status_prog_semanal';
  payload: any;
  timestamp: number;
}

export class OfflineDB {
  private dbName = 'eunaman_local_db';
  private dbVersion = 20;
  private db: IDBDatabase | null = null;

  private setupObjectStores(db: IDBDatabase) {
    // Autenticação Persistente e Sessão Local
    if (!db.objectStoreNames.contains('auth_session')) db.createObjectStore('auth_session', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('user_profile')) db.createObjectStore('user_profile', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('filiais')) db.createObjectStore('filiais', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('modulos')) db.createObjectStore('modulos', { keyPath: 'id' });

    // Mídia & Fotos Offline
    if (!db.objectStoreNames.contains('fotos_queue')) db.createObjectStore('fotos_queue', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('signatures_queue')) db.createObjectStore('signatures_queue', { keyPath: 'id' });

    // Tabelas de Entidades (Cache Local)
    if (!db.objectStoreNames.contains('ordens_servico')) db.createObjectStore('ordens_servico', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('preventivas')) db.createObjectStore('preventivas', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('horimetros')) db.createObjectStore('horimetros', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('pneus_inspecao')) db.createObjectStore('pneus_inspecao', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('backlog')) db.createObjectStore('backlog', { keyPath: 'id' });

    // Tabelas de Cache de Seleção / Auxiliares
    if (!db.objectStoreNames.contains('equipamentos')) db.createObjectStore('equipamentos', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('catalogo_manutencao')) db.createObjectStore('catalogo_manutencao', { keyPath: 'id' });
    if (db.objectStoreNames.contains('id')) db.deleteObjectStore('id');
    if (!db.objectStoreNames.contains('calendario_suzano')) db.createObjectStore('calendario_suzano', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('aux_config')) db.createObjectStore('aux_config', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('colaboradores')) db.createObjectStore('colaboradores', { keyPath: 'id' });

    // Fila de Sincronização
    if (!db.objectStoreNames.contains('sync_queue')) db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });

    // Captação de Água
    if (!db.objectStoreNames.contains('fichas_captacao')) db.createObjectStore('fichas_captacao', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('lancamentos_captacao')) db.createObjectStore('lancamentos_captacao', { keyPath: 'id' });

    // Escala de Frotas
    if (!db.objectStoreNames.contains('escala_frota')) db.createObjectStore('escala_frota', { keyPath: 'id' });

    // Lavagens
    if (!db.objectStoreNames.contains('lavagens')) db.createObjectStore('lavagens', { keyPath: 'id' });

    // Programação Preventiva
    if (!db.objectStoreNames.contains('prev_prog_semanal')) db.createObjectStore('prev_prog_semanal', { keyPath: 'id' });

    // Documentos
    if (!db.objectStoreNames.contains('docs_tacografo')) db.createObjectStore('docs_tacografo', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('docs_civ_cipp')) db.createObjectStore('docs_civ_cipp', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('docs_laudo_eletromecanico')) db.createObjectStore('docs_laudo_eletromecanico', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('docs_laudo_implemento')) db.createObjectStore('docs_laudo_implemento', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('docs_crlve_pesados')) db.createObjectStore('docs_crlve_pesados', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('docs_crlve_leve')) db.createObjectStore('docs_crlve_leve', { keyPath: 'id' });

    // Checklists Mecânicos
    if (!db.objectStoreNames.contains('checklists_mecanicos')) db.createObjectStore('checklists_mecanicos', { keyPath: 'id' });

    // Fichas Diárias de Mão de Obra
    if (!db.objectStoreNames.contains('fichas_mao_obra')) db.createObjectStore('fichas_mao_obra', { keyPath: 'id' });
  }

  async open(requiredStore?: string): Promise<IDBDatabase> {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      throw new Error("IndexedDB não disponível no ambiente atual.");
    }

    if (this.db) {
      if (!requiredStore || this.db.objectStoreNames.contains(requiredStore)) {
        return this.db;
      }
      try { this.db.close(); } catch (_) {}
      this.db = null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Erro ao abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const db = request.result;
        this.db = db;

        db.onversionchange = () => {
          try { db.close(); } catch (_) {}
          this.db = null;
        };

        resolve(db);
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        this.setupObjectStores(db);
      };
    });
  }

  // --- Operações Genéricas de Leitura e Escrita ---

  async getAll<T = any>(storeName: string): Promise<T[]> {
    const db = await this.open(storeName);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getManyStores<T = Record<string, any[]>>(storeNames: string[]): Promise<T> {
    if (!storeNames || storeNames.length === 0) return {} as T;
    // Tenta garantir que todas as stores existam
    let db = await this.open();
    for (const storeName of storeNames) {
      if (!db.objectStoreNames.contains(storeName)) {
        db = await this.open(storeName);
      }
    }
    return new Promise((resolve, reject) => {
      const validStores = storeNames.filter(name => db.objectStoreNames.contains(name));
      if (validStores.length === 0) return resolve({} as T);

      try {
        const transaction = db.transaction(validStores, 'readonly');
        const results: Record<string, any[]> = {};
        let count = validStores.length;

        transaction.onerror = () => reject(transaction.error);

        for (const name of validStores) {
          const store = transaction.objectStore(name);
          const request = store.getAll();
          request.onsuccess = () => {
            results[name] = request.result || [];
            count--;
            if (count === 0) resolve(results as T);
          };
          request.onerror = () => reject(request.error);
        }
      } catch (err) {
        reject(err);
      }
    });
  }


  async get<T = any>(storeName: string, key: string | number): Promise<T | null> {
    const db = await this.open(storeName);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName: string, value: any): Promise<void> {
    const db = await this.open(storeName);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // Se a tabela for calendario_suzano e não tiver chave Path, definimos chave manual
      let request;
      if (storeName === 'calendario_suzano' && !value.id) {
        const key = `${value.mes}-${value.ano}`;
        request = store.put({ ...value, id: key });
      } else {
        request = store.put(value);
      }

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveMany(storeName: string, values: any[]): Promise<void> {
    if (!values || values.length === 0) return;
    const db = await this.open(storeName);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      values.forEach((value) => {
        if (storeName === 'calendario_suzano' && !value.id) {
          const key = `${value.mes}-${value.ano}`;
          store.put({ ...value, id: key });
        } else {
          store.put(value);
        }
      });
    });
  }

  async delete(storeName: string, key: string | number): Promise<void> {
    const db = await this.open(storeName);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMany(storeName: string, keys: (string | number)[]): Promise<void> {
    const db = await this.open(storeName);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      keys.forEach((key) => {
        store.delete(key);
      });
    });
  }

  async clearStore(storeName: string): Promise<void> {
    const db = await this.open(storeName);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Métodos de Fila de Sincronização (Sync Queue) ---

  async addToQueue(
    entity: SyncItem['entity'],
    action: SyncItem['action'],
    payload: any
  ): Promise<number> {
    const db = await this.open('sync_queue');
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('sync_queue', 'readwrite');
      const store = transaction.objectStore('sync_queue');

      // Preparar payload para salvar no IndexedDB
      // Converte objetos FormData para Record<string, any> se necessário
      let processedPayload = payload;
      if (payload instanceof FormData) {
        processedPayload = serializeFormData(payload);
      }

      const item: SyncItem = {
        entity,
        action,
        payload: processedPayload,
        timestamp: Date.now()
      };

      const request = store.add(item);

      request.onsuccess = () => {
        resolve(request.result as number);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getQueue(): Promise<SyncItem[]> {
    const queue = await this.getAll<SyncItem>('sync_queue');
    // Filtra os itens ignorando os que falharam permanentemente e depois ordena pelo timestamp
    return queue
      .filter((item: any) => !item.failed)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async removeFromQueue(id: number): Promise<void> {
    await this.delete('sync_queue', id);
  }
}

// --- Funções Auxiliares de Serialização para FormData (Necessário para IndexedDB) ---

export function serializeFormData(formData: FormData): Record<string, any> {
  const obj: Record<string, any> = {};
  // Usa as chaves para capturar múltiplos valores caso existam (ex: arrays no FormData)
  const uniqueKeys = Array.from(new Set(formData.keys()));
  uniqueKeys.forEach((key) => {
    const allValues = formData.getAll(key);
    if (allValues.length > 1) {
      obj[key] = allValues;
    } else {
      obj[key] = allValues[0];
    }
  });
  return obj;
}

export function deserializeToFormData(obj: Record<string, any>): FormData {
  const formData = new FormData();
  Object.entries(obj).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item instanceof Blob) {
          const name = (item as any).name || 'file';
          formData.append(key, item, name);
        } else if (item != null) {
          formData.append(key, String(item));
        }
      });
    } else if (value instanceof Blob) {
      const name = (value as any).name || 'file';
      formData.append(key, value, name);
    } else if (value != null) {
      formData.append(key, String(value));
    }
  });
  return formData;
}

export const localDb = new OfflineDB();
