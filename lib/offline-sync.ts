import { createClient } from "@/utils/supabase/client";
import { localDb } from "./offline-db";

export async function syncAllTables(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Verifica se o navegador está online antes de começar
  if (!navigator.onLine) {
    console.log("[Sync Engine] Dispositivo offline. Sincronização em lote abortada.");
    return false;
  }

  const supabase = createClient();
  console.log("[Sync Engine] Iniciando sincronização em lote de todas as tabelas...");

  try {
    // 1. Equipamentos
    const { data: equipamentos, error: errEq } = await supabase
      .from("equipamentos")
      .select("id, placa, modulo, area, tipo, categoria, status, created_at, deleted_at")
      .is("deleted_at", null);
    if (errEq) throw errEq;
    if (equipamentos) {
      await localDb.clearStore("equipamentos");
      await localDb.saveMany("equipamentos", equipamentos);
    }

    // 2. Escala Frota
    const { data: escala, error: errEsc } = await supabase
      .from("escala_frota")
      .select("*");
    if (errEsc) throw errEsc;
    if (escala) {
      await localDb.clearStore("escala_frota");
      await localDb.saveMany("escala_frota", escala);
    }

    // 3. Calendário Suzano
    const { data: calendario, error: errCal } = await supabase
      .from("calendario_suzano")
      .select("*")
      .order("ano", { ascending: true })
      .order("mes", { ascending: true });
    if (errCal) throw errCal;
    if (calendario) {
      await localDb.clearStore("calendario_suzano");
      await localDb.saveMany("calendario_suzano", calendario);
    }

    // 4. Ordens de Serviço (com join para manter compatibilidade)
    const { data: ordens, error: errOS } = await supabase
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
      .limit(1000);
    if (errOS) throw errOS;
    if (ordens) {
      await localDb.clearStore("ordens_servico");
      await localDb.saveMany("ordens_servico", ordens);
    }

    // 5. Preventivas (com join para manter compatibilidade)
    const { data: preventivas, error: errPrev } = await supabase
      .from("preventivas")
      .select("*, equipamentos(placa, tipo, categoria, modulo)")
      .order("data_atualizacao", { ascending: false });
    if (errPrev) throw errPrev;
    if (preventivas) {
      await localDb.clearStore("preventivas");
      await localDb.saveMany("preventivas", preventivas);
    }

    // 6. Inspeções Pneus (com join para manter compatibilidade)
    const { data: inspecoes, error: errPneus } = await supabase
      .from("inspecoes_pneus")
      .select(`
        id, equipamento_id, data_inspecao, km_atual, condicao, observacoes, created_at,
        de, dd, tei, tee, tdi, tde, tei1, tee1, tdi1, tde1, estepe,
        equipamentos(placa, tipo, modulo, categoria)
      `)
      .order("data_inspecao", { ascending: false })
      .order("created_at", { ascending: false });
    if (errPneus) throw errPneus;
    if (inspecoes) {
      await localDb.clearStore("pneus_inspecao");
      await localDb.saveMany("pneus_inspecao", inspecoes);
    }

    // 7. Backlog
    const { data: backlog, error: errBacklog } = await supabase
      .from("backlog")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (errBacklog) throw errBacklog;
    if (backlog) {
      await localDb.clearStore("backlog");
      await localDb.saveMany("backlog", backlog);
    }

    // 8. Catálogo Manutenção
    const { data: catalogo, error: errCat } = await supabase
      .from("catalogo_manutencao")
      .select("*")
      .order("sistema_codigo");
    if (errCat) throw errCat;
    if (catalogo) {
      await localDb.clearStore("catalogo_manutencao");
      await localDb.saveMany("catalogo_manutencao", catalogo);
    }

    // 9. Configurações Auxiliares
    const { data: aux, error: errAux } = await supabase
      .from("aux_config")
      .select("*");
    if (errAux) throw errAux;
    if (aux) {
      await localDb.clearStore("aux_config");
      await localDb.saveMany("aux_config", aux);
    }

    // 10. Colaboradores
    const { data: colaboradores, error: errColab } = await supabase
      .from("colaboradores")
      .select("*")
      .order("nome");
    if (errColab) throw errColab;
    if (colaboradores) {
      await localDb.clearStore("colaboradores");
      await localDb.saveMany("colaboradores", colaboradores);
    }

    // 11. Captação de Água (Fichas e Lançamentos)
    const { data: fichas, error: errFichas } = await supabase
      .from("fichas_captacao")
      .select("*")
      .order("created_at", { ascending: false });
    if (errFichas) throw errFichas;
    if (fichas) {
      await localDb.clearStore("fichas_captacao");
      await localDb.saveMany("fichas_captacao", fichas);
    }

    const { data: lancamentos, error: errLanc } = await supabase
      .from("lancamentos_captacao")
      .select("*");
    if (errLanc) throw errLanc;
    if (lancamentos) {
      await localDb.clearStore("lancamentos_captacao");
      await localDb.saveMany("lancamentos_captacao", lancamentos);
    }

    // 12. Lavagens
    const { data: lavagens, error: errLav } = await supabase
      .from("lavagens")
      .select("*");
    if (errLav) throw errLav;
    if (lavagens) {
      await localDb.clearStore("lavagens");
      await localDb.saveMany("lavagens", lavagens);
    }

    // 13. Programação Preventiva
    const { data: progSemanal, error: errProg } = await supabase
      .from("prev_prog_semanal")
      .select("*");
    if (errProg) throw errProg;
    if (progSemanal) {
      await localDb.clearStore("prev_prog_semanal");
      await localDb.saveMany("prev_prog_semanal", progSemanal);
    }

    console.log("[Sync Engine] Sincronização em lote finalizada com sucesso!");
    return true;
  } catch (err) {
    console.error("[Sync Engine] Falha geral ao sincronizar tabelas em lote:", err);
    return false;
  }
}
