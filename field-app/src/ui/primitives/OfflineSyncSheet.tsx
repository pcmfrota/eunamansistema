import { useState } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Send,
  Database,
  ClipboardList,
  Calendar,
  CircleDot,
  FileText,
  Clock,
  Droplets,
  Fuel,
} from "lucide-react";
import { useOffline } from "@/components/offline-provider";
import { cn } from "@/lib/utils";
import type { SyncItem } from "@/lib/offline-db";
import { BottomSheet } from "./BottomSheet";

// Rótulos/ícones de item da fila de sincronização — movidos de
// compat/offline-provider.tsx (Fase 3): são puramente apresentacionais, o
// provider voltou a ser só estado/contexto.
function getEntityLabel(entity: string) {
  switch (entity) {
    case "captacao": return "Captação de Água";
    case "os": return "Ordem de Serviço";
    case "preventiva": return "Preventiva";
    case "horimetro": return "Horímetro";
    case "pneu": return "Boletim de Pneus";
    case "backlog": return "Backlog";
    case "lavagem": return "Controle de Lavagens";
    case "calendario": return "Calendário Suzano";
    case "colaborador": return "Colaborador";
    case "prev_prog_semanal": return "Prog. Preventiva";
    case "insumos_fichas_abastecimento": return "Ficha de Abastecimento";
    case "insumos_abastecimento_linhas": return "Lançamento de Abastecimento";
    case "insumos_fichas_recarga": return "Ficha de Recarga";
    case "insumos_maquina_adhoc": return "Máquina Cadastrada em Campo";
    case "ficha_mao_obra": return "Ficha de Mão de Obra";
    case "apontamento_mao_obra": return "Apontamento de Mão de Obra";
    default: return entity;
  }
}

function getActionLabel(action: string) {
  switch (action) {
    case "create": return "Novo Registro";
    case "update": return "Alteração";
    case "delete": return "Exclusão";
    case "bulk_delete": return "Exclusão em Lote";
    case "import": return "Importação";
    case "update_status": return "Alterar Status";
    case "register": return "Cadastro";
    case "close": return "Fechamento";
    case "add_lancamento": return "Novo Lançamento";
    case "delete_lancamento": return "Excluir Lançamento";
    case "validate": return "Validação";
    case "save_calendario": return "Salvar Escala";
    case "update_status_prog_semanal": return "Atualizar Prog. Preventiva";
    case "abrir_ficha": return "Abertura de Ficha";
    case "atualizar_cabecalho": return "Atualizar Cabeçalho";
    case "atualizar_insumo": return "Ajuste de Insumo";
    case "salvar_linha": return "Lançamento de Abastecimento";
    case "excluir_linha": return "Excluir Lançamento";
    case "finalizar": return "Finalização";
    case "update_lancamento": return "Alterar Lançamento";
    default: return action;
  }
}

function getEntityColor(entity: string) {
  switch (entity) {
    case "captacao": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    case "os": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    case "preventiva":
    case "horimetro": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "pneu": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    case "backlog": return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
    case "lavagem": return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
    case "insumos_fichas_abastecimento":
    case "insumos_abastecimento_linhas":
    case "insumos_fichas_recarga":
    case "insumos_maquina_adhoc": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    case "ficha_mao_obra":
    case "apontamento_mao_obra": return "text-violet-400 bg-violet-500/10 border-violet-500/20";
    default: return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
  }
}

function getEntityIcon(entity: string) {
  switch (entity) {
    case "captacao": return <Droplets size={14} />;
    case "os": return <ClipboardList size={14} />;
    case "preventiva":
    case "horimetro": return <Calendar size={14} />;
    case "pneu": return <CircleDot size={14} />;
    case "backlog": return <FileText size={14} />;
    case "lavagem": return <Droplets size={14} />;
    case "insumos_fichas_abastecimento":
    case "insumos_abastecimento_linhas": return <Fuel size={14} />;
    case "insumos_fichas_recarga": return <Droplets size={14} />;
    case "ficha_mao_obra":
    case "apontamento_mao_obra": return <Clock size={14} />;
    default: return <Database size={14} />;
  }
}

function getItemDescription(item: SyncItem) {
  const p: any = item.payload || {};
  if (item.entity === "captacao") {
    if (p.caminhao) return `Caminhão: ${p.caminhao}`;
    if (p.motorista) return `Motorista: ${p.motorista}`;
    if (p.id_ficha) return `Ficha ID: ${p.id_ficha}`;
  }
  if (item.entity === "os") {
    if (p.numero) return `O.S. Nº ${p.numero}`;
    if (p.equipamento) return `Equipamento: ${p.equipamento}`;
  }
  if (item.entity === "preventiva" || item.entity === "horimetro") {
    if (p.prefixo) return `Prefixo: ${p.prefixo}`;
    if (p.caminhao) return `Caminhão: ${p.caminhao}`;
  }
  if (item.entity === "pneu") {
    if (p.prefixo) return `Prefixo: ${p.prefixo}`;
    if (p.fogo) return `Pneu Fogo: ${p.fogo}`;
  }
  if (item.entity === "backlog") {
    if (p.prefixo) return `Prefixo: ${p.prefixo}`;
    if (p.os_vinculada) return `O.S.: ${p.os_vinculada}`;
  }
  if (item.entity === "insumos_fichas_abastecimento" || item.entity === "insumos_abastecimento_linhas") {
    if (p.fichaId) return `Ficha: ${String(p.fichaId).slice(0, 8)}`;
  }
  if (p.id) return `ID: ${p.id}`;
  return "";
}

/** Badge âncorado na AppBar (ver ui/primitives/AppBar.tsx) + sheet de detalhe da fila
 * de sincronização. Substitui o pill/drawer fixos que viviam dentro do próprio
 * compat/offline-provider.tsx (Fase 3) — o provider agora só expõe estado. */
export function OfflineStatusBadge() {
  const { isOnline, pendingCount, syncing, triggerSync, queueItems, recentlySynced, showSyncSuccess } = useOffline();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Status de sincronização"
        className={cn(
          "flex items-center gap-1.5 px-2.5 rounded-xl border text-xs font-bold",
          !isOnline
            ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
            : syncing
            ? "border-blue-500/30 text-blue-400 bg-blue-500/10"
            : showSyncSuccess
            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
            : "border-zinc-800 text-zinc-500 bg-zinc-900"
        )}
        style={{ minHeight: "var(--tap-min)" }}
      >
        {!isOnline ? (
          <WifiOff size={15} />
        ) : syncing ? (
          <RefreshCw size={15} className="animate-spin" />
        ) : showSyncSuccess ? (
          <CheckCircle2 size={15} />
        ) : (
          <Wifi size={15} />
        )}
        {pendingCount > 0 && (
          <span className="bg-black/30 px-1.5 py-0.5 rounded-md text-[10px]">{pendingCount}</span>
        )}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Status de Conectividade">
        <div className="space-y-5 pb-2">
          <div
            className={cn(
              "p-3.5 rounded-2xl border text-xs leading-relaxed font-bold",
              isOnline
                ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-400"
                : "bg-amber-500/5 border-amber-500/15 text-amber-400"
            )}
          >
            {isOnline
              ? pendingCount > 0
                ? "Conexão ativa! Existem rascunhos salvos no aparelho aguardando sincronização."
                : "Sistema totalmente conectado e sincronizado."
              : "Trabalhando offline — tudo salvo no aparelho e sincroniza sozinho quando a conexão voltar."}
          </div>

          <div className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Pendentes ({pendingCount})
            </h3>
            {queueItems.length === 0 ? (
              <p className="text-xs text-zinc-600 py-4 text-center border border-dashed border-zinc-800 rounded-2xl">
                Nenhum rascunho pendente
              </p>
            ) : (
              <div className="space-y-2">
                {queueItems.map((item, idx) => (
                  <div
                    key={item.id ?? idx}
                    className="flex items-center gap-2.5 p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs"
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                        getEntityColor(item.entity)
                      )}
                    >
                      {getEntityIcon(item.entity)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-100 truncate">{getEntityLabel(item.entity)}</p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {getActionLabel(item.action)} · {getItemDescription(item)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {recentlySynced.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Sincronizados agora ({recentlySynced.length})
              </h3>
              <div className="space-y-2">
                {recentlySynced.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl text-xs"
                  >
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <p className="font-bold text-emerald-400 truncate">{getEntityLabel(item.entity)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isOnline && pendingCount > 0 && (
            <button
              onClick={() => triggerSync()}
              disabled={syncing}
              className="w-full rounded-xl bg-amber-600 active:bg-amber-700 text-white text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ minHeight: "var(--tap-min)" }}
            >
              {syncing ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              {syncing ? "Sincronizando..." : "Sincronizar agora"}
            </button>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
