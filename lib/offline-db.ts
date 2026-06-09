/**
 * CLIENT-SIDE INDEXEDDB DATABASE WRAPPER FOR EUNAMAN SISTEMA
 * Native promise-based wrapper for local caching and synchronization queues.
 */

export interface SyncItem {
  id?: number;
  entity: 'os' | 'preventiva' | 'horimetro' | 'pneu' | 'backlog' | 'colaborador';
  action: 'create' | 'update' | 'delete' | 'bulk_delete' | 'import' | 'update_status' | 'register';
  payload: any;
  timestamp: number;
}

export class OfflineDB {
  private dbName = 'eunaman_local_db';
  private dbVersion = 2;
  private db: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Erro ao abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // Tabelas de Entidades (Cache Local)
        if (!db.objectStoreNames.contains('ordens_servico')) {
          db.createObjectStore('ordens_servico', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('preventivas')) {
          db.createObjectStore('preventivas', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('horimetros')) {
          db.createObjectStore('horimetros', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pneus_inspecao')) {
          db.createObjectStore('pneus_inspecao', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('backlog')) {
          db.createObjectStore('backlog', { keyPath: 'id' });
        }

        // Tabelas de Cache de Seleção / Auxiliares
        if (!db.objectStoreNames.contains('equipamentos')) {
          db.createObjectStore('equipamentos', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('catalogo_manutencao')) {
          db.createObjectStore('catalogo_manutencao', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('calendario_suzano')) {
          db.createObjectStore('id' as any || 'mes_ano' as any || 'mes'); // Will resolve below safely
        }
        if (!db.objectStoreNames.contains('aux_config')) {
          db.createObjectStore('aux_config', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('colaboradores')) {
          db.createObjectStore('colaboradores', { keyPath: 'id' });
        }

        // Fila de Sincronização
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  // --- Operações Genéricas de Leitura e Escrita ---

  async getAll<T = any>(storeName: string): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T = any>(storeName: string, key: string | number): Promise<T | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName: string, value: any): Promise<void> {
    const db = await this.open();
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
    const db = await this.open();
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
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMany(storeName: string, keys: (string | number)[]): Promise<void> {
    const db = await this.open();
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
    const db = await this.open();
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
    const db = await this.open();
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
    // Ordena pelo timestamp garantindo a ordem cronológica estrita de lançamentos
    return queue.sort((a, b) => a.timestamp - b.timestamp);
  }

  async removeFromQueue(id: number): Promise<void> {
    await this.delete('sync_queue', id);
  }
}

// --- Funções Auxiliares de Serialização para FormData (Necessário para IndexedDB) ---

export function serializeFormData(formData: FormData): Record<string, any> {
  const obj: Record<string, any> = {};
  formData.forEach((value, key) => {
    // Se o valor for um arquivo, o IndexedDB suporta gravar File/Blob nativamente!
    obj[key] = value;
  });
  return obj;
}

export function deserializeToFormData(obj: Record<string, any>): FormData {
  const formData = new FormData();
  Object.entries(obj).forEach(([key, value]) => {
    if (value instanceof Blob) {
      // Se for Blob/File recuperado do IndexedDB, anexa preservando metadados
      const name = (value as any).name || 'file';
      formData.append(key, value, name);
    } else if (value != null) {
      formData.append(key, String(value));
    }
  });
  return formData;
}

export const localDb = new OfflineDB();
