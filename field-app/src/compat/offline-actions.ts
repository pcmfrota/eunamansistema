// Versão do app de campo de lib/offline-actions.ts (app principal) — mesmo motor de
// replay da fila de sincronização, mas só com as entidades dos módulos JÁ PORTADOS pra
// cá (ver o plano em C:\Users\pcmeu\.claude\plans\misty-bubbling-cookie.md). O arquivo
// original importa as actions "use server" de TODOS os módulos do sistema inteiro —
// isso não funciona aqui (a maioria ainda usa Server Actions/revalidatePath, que não
// existem fora do Next.js). Conforme cada módulo for portado numa próxima fase, replica
// a branch correspondente do arquivo original aqui (mesmo formato, só trocando o import
// pra cópia local do módulo).
import { SyncItem, deserializeToFormData } from "@/lib/offline-db";
import {
  registrarInspecaoCompleta,
  atualizarInspecao,
  excluirInspecao,
  excluirInspecoesMassivo,
  importarInspecoesPneus,
} from "../modules/pneus/actions";

export async function replaySyncItem(item: SyncItem): Promise<{ success: boolean; error?: string; retryable?: boolean }> {
  const { entity, action, payload } = item;

  try {
    console.log(`[Sync Engine] Reexecutando ${entity}:${action}...`);

    if (entity === "pneu") {
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

    return { success: true };
  } catch (err: any) {
    console.error(`[Sync Engine] Falha grave no replay ${entity}:${action}:`, err);
    const retryable = isRetryableError(err);
    return { success: false, error: err.message || String(err), retryable };
  }
}

function isRetryableError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error || "").toLowerCase();

  const nonRetryableKeywords = [
    "zod", "validation", "obrigatório", "required", "violates", "duplicate key",
    "not-null", "foreign key", "permission", "not authorized", "row-level security",
    "rls", "negada", "inválido", "invalid", "forbidden", "bad request", "null value",
    "apenas administradores", "pode cadastrar", "profiles_pkey", "unique_violation",
  ];

  for (const keyword of nonRetryableKeywords) {
    if (msg.includes(keyword)) return false;
  }

  return true;
}
