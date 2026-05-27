/**
 * ADAPTIVE OFFLINE ACTIONS LAYER FOR EUNAMAN SISTEMA
 * Orchestrates online/offline decision making and replays enqueued operations.
 */

import { SyncItem, deserializeToFormData, serializeFormData } from "./offline-db";
import { 
  criarOrdemServico, 
  atualizarStatusOS, 
  atualizarOrdemServico, 
  excluirOrdemServico, 
  excluirOrdensMassivo, 
  importarOrdensServico 
} from "@/app/os/actions";
import { 
  criarPreventiva, 
  excluirPreventiva, 
  atualizarPreventiva, 
  registrarHorimetro,
  importarPreventivas
} from "@/app/preventivas/actions";
import { 
  registrarInspecaoCompleta, 
  atualizarInspecao, 
  excluirInspecao, 
  excluirInspecoesMassivo, 
  importarInspecoesPneus 
} from "@/app/pneus/actions";
import { 
  upsertBacklogItem, 
  deleteBacklogItems, 
  importarBacklog 
} from "@/app/backlog/actions";

// --- 1. REPLAY ENGINE (Chamado pelo OfflineProvider) ---
export async function replaySyncItem(item: SyncItem): Promise<boolean> {
  const { entity, action, payload } = item;
  
  try {
    console.log(`[Sync Engine] Reexecutando ${entity}:${action}...`);

    if (entity === "os") {
      if (action === "create") {
        const formData = deserializeToFormData(payload);
        const res = await criarOrdemServico(formData);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "update") {
        const { id, ...data } = payload;
        const formData = deserializeToFormData(data);
        const res = await atualizarOrdemServico(id, formData);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "update_status") {
        const { id, status } = payload;
        const res = await atualizarStatusOS(id, status);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "delete") {
        const res = await excluirOrdemServico(payload);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "bulk_delete") {
        const res = await excluirOrdensMassivo(payload);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "import") {
        const res = await importarOrdensServico(payload);
        if (res && "error" in res) throw new Error(res.error);
      }
    } 
    
    else if (entity === "preventiva") {
      if (action === "create") {
        const formData = deserializeToFormData(payload);
        const res = await criarPreventiva(formData);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "delete") {
        const res = await excluirPreventiva(payload);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "update") {
        const { id, ...data } = payload;
        const res = await atualizarPreventiva(id, data);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "import") {
        const res = await importarPreventivas(payload);
        if (res && "error" in res) throw new Error(res.error);
      }
    } 
    
    else if (entity === "horimetro") {
      if (action === "register") {
        const formData = deserializeToFormData(payload);
        const res = await registrarHorimetro(formData);
        if (res && "error" in res) throw new Error(res.error);
      }
    } 
    
    else if (entity === "pneu") {
      if (action === "create") {
        const formData = deserializeToFormData(payload);
        const res = await registrarInspecaoCompleta(formData);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "update") {
        const { id, ...data } = payload;
        const formData = deserializeToFormData(data);
        const res = await atualizarInspecao(id, formData);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "delete") {
        const res = await excluirInspecao(payload);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "bulk_delete") {
        const res = await excluirInspecoesMassivo(payload);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "import") {
        const res = await importarInspecoesPneus(payload);
        if (res && "error" in res) throw new Error(res.error);
      }
    } 
    
    else if (entity === "backlog") {
      if (action === "create" || action === "update") {
        const res = await upsertBacklogItem(payload);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "delete") {
        const res = await deleteBacklogItems(payload);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "import") {
        const res = await importarBacklog(payload);
        if (res && "error" in res) throw new Error(res.error);
      }
    }

    return true;
  } catch (err: any) {
    console.error(`[Sync Engine] Falha grave no replay ${entity}:${action}:`, err);
    // Retorna falso para sinalizar falha no item (interrompe o lote temporariamente)
    return false;
  }
}
