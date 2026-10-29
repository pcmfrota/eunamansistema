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

// Registro de promessas de sincronização ativas por tabela para evitar concorrência
const activeSyncs: Record<string, Promise<void> | null> = {};

// Mapeamento de nomes de tabelas para seus respectivos ID do IndexedDB se for diferente
const storeNames: Record<string, string> = {
  inspecoes_pneus: "pneus_inspecao",
};

// Funções de busca individuais por tabela
const syncTasks: Record<
  string,
  (supabase: any) => Promise<{ data: any[] | null; error: any }>
> = {
  equipamentos: (supabase) =>
    supabase
      .from("equipamentos")
      .select("id, placa, modelo, modulo, area, tipo, categoria, status, created_at, deleted_at, deposito_suzano, numero_tanques_diesel, capacidade_tanque_litros")
      .is("deleted_at", null),

  escala_frota: (supabase) =>
    supabase.from("escala_frota").select("*"),

  calendario_suzano: (supabase) =>
    supabase
      .from("calendario_suzano")
      .select("*")
      .order("ano", { ascending: true })
      .order("mes", { ascending: true }),

  // Fotos (foto_horimetro, foto_km, fotos) e assinatura_mecanico ficam de fora de
  // propósito — são base64 e essa sincronização roda no boot de TODO carregamento do
  // app, pra TODAS as OS. Isso sozinho estava consumindo uma fatia enorme da cota de
  // saída (egress) do Supabase. Quem abre a ficha de uma OS específica busca essas fotos
  // à parte (ver app/os/actions.ts).
  ordens_servico: (supabase) =>
    supabase
      .from("ordens_servico")
      .select(`
        id, numero_os, placa, modulo, status, data_abertura, data_fechamento,
        horas_manutencao, descricao, horimetro, km,
        operacao_tipo, local, classe,
        foi_enviado_reserva, motivo, sistema, sub_sistema, componente,
        observacoes, horario_parada, equipamento_id, qual_reserva, horas_reserva_chegou,
        mecanicos,
        aprovado, created_by, created_by_nome, aprovado_por, aprovado_por_nome, aprovado_em,
        equipamento:equipamento_id (placa, modulo)
      `)
      .not("equipamento_id", "is", null)
      .order("data_abertura", { ascending: false })
      .limit(1000),

  preventivas: (supabase) =>
    supabase
      .from("preventivas")
      .select("*, equipamentos(placa, modelo, tipo, categoria, modulo)")
      .order("data_atualizacao", { ascending: false }),

  inspecoes_pneus: (supabase) =>
    supabase
      .from("inspecoes_pneus")
      .select(`
        id, equipamento_id, data_inspecao, km_atual, condicao, observacoes, created_at,
        de, dd, tei, tee, tdi, tde, tei1, tee1, tdi1, tde1, estepe,
        equipamentos(placa, tipo, modulo, categoria)
      `)
      .order("data_inspecao", { ascending: false })
      .order("created_at", { ascending: false }),

  backlog: (supabase) =>
    supabase
      .from("backlog")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000),

  catalogo_manutencao: (supabase) =>
    supabase.from("catalogo_manutencao").select("*").order("sistema_codigo"),

  aux_config: (supabase) =>
    supabase.from("aux_config").select("*"),

  colaboradores: (supabase) =>
    supabase.from("colaboradores").select("*").order("nome"),

  // assinatura_supervisor fica de fora — base64 sem limite de linhas. Quem abre uma ficha
  // específica busca essa coluna à parte (ver obterImagensFichaCaptacao em app/captacao/actions.ts).
  fichas_captacao: (supabase) =>
    supabase
      .from("fichas_captacao")
      .select("id, ano, mes, placa, motorista, processo, nucleo, supervisor_suzano, codigo, revisao, status, criado_por, created_at, filial_id, reaberta_em")
      .order("created_at", { ascending: false }),

  // foto_ponto fica de fora pelo mesmo motivo (ver obterFotosLancamentosCaptacao).
  lancamentos_captacao: (supabase) =>
    supabase.from("lancamentos_captacao").select("id, ficha_id, data, id_ponto, hora_inicial, hora_final, volume_captado, fazenda_captada, up_captacao, atividade, fazenda_atividade, up_atividade, created_at"),

  // Fotos/assinatura (imagem_1/2/3_url, imagem_horimetro_url, assinatura_url) ficam de
  // fora — base64 sem limite de linhas, rodando no boot de TODO carregamento do app. Quem
  // abre uma lavagem específica busca essas colunas à parte (ver getLavagemImagens em
  // app/lavagens/actions.ts).
  lavagens: (supabase) =>
    supabase.from("lavagens").select("id, placa, data, colaborador, horimetro, km, status, lavagem_realizada, observacoes, itens_lavados, tipo_frota, created_at, validated_at, registrado_por, registrado_por_nome"),

  prev_prog_semanal: (supabase) =>
    supabase.from("prev_prog_semanal").select("*"),

  docs_tacografo: (supabase) =>
    supabase.from("docs_tacografo").select("*"),

  docs_civ_cipp: (supabase) =>
    supabase.from("docs_civ_cipp").select("*"),

  docs_laudo_eletromecanico: (supabase) =>
    supabase.from("docs_laudo_eletromecanico").select("*"),

  docs_laudo_implemento: (supabase) =>
    supabase.from("docs_laudo_implemento").select("*"),

  docs_crlve_pesados: (supabase) =>
    supabase.from("docs_crlve_pesados").select("*"),

  docs_crlve_leve: (supabase) =>
    supabase.from("docs_crlve_leve").select("*"),

  checklists_mecanicos: (supabase) =>
    supabase.from("checklists_mecanicos").select("*"),

  fichas_mao_obra: (supabase) =>
    supabase.from("fichas_mao_obra").select("*").order("created_at", { ascending: false }),

  apontamentos_mao_obra: (supabase) =>
    supabase.from("apontamentos_mao_obra").select("*").order("criado_em", { ascending: false }),

  mao_obra_catalogos: (supabase) =>
    supabase.from("mao_obra_catalogos").select("*").eq("ativo", true).order("ordem"),

  mao_obra_apontamentos_catalogo: (supabase) =>
    supabase.from("mao_obra_apontamentos_catalogo").select("*").eq("ativo", true).order("codigo"),

  fichas_lubrificacao: (supabase) =>
    supabase.from("fichas_lubrificacao").select("*, equipamento:equipamentos(placa, modulo, tipo)").is("deleted_at", null).order("data_registro", { ascending: false }),

  horimetros: (supabase) =>
    supabase.from("horimetros").select("*, equipamentos(placa, modelo)").order("data_referencia", { ascending: false }).order("created_at", { ascending: false }),

  afiacao: (supabase) =>
    supabase.from("afiacao").select("*").order("created_at", { ascending: false }),

  aux_afiacao: (supabase) =>
    supabase.from("aux_afiacao").select("*").order("value", { ascending: true }),

  historico_exclusoes: (supabase) =>
    supabase.from("historico_exclusoes").select("*").order("excluido_em", { ascending: false }).limit(1000),

  profiles: (supabase) =>
    supabase.from("profiles").select("*").order("full_name"),

  role_permissions: (supabase) =>
    supabase.from("role_permissions").select("*"),

  filiais: (supabase) =>
    supabase.from("filiais").select("id, nome, ativo").order("id"),

  custos_manutencao: (supabase) =>
    supabase.from("custos_manutencao").select("*").order("data", { ascending: false }),

  custos_fornecedores: (supabase) =>
    supabase.from("custos_fornecedores").select("*").order("nome_fantasia", { ascending: true }),

  custos_parcelas: (supabase) =>
    supabase.from("custos_parcelas").select("*").order("mes_vencimento", { ascending: true }),

  // Controle de Insumos (fichas de abastecimento/recarga dos comboios) — reserva de
  // referência pro fluxo de campo funcionar o dia inteiro sem sinal (ver lib/offline-db.ts).
  insumos_fichas_abastecimento: (supabase) =>
    supabase.from("insumos_fichas_abastecimento").select("*").order("data", { ascending: false }).limit(500),

  insumos_ficha_insumos: (supabase) =>
    supabase.from("insumos_ficha_insumos").select("*"),

  insumos_abastecimento_linhas: (supabase) =>
    supabase.from("insumos_abastecimento_linhas").select("*"),

  insumos_fichas_recarga: (supabase) =>
    supabase.from("insumos_fichas_recarga").select("*").order("data", { ascending: false }).limit(500),

  insumos_recarga_itens: (supabase) =>
    supabase.from("insumos_recarga_itens").select("*"),

  insumos_materiais: (supabase) =>
    supabase.from("insumos_materiais").select("*"),

  insumos_modulos: (supabase) =>
    supabase.from("insumos_modulos").select("*"),

  insumos_impedimentos: (supabase) =>
    supabase.from("insumos_impedimentos").select("*"),

  insumos_maquinas_suzano: (supabase) =>
    supabase.from("insumos_maquinas_suzano").select("*"),

  insumos_skid_movimentos: (supabase) =>
    supabase.from("insumos_skid_movimentos").select("*"),

  controladoria_frota: (supabase) =>
    supabase.from("controladoria_frota").select("*").order("nome", { ascending: true }),

  // `fotos`/`fotos_gerais` ficam de fora — são a maior fatia de base64 deste módulo e não
  // têm texto misturado. `avarias`/`assinaturas` ficam (guardam descrição/nome junto com a
  // foto no mesmo jsonb — excluir perderia texto, e o volume é bem menor).
  checklist_frota: (supabase) =>
    supabase.from("checklist_frota").select("id, tipo_checklist, empresa, placa, nucleo, mes, turno, marca_modelo, motorista, matricula_motorista, km, data_checklist, respostas, pendencias_adicionais, executante_nome, executante_mt, supervisor_nome, supervisor_mt, status, criado_por, criado_por_nome, filial_id, created_at, frota, horimetro, registradora_diesel, registradora_insumo, saldo_tanque, local, hora, mecanico, matricula_mecanico, responsavel_recebe, observacoes_gerais, frota_tipo, resultado, avarias, assinaturas").order("created_at", { ascending: false }).limit(500),

  // `evidencias` (fotos em base64) é a própria razão de ser da listagem (mostrada direto
  // na tabela, sem tela de detalhe) — não dá pra excluir a coluna sem perder a feature.
  // Mitigação possível sem redesenhar a tela: limite bem mais baixo (era 1000, custo de
  // banda escala direto com quantidade de linhas × fotos por linha).
  controle_filtros_implemento: (supabase) =>
    supabase.from("controle_filtros_implemento").select("*").order("data_troca", { ascending: false }).limit(150),
};

/**
 * Sincroniza apenas as tabelas selecionadas de forma paralela com limite de concorrência.
 */
export async function syncTables(tableNames: string[], maxConcurrency = 4): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (!navigator.onLine) {
    console.log("[Sync Engine] Dispositivo offline. Sincronização seletiva abortada.");
    return false;
  }

  const supabase = createClient();
  console.log(`[Sync Engine] Sincronizando tabelas: ${tableNames.join(", ")}...`);

  let success = false;

  const executeSyncForTable = async (name: string) => {
    const fetchFn = syncTasks[name];
    if (!fetchFn) {
      console.warn(`[Sync Engine] Tabela desconhecida para sincronização: ${name}`);
      return;
    }

    // Se já houver um sync ativo para esta tabela específica, aguarda ele terminar
    // e então dispara uma nova busca. Isso evita reaproveitar dados desatualizados:
    // se um registro foi salvo enquanto o sync anterior ainda buscava dados antigos,
    // reutilizar aquela promessa sobrescreveria a edição recente com o valor antigo.
    const previousSync = activeSyncs[name] || Promise.resolve();

    const currentSync = previousSync.then(async () => {
      try {
        console.log(`[Sync Engine] Buscando dados da tabela: ${name}...`);
        const { data, error } = await fetchFn(supabase);
        if (error) throw error;

        if (data) {
          const storeName = storeNames[name] || name;
          await safeSyncStore(storeName, data, "id");
          console.log(`[Sync Engine] Tabela ${name} sincronizada com sucesso! (${data.length} itens)`);
          success = true;
        }
      } catch (err: any) {
        console.error(`[Sync Engine] Falha ao sincronizar tabela ${name}:`, err?.message || err);
      }
    }).finally(() => {
      if (activeSyncs[name] === currentSync) activeSyncs[name] = null;
    });

    activeSyncs[name] = currentSync;
    return currentSync;
  };

  // Executa em lotes controlados para evitar estourar o limite de conexões paralelas HTTP do navegador
  for (let i = 0; i < tableNames.length; i += maxConcurrency) {
    const batch = tableNames.slice(i, i + maxConcurrency);
    await Promise.all(batch.map(name => executeSyncForTable(name)));
  }

  return success;
}

/**
 * Sincroniza todas as tabelas (mantém retrocompatibilidade)
 */
export async function syncAllTables(): Promise<boolean> {
  const allTables = Object.keys(syncTasks);
  return syncTables(allTables);
}
