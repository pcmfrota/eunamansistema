/**
 * ADAPTIVE OFFLINE ACTIONS LAYER FOR EUNAMAN SISTEMA
 * Orchestrates online/offline decision making and replays enqueued operations.
 */

import { SyncItem, deserializeToFormData } from "./offline-db";
import { 
  criarOrdemServico, 
  atualizarStatusOS, 
  atualizarOrdemServico, 
  excluirOrdemServico, 
  excluirOrdensMassivo, 
  importarOrdensServico,
  aprovarOrdemServico
} from "@/app/os/actions";

import { 
  criarPreventiva, 
  excluirPreventiva, 
  atualizarPreventiva, 
  importarPreventivas,
  registrarHorimetro
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

import {
  criarFicha,
  fecharFicha,
  excluirFicha,
  adicionarLancamento,
  excluirLancamento,
  atualizarFicha
} from "@/app/captacao/actions";

// Mapa em memória para associar números de OS temporários criados offline com os reais criados no servidor
const tempToRealOSMap: Record<string, string> = {};

// --- 1. REPLAY ENGINE (Chamado pelo OfflineProvider) ---
export async function replaySyncItem(item: SyncItem): Promise<boolean> {
  const { entity, action, payload } = item;
  
  try {
    console.log(`[Sync Engine] Reexecutando ${entity}:${action}...`);

    if (entity === "os") {
      if (action === "create") {
        const tempNum = payload.temp_numero_os; // Recupera o número temporário, se houver
        const formData = deserializeToFormData(payload);
        const res = await criarOrdemServico(formData);
        if (res && "error" in res) throw new Error(res.error);
        
        // Mapeia o número temporário para o real retornado pelo Supabase
        if (tempNum && res && (res as any).numero_os) {
          const realNum = (res as any).numero_os;
          tempToRealOSMap[tempNum] = realNum;
          if (typeof window !== "undefined") {
            localStorage.setItem(`sync_os_map_${tempNum}`, realNum);
          }
        }
      } else if (action === "update") {
        const { id, ...data } = payload;
        const formData = deserializeToFormData(data);
        const res = await atualizarOrdemServico(id, formData);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "update_status") {
        const { id, status } = payload;
        const res = await atualizarStatusOS(id, status);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "approve") {
        const { id } = payload;
        const res = await aprovarOrdemServico(id);
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
        // Se a OS associada for temporária, remapeia para o número real gerado no sync
        const tempOS = payload.os;
        if (tempOS && tempOS.startsWith("OS-OFF-")) {
          const realOSNum = tempToRealOSMap[tempOS] || (typeof window !== "undefined" ? localStorage.getItem(`sync_os_map_${tempOS}`) : null);
          if (realOSNum) {
            payload.os = realOSNum;
          }
        }
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
    
    else if (entity === "colaborador") {
      if (action === "create") {
        const { createClient } = await import("@/utils/supabase/client");
        const supabase = createClient();
        const { error } = await supabase.from('colaboradores').insert({
          id: payload.id.startsWith('temp_') ? undefined : payload.id,
          nome: payload.nome
        });
        if (error) throw new Error(error.message);
      } else if (action === "delete") {
        const { createClient } = await import("@/utils/supabase/client");
        const supabase = createClient();
        const { error } = await supabase.from('colaboradores').delete().eq('id', payload.id);
        if (error) throw new Error(error.message);
      }
    }
    
    else if (entity === "captacao") {
      if (action === "create") {
        const res = await criarFicha(payload);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "update") {
        const { id, ...updates } = payload;
        const res = await atualizarFicha(id, updates);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "close") {
        const res = await fecharFicha(payload.id);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "delete") {
        const res = await excluirFicha(payload.id);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "add_lancamento") {
        const res = await adicionarLancamento(payload);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "delete_lancamento") {
        const res = await excluirLancamento(payload.id);
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
