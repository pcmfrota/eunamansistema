// Camada offline do módulo Insumos: espelha no cliente (contra o cache local do
// IndexedDB) exatamente a lógica que as actions "use server" fazem no servidor, pra
// que abrir/editar/finalizar uma ficha funcione o dia inteiro sem internet. Ver o
// plano em C:\Users\pcmeu\.claude\plans\misty-bubbling-cookie.md ("Fase A").
//
// Decisão de design (aprovada no plano): enquanto offline, o saldo/"restou" fica
// congelado no último valor conhecido — só os totais lançados na própria tela (ex:
// a linha de totais da TabelaAbastecimentos) são recalculados ao vivo a partir dos
// lançamentos locais. O saldo oficial é recalculado pelo servidor (mesma lógica de
// sempre) quando a ficha sincronizar. Isso evita duplicar `recalcularSaiu`/validação
// de divergência no cliente, que exigiria duas fontes de verdade sempre em sincronia.

import { localDb, SyncItem } from "@/lib/offline-db";
import { INSUMO_TIPOS, InsumoTipo } from "./config";
import type {
  Comboio, FichaAbastecimento, FichaInsumo, LinhaAbastecimento, FichaCompleta,
  EstoqueAtualItem, FechamentoPayload, Material,
} from "./actions";
import type { RecargaAplicada, RecargaInput, Skid, SaldoSkidItem } from "./recargaActions";

// ─── Derivação de comboios (espelha getInsumosBaseData) ────────────────────────

type EquipamentoCache = {
  id: string; placa: string; modelo: string | null; tipo: string; modulo: string | null;
  deposito_suzano: string | null; numero_tanques_diesel: number | null; capacidade_tanque_litros: number | null;
};

export function deriveComboiosOffline(
  equipamentos: EquipamentoCache[],
  fichas: FichaAbastecimento[],
  fichaInsumos: FichaInsumo[]
): Comboio[] {
  return equipamentos
    .filter((eq) => eq.tipo === "COMBOIO")
    .map((eq) => {
      const fichasDoComboio = fichas.filter((f) => f.equipamento_id === eq.id);
      const rascunho = fichasDoComboio.find((f) => f.status === "RASCUNHO");
      const ultimaFicha = fichasDoComboio
        .filter((f) => f.status === "FINALIZADA")
        .sort((a, b) => b.data.localeCompare(a.data))[0];

      let saldoDieselAtual = 0;
      if (ultimaFicha) {
        saldoDieselAtual = fichaInsumos
          .filter((fi) => fi.ficha_id === ultimaFicha.id && (fi.insumo_tipo === "DIESEL_T1" || fi.insumo_tipo === "DIESEL_T2"))
          .reduce((s, fi) => s + Number(fi.restou || 0), 0);
      }

      return {
        id: eq.id, placa: eq.placa, modelo: eq.modelo, tipo: eq.tipo, modulo: eq.modulo,
        deposito_suzano: eq.deposito_suzano, numero_tanques_diesel: eq.numero_tanques_diesel || 1,
        capacidade_tanque_litros: eq.capacidade_tanque_litros,
        saldoDieselAtual, temRascunho: !!rascunho,
        rascunhoLubrificador: rascunho?.lubrificador_nome || rascunho?.motorista_nome || null,
      };
    });
}

export function getEstoqueAtualComboioOffline(
  equipamentoId: string, fichas: FichaAbastecimento[], fichaInsumos: FichaInsumo[]
): EstoqueAtualItem[] {
  const ultimaFicha = fichas
    .filter((f) => f.equipamento_id === equipamentoId && f.status === "FINALIZADA")
    .sort((a, b) => b.data.localeCompare(a.data))[0];
  const saldoPorTipo = new Map<string, number>();
  if (ultimaFicha) {
    fichaInsumos.filter((fi) => fi.ficha_id === ultimaFicha.id).forEach((fi) => saldoPorTipo.set(fi.insumo_tipo, Number(fi.restou || 0)));
  }
  return INSUMO_TIPOS.map((tipo) => ({ insumo_tipo: tipo, saldoAtual: saldoPorTipo.get(tipo) || 0 }));
}

// ─── Montagem/abertura de ficha offline (espelha buscarFichaCompleta/abrirOuCriarFicha) ─

export async function montarFichaCompletaOffline(fichaId: string): Promise<FichaCompleta | null> {
  const [fichas, insumos, linhas] = await Promise.all([
    localDb.getAll<FichaAbastecimento>("insumos_fichas_abastecimento"),
    localDb.getAll<FichaInsumo>("insumos_ficha_insumos"),
    localDb.getAll<LinhaAbastecimento>("insumos_abastecimento_linhas"),
  ]);
  const ficha = fichas.find((f) => f.id === fichaId);
  if (!ficha) return null;
  return {
    ficha,
    insumos: insumos.filter((i) => i.ficha_id === fichaId),
    linhas: linhas
      .filter((l) => l.ficha_id === fichaId)
      .sort((a, b) => (a.hora_inicial || "").localeCompare(b.hora_inicial || "")),
  };
}

export async function abrirOuCriarFichaOffline(equipamentoId: string): Promise<{ ficha?: FichaCompleta; error?: string }> {
  const [fichas, fichaInsumosAll] = await Promise.all([
    localDb.getAll<FichaAbastecimento>("insumos_fichas_abastecimento"),
    localDb.getAll<FichaInsumo>("insumos_ficha_insumos"),
  ]);

  const rascunho = fichas.find((f) => f.equipamento_id === equipamentoId && f.status === "RASCUNHO");
  if (rascunho) {
    const ficha = await montarFichaCompletaOffline(rascunho.id);
    return ficha ? { ficha } : { error: "Rascunho local não encontrado (cache corrompido)." };
  }

  const ultimaFicha = fichas
    .filter((f) => f.equipamento_id === equipamentoId && f.status === "FINALIZADA")
    .sort((a, b) => b.data.localeCompare(a.data))[0];

  const insumosAnteriores: Record<string, { restou: number; acumulado_registradora_final: number | null }> = {};
  if (ultimaFicha) {
    fichaInsumosAll
      .filter((fi) => fi.ficha_id === ultimaFicha.id)
      .forEach((fi) => { insumosAnteriores[fi.insumo_tipo] = { restou: fi.restou, acumulado_registradora_final: fi.acumulado_registradora_final }; });
  }

  const tempId = `temp_ficha_${Date.now()}`;
  const novaFicha: FichaAbastecimento & { _isPendingSync?: boolean } = {
    id: tempId,
    numero_sequencial: 0,
    equipamento_id: equipamentoId,
    modulo_id: ultimaFicha?.modulo_id ?? null,
    turno: "1",
    data: new Date().toISOString().slice(0, 10),
    motorista_nome: null, motorista_matricula: null, lubrificador_nome: null, lubrificador_matricula: null,
    km_horimetro_inicial: ultimaFicha?.km_horimetro_final ?? null, km_horimetro_final: null,
    regua_tanque1_inicial_cm: null, regua_tanque1_inicial_lts: null, regua_tanque1_final_cm: null, regua_tanque1_final_lts: null,
    regua_tanque2_inicial_cm: null, regua_tanque2_inicial_lts: null, regua_tanque2_final_cm: null, regua_tanque2_final_lts: null,
    codigo_impedimento_id: null, observacoes: null,
    status: "RASCUNHO", status_baixa: "PENDENTE", criado_por_nome: null,
    _isPendingSync: true,
  };

  const linhasInsumos: (FichaInsumo & { _isPendingSync?: boolean })[] = INSUMO_TIPOS.map((tipo) => ({
    id: `temp_fi_${tempId}_${tipo}`,
    ficha_id: tempId,
    insumo_tipo: tipo,
    acumulado_registradora_inicial: tipo === "DIESEL_T1" || tipo === "DIESEL_T2" ? insumosAnteriores[tipo]?.acumulado_registradora_final ?? 0 : null,
    quantidade_inicial: insumosAnteriores[tipo]?.restou ?? 0,
    entrou: 0, saiu: 0,
    acumulado_registradora_final: null,
    restou: insumosAnteriores[tipo]?.restou ?? 0,
    _isPendingSync: true,
  }));

  await localDb.put("insumos_fichas_abastecimento", novaFicha);
  await localDb.saveMany("insumos_ficha_insumos", linhasInsumos);
  await localDb.addToQueue("insumos_fichas_abastecimento", "abrir_ficha", { tempId, equipamentoId });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("offline-db-updated-insumos_fichas_abastecimento"));
    window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
  }

  return { ficha: { ficha: novaFicha, insumos: linhasInsumos, linhas: [] } };
}

// ─── Recargas já aplicadas na ficha (espelha getRecargasAplicadasNaFicha) ──────

export async function getRecargasAplicadasNaFichaOffline(fichaId: string): Promise<RecargaAplicada[]> {
  const [recargas, itens, materiaisCache, equipamentosCache] = await Promise.all([
    localDb.getAll<any>("insumos_fichas_recarga"),
    localDb.getAll<any>("insumos_recarga_itens"),
    localDb.getAll<Material>("insumos_materiais"),
    localDb.getAll<any>("equipamentos"),
  ]);
  return recargas
    .filter((r) => r.aplicado_em_ficha_id === fichaId)
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .map((r) => {
      const skid = equipamentosCache.find((e) => e.id === r.origem_skid_id);
      const origemLabel =
        r.origem_tipo === "SKID" ? `Skid ${skid?.placa || "-"}`
        : r.origem_tipo === "ALMOXARIFADO" ? `Almoxarifado ${r.origem_deposito || "-"}`
        : r.origem_tipo === "FORNECEDOR" ? "Fornecedor" : (r.origem_outro_texto || "Outro");
      return {
        id: r.id, numeroSequencial: r.numero_sequencial, data: r.data, hora: r.hora, origemLabel,
        responsavelNome: r.responsavel_nome,
        itens: itens.filter((i) => i.recarga_id === r.id).map((i) => {
          const mat = materiaisCache.find((m) => m.id === i.material_id);
          return { material: mat?.material || "-", quantidade: Number(i.quantidade), unidade: mat?.unidade || "" };
        }),
      };
    });
}

// ─── Skids e recarga (espelha getSkidsDisponiveis/getSaldoSkid/criarRecargaFinalizada) ─

export function getSkidsDisponiveisOffline(equipamentos: { id: string; placa: string; modelo: string | null; tipo: string }[]): Skid[] {
  return equipamentos
    .filter((e) => e.tipo === "SKID")
    .map((e) => ({ id: e.id, placa: e.placa, modelo: e.modelo }))
    .sort((a, b) => a.placa.localeCompare(b.placa));
}

export function getSaldoSkidOffline(equipamentoId: string, materiais: Material[], movimentos: any[]): SaldoSkidItem[] {
  return materiais.map((m) => {
    const saldo = movimentos
      .filter((mv) => mv.equipamento_id === equipamentoId && mv.material_id === m.id)
      .reduce((s, mv) => s + (mv.tipo === "ENTRADA" ? Number(mv.quantidade) : -Number(mv.quantidade)), 0);
    return { material_id: m.id, material_nome: m.material, ni: m.ni, unidade: m.unidade, saldo };
  });
}

// A assinatura chega como data URL inline (SignaturePad não sobe pra Storage — ver
// components/SignaturePad.tsx), então o RecargaInput inteiro pode ir direto pra fila:
// nenhuma mídia pra resolver depois, ao contrário da foto da máquina ad-hoc.
export async function registrarRecargaOffline(input: RecargaInput): Promise<void> {
  await localDb.addToQueue("insumos_fichas_recarga", "create", input);
  // Skid tem controle de estoque próprio — recarga não debita o skid (ver
  // criarRecargaFinalizada em recargaActions.ts, mesma regra).
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
}

// ─── Fila com fusão (evita empilhar N edições idênticas antes de sincronizar) ──
//
// Cabeçalho, ajuste de insumo e fechamento são editados várias vezes (um save por
// etapa do wizard) antes do dia terminar e sincronizar. Em vez de enfileirar um item
// por edição, funde o patch no item ainda pendente da mesma ficha/ação — nasce no
// servidor já com o valor final, sem gerar updates redundantes nem risco de um deles
// chegar fora de ordem.

async function enqueueOrMerge(
  entity: SyncItem["entity"], action: SyncItem["action"],
  matchPayload: (payload: any) => boolean,
  buildPayload: (existing: any | null) => any
): Promise<void> {
  const queue = await localDb.getQueue();
  const existing = queue.find((item) => item.entity === entity && item.action === action && matchPayload(item.payload));
  const payload = buildPayload(existing ? existing.payload : null);
  if (existing && existing.id !== undefined) {
    await localDb.put("sync_queue", { ...existing, payload });
  } else {
    await localDb.addToQueue(entity, action, payload);
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
}

export async function enqueueAtualizarCabecalho(fichaId: string, patch: Partial<FichaAbastecimento>): Promise<void> {
  await enqueueOrMerge(
    "insumos_fichas_abastecimento", "atualizar_cabecalho",
    (p) => p.fichaId === fichaId,
    (existing) => ({ fichaId, patch: { ...(existing?.patch || {}), ...patch } })
  );
}

export async function enqueueAtualizarInsumo(
  fichaId: string, insumoTipo: InsumoTipo,
  patch: Partial<Pick<FichaInsumo, "acumulado_registradora_inicial" | "quantidade_inicial" | "entrou" | "acumulado_registradora_final">>
): Promise<void> {
  await enqueueOrMerge(
    "insumos_fichas_abastecimento", "atualizar_insumo",
    (p) => p.fichaId === fichaId && p.insumoTipo === insumoTipo,
    (existing) => ({ fichaId, insumoTipo, patch: { ...(existing?.patch || {}), ...patch } })
  );
}

export async function enqueueSalvarLinha(fichaId: string, linha: Partial<LinhaAbastecimento> & { id: string }): Promise<void> {
  await enqueueOrMerge(
    "insumos_abastecimento_linhas", "salvar_linha",
    (p) => p.linha?.id === linha.id,
    () => ({ fichaId, linha })
  );
}

export async function enqueueExcluirLinha(fichaId: string, linhaId: string): Promise<void> {
  // Linha criada offline (id temporário) nunca chegou a existir no servidor: basta
  // tirar o "salvar_linha" ainda pendente da fila, não há o que excluir de verdade.
  if (linhaId.startsWith("temp_")) {
    const queue = await localDb.getQueue();
    const pending = queue.find((item) => item.entity === "insumos_abastecimento_linhas" && item.action === "salvar_linha" && item.payload?.linha?.id === linhaId);
    if (pending?.id !== undefined) await localDb.removeFromQueue(pending.id);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    return;
  }
  await localDb.addToQueue("insumos_abastecimento_linhas", "excluir_linha", { fichaId, linhaId });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
}

export async function enqueueFinalizar(fichaId: string, fechamento: FechamentoPayload): Promise<void> {
  await enqueueOrMerge(
    "insumos_fichas_abastecimento", "finalizar",
    (p) => p.fichaId === fichaId,
    () => ({ fichaId, fechamento })
  );
}

// ─── Espelho local (write-through) ─────────────────────────────────────────
//
// Toda mutação bem-sucedida — online ou offline — também grava no cache local,
// pra sobreviver a um fechamento/crash do app e pra funcionar se a conexão cair
// logo em seguida (ver Fase B do plano: autosave contínuo monta em cima disto).

export async function persistirFichaLocal(ficha: FichaAbastecimento): Promise<void> {
  await localDb.put("insumos_fichas_abastecimento", ficha);
}

export async function persistirFichaInsumoLocal(insumo: FichaInsumo): Promise<void> {
  await localDb.put("insumos_ficha_insumos", insumo);
}

export async function persistirLinhaLocal(linha: LinhaAbastecimento): Promise<void> {
  await localDb.put("insumos_abastecimento_linhas", linha);
}

export async function removerLinhaLocal(linhaId: string): Promise<void> {
  await localDb.delete("insumos_abastecimento_linhas", linhaId);
}
