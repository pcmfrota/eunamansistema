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
import {
  upsertBacklogItem,
  deleteBacklogItems,
  importarBacklog,
} from "../modules/backlog/actions";
import {
  criarFicha,
  atualizarFicha,
  fecharFicha,
  excluirFicha,
  adicionarLancamento,
  atualizarLancamento,
  excluirLancamento,
} from "../modules/captacao/actions";
import {
  salvarFichaMaoObra,
  excluirFichaMaoObra,
  salvarApontamento,
  excluirApontamento,
} from "../modules/mao-de-obra/actions";
import {
  saveLavagem,
  deleteLavagem,
} from "../modules/lavagens/actions";
import {
  criarPreventiva,
  excluirPreventiva,
  atualizarPreventiva,
  registrarHorimetro,
} from "../modules/preventivas/actions";
import {
  registrarFichaLubrificacao,
  atualizarFichaLubrificacao,
  excluirFichaLubrificacao,
} from "../modules/lubrificacao/actions";
import {
  abrirOuCriarFicha,
  atualizarCabecalhoFicha,
  atualizarFichaInsumo,
  finalizarFicha,
  salvarLinhaAbastecimento,
  excluirLinhaAbastecimento,
  criarRecargaFinalizada,
} from "../modules/insumos/actions";
import {
  salvarChecklistMecanico,
  excluirChecklistMecanico,
} from "../modules/checklist-mecanicos/actions";
import {
  criarOrdemServico,
  atualizarOrdemServico,
  atualizarStatusOS,
  aprovarOrdemServico,
  excluirOrdemServico,
} from "../modules/os/actions";

// Mapeia número de OS temporário (criado offline, "OS-OFF-...") -> número real gerado pelo
// servidor, assim como o app principal faz (lib/offline-actions.ts) — útil pra qualquer tela
// que precise exibir/referenciar o número real assim que ele existir (a convenção "OS-OFF-"
// em si também é obrigatória: lib/offline-sync.ts já usa esse prefixo, compartilhado com o
// app principal, pra não apagar um registro otimista ainda não sincronizado).
const tempToRealOSMap: Record<string, string> = {};

// Mapeia id temporário de ficha de Insumos -> id real gerado pelo servidor, assim como
// o app principal faz (lib/offline-actions.ts) — necessário porque linhas/cabeçalho/
// fechamento enfileirados depois na mesma ficha referenciam esse id antes dele existir.
const tempToRealFichaMapInsumos: Record<string, string> = {};

function resolveFichaIdInsumos(id: string): string {
  if (!id || !id.startsWith("temp_")) return id;
  const mapeado = tempToRealFichaMapInsumos[id] || (typeof window !== "undefined" ? localStorage.getItem(`sync_ficha_insumos_map_${id}`) : null);
  return mapeado || id;
}

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

    else if (entity === "backlog") {
      if (action === "create" || action === "update") {
        // Remapeamento de OS temporária (OS-OFF-...) pro número real: deixado só por
        // compatibilidade de formato com o payload do app principal — o módulo OS já foi
        // portado (Fase 6), mas a criação de OS no field-app não tem o seletor "vincular
        // backlogs pendentes" do NovoModal.tsx original (fora de escopo, ver
        // field-app/src/modules/os/OSClient.tsx), então nenhum item de backlog daqui chega
        // a ser enfileirado com um número de OS temporário — isso nunca dispara de verdade.
        const tempOS = payload.os;
        if (tempOS && typeof tempOS === "string" && tempOS.startsWith("OS-OFF-")) {
          const realOSNum = typeof window !== "undefined" ? localStorage.getItem(`sync_os_map_${tempOS}`) : null;
          if (realOSNum) payload.os = realOSNum;
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
      } else if (action === "update_lancamento") {
        const { id, ...updates } = payload;
        const res = await atualizarLancamento(id, updates);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "delete_lancamento") {
        const res = await excluirLancamento(payload.id);
        if (res && "error" in res) throw new Error(res.error);
      }
    }

    else if (entity === "ficha_mao_obra") {
      if (action === "create" || action === "update" || action === "close") {
        const res = await salvarFichaMaoObra(payload);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "delete") {
        const res = await excluirFichaMaoObra(payload.id);
        if (res && "error" in res) throw new Error(res.error);
      }
    }
    else if (entity === "apontamento_mao_obra") {
      if (action === "create" || action === "update") {
        const res = await salvarApontamento(payload);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "delete") {
        const res = await excluirApontamento(payload.id);
        if (res && "error" in res) throw new Error(res.error);
      }
    }

    else if (entity === "lavagem") {
      if (action === "create" || action === "update") {
        // itens_lavados chega serializado (JSON.stringify) na fila, igual o app principal
        // monta — saveLavagem aceita tanto string quanto array já desserializado.
        const res = await saveLavagem(payload);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "delete") {
        const res = await deleteLavagem(payload.id);
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
      }
    }

    else if (entity === "horimetro") {
      if (action === "register") {
        const formData = deserializeToFormData(payload);
        const res = await registrarHorimetro(formData);
        if (res && "error" in res) throw new Error(res.error);
      }
    }

    else if (entity === "ficha_lubrificacao" || entity === "lubrificacao") {
      if (action === "create") {
        const res = await registrarFichaLubrificacao(payload);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "update") {
        const { id, ...updates } = payload;
        const res = await atualizarFichaLubrificacao(id || payload.id, updates);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "delete") {
        const res = await excluirFichaLubrificacao(payload.id || payload);
        if (res && "error" in res) throw new Error(res.error);
      }
    }

    else if (entity === "insumos_fichas_abastecimento") {
      if (action === "abrir_ficha") {
        const { tempId, equipamentoId } = payload;
        const res = await abrirOuCriarFicha(equipamentoId);
        if (res.error || !res.ficha) throw new Error(res.error || "Falha ao abrir ficha de abastecimento.");
        const realId = res.ficha.ficha.id;
        tempToRealFichaMapInsumos[tempId] = realId;
        if (typeof window !== "undefined") localStorage.setItem(`sync_ficha_insumos_map_${tempId}`, realId);
      } else if (action === "atualizar_cabecalho") {
        const fichaId = resolveFichaIdInsumos(payload.fichaId);
        const res = await atualizarCabecalhoFicha(fichaId, payload.patch);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "atualizar_insumo") {
        const fichaId = resolveFichaIdInsumos(payload.fichaId);
        const res = await atualizarFichaInsumo(fichaId, payload.insumoTipo, payload.patch);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "finalizar") {
        const fichaId = resolveFichaIdInsumos(payload.fichaId);
        const res = await finalizarFicha(fichaId, payload.fechamento);
        if (res && "error" in res) throw new Error(res.error);
      }
    }

    else if (entity === "insumos_abastecimento_linhas") {
      const fichaId = resolveFichaIdInsumos(payload.fichaId);
      if (action === "salvar_linha") {
        const linha = { ...payload.linha };
        if (typeof linha.id === "string" && linha.id.startsWith("temp_")) delete linha.id;
        const res = await salvarLinhaAbastecimento(fichaId, linha);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "excluir_linha") {
        const res = await excluirLinhaAbastecimento(payload.linhaId, fichaId);
        if (res && "error" in res) throw new Error(res.error);
      }
    }

    else if (entity === "insumos_fichas_recarga") {
      if (action === "create") {
        const res = await criarRecargaFinalizada(payload);
        if (res && "error" in res) throw new Error(res.error);
      }
    }

    else if (entity === "os") {
      if (action === "create") {
        const tempNum = payload.temp_numero_os; // Número temporário, se houver
        const formData = deserializeToFormData(payload);
        const res = await criarOrdemServico(formData);
        if (res && "error" in res) throw new Error(res.error);

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
        const { id, etapa } = payload;
        const res = await aprovarOrdemServico(id, etapa);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "delete") {
        const res = await excluirOrdemServico(payload);
        if (res && "error" in res) throw new Error(res.error);
      }
    }

    else if (entity === "checklists_mecanicos") {
      if (action === "create") {
        const formData = deserializeToFormData(payload);
        const res = await salvarChecklistMecanico(formData);
        if (res && "error" in res) throw new Error(res.error);
      } else if (action === "delete") {
        const res = await excluirChecklistMecanico(payload);
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
