import { createClient } from "@/utils/supabase/client";
import { localDb } from "./offline-db";

async function safeSyncStore(
  storeName: string,
  serverItems: any[],
  idField: string = "id"
): Promise<void> {
  const localItems = await localDb.getAll(storeName);
  const serverIds = new Set(serverItems.map(item => item[idField]));

  // 1. Salva ou atualiza os itens que vieram do servidor no IndexedDB
  if (serverItems.length > 0) {
    await localDb.saveMany(storeName, serverItems);
  }

  // 2. Filtra itens locais para deletar: aqueles que não estão no servidor,
  // mas que NÃO sejam rascunhos ou registros criados offline pendentes de sync.
  const toDelete = localItems.filter((item: any) => {
    const isPending = item._isPendingSync || 
                      String(item[idField]).startsWith("temp_") ||
                      String(item[idField]).startsWith("os_draft_") || 
                      item.draftData;
                      
    const isTempOS = storeName === "ordens_servico" && 
                     (String(item.numero_os).startsWith("OS-OFF-") || String(item.numero_os).startsWith("temp_"));

    return !serverIds.has(item[idField]) && !isPending && !isTempOS;
  });

  if (toDelete.length > 0) {
    await localDb.deleteMany(storeName, toDelete.map((item: any) => item[idField]));
  }
}

export async function syncAllTables(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Verifica se o navegador está online antes de começar
  if (!navigator.onLine) {
    console.log("[Sync Engine] Dispositivo offline. Sincronização em lote abortada.");
    return false;
  }

  const supabase = createClient();
  console.log("[Sync Engine] Iniciando sincronização em lote isolada de todas as tabelas...");

  let successCount = 0;
  let failCount = 0;

  const syncTable = async (
    name: string,
    fetchFn: () => Promise<{ data: any[] | null; error: any }>,
    storeName: string = name,
    idField: string = "id"
  ) => {
    try {
      console.log(`[Sync Engine] Sincronizando tabela: ${name}...`);
      const { data, error } = await fetchFn();
      if (error) throw error;
      if (data) {
        await safeSyncStore(storeName, data, idField);
        console.log(`[Sync Engine] Tabela ${name} sincronizada com sucesso! (${data.length} itens)`);
        successCount++;
      } else {
        console.log(`[Sync Engine] Tabela ${name} retornou dados vazios.`);
      }
    } catch (err: any) {
      console.error(`[Sync Engine] Falha ao sincronizar tabela ${name}:`, err?.message || err);
      failCount++;
    }
  };

  // 1. Equipamentos
  await syncTable("equipamentos", () =>
    supabase
      .from("equipamentos")
      .select("id, placa, modulo, area, tipo, categoria, status, created_at, deleted_at")
      .is("deleted_at", null)
  );

  // 2. Escala Frota
  await syncTable("escala_frota", () =>
    supabase.from("escala_frota").select("*")
  );

  // 3. Calendário Suzano
  await syncTable("calendario_suzano", () =>
    supabase
      .from("calendario_suzano")
      .select("*")
      .order("ano", { ascending: true })
      .order("mes", { ascending: true })
  );

  // 4. Ordens de Serviço
  await syncTable("ordens_servico", () =>
    supabase
      .from("ordens_servico")
      .select(`
        id, numero_os, placa, modulo, status, data_abertura, data_fechamento, 
        horas_manutencao, descricao, horimetro, operacao_tipo, local, classe, 
        foi_enviado_reserva, motivo, sistema, sub_sistema, componente, 
        observacoes, horario_parada, equipamento_id, qual_reserva, horas_reserva_chegou,
        mecanicos, assinatura_mecanico, fotos,
        equipamento:equipamento_id (placa, modulo)
      `)
      .not("equipamento_id", "is", null)
      .order("data_abertura", { ascending: false })
      .limit(1000)
  );

  // 5. Preventivas
  await syncTable("preventivas", () =>
    supabase
      .from("preventivas")
      .select("*, equipamentos(placa, tipo, categoria, modulo)")
      .order("data_atualizacao", { ascending: false })
  );

  // 6. Inspeções Pneus
  await syncTable("inspecoes_pneus", () =>
    supabase
      .from("inspecoes_pneus")
      .select(`
        id, equipamento_id, data_inspecao, km_atual, condicao, observacoes, created_at,
        de, dd, tei, tee, tdi, tde, tei1, tee1, tdi1, tde1, estepe,
        equipamentos(placa, tipo, modulo, categoria)
      `)
      .order("data_inspecao", { ascending: false })
      .order("created_at", { ascending: false }),
    "pneus_inspecao"
  );

  // 7. Backlog
  await syncTable("backlog", () =>
    supabase
      .from("backlog")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000)
  );

  // 8. Catálogo Manutenção
  await syncTable("catalogo_manutencao", () =>
    supabase.from("catalogo_manutencao").select("*").order("sistema_codigo")
  );

  // 9. Configurações Auxiliares
  await syncTable("aux_config", () =>
    supabase.from("aux_config").select("*")
  );

  // 10. Colaboradores
  await syncTable("colaboradores", () =>
    supabase.from("colaboradores").select("*").order("nome")
  );

  // 11. Captação de Água (Fichas e Lançamentos)
  await syncTable("fichas_captacao", () =>
    supabase
      .from("fichas_captacao")
      .select("*")
      .order("created_at", { ascending: false })
  );

  await syncTable("lancamentos_captacao", () =>
    supabase.from("lancamentos_captacao").select("*")
  );

  // 12. Lavagens
  await syncTable("lavagens", () =>
    supabase.from("lavagens").select("*")
  );

  // 13. Programação Preventiva
  await syncTable("prev_prog_semanal", () =>
    supabase.from("prev_prog_semanal").select("*")
  );

  console.log(`[Sync Engine] Sincronização robusta finalizada. Sucesso: ${successCount}, Falhas: ${failCount}`);
  return successCount > 0;
}
