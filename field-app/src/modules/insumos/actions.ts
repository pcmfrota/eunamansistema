// Port de app/insumos/actions.ts + app/insumos/recargaActions.ts pro app de campo —
// sem "use server"/revalidatePath, supabase client em vez de server.
//
// FORA DO ESCOPO desta fase (não portado, propositalmente — mesmo critério já usado
// em Lavagens/Preventivas/Lubrificação: fora o que é mais escritório/PCM/admin):
// - Cadastros (CRUD de Materiais/Módulos/Impedimentos) e Painel (gráficos agregados).
// - getMaquinasPorModulo/criarMaquinaAdHoc (cadastro de "máquina Suzano" ad-hoc).
// - getHistoricoFicha, reabrirFicha (reabertura é ação de admin), atualizarStatusBaixa,
//   getAuditoriaComboio/getAuditoriaSkid (auditoria fica só no site ao vivo por ora).
// - getFichasRecarga/getRecarga/registrarMedicaoSkid/registrarEntradaSkid.
// - getRecargasAplicadasNaFicha (lista de recargas já aplicadas, exibida no desktop
//   dentro da ficha — cortado por simplicidade nesta primeira versão).
// - registrarAtualizacaoHorimetro (log cruzado com o módulo Horímetro/Preventivas ao
//   salvar uma linha com horímetro) — cortado por simplicidade; o horímetro ainda é
//   lançado normalmente pelos módulos Preventivas/Horímetro.
import { createClient } from "@/utils/supabase/client";
import { InsumoTipo, INSUMO_TIPOS } from "./config";

// ─── Tipos (idênticos ao desktop) ───────────────────────────────────────────

export type StatusFicha = "RASCUNHO" | "FINALIZADA" | "VALIDADA";

export type Comboio = {
  id: string;
  placa: string;
  modelo: string | null;
  tipo: string;
  modulo: string | null;
  deposito_suzano: string | null;
  numero_tanques_diesel: number;
  capacidade_tanque_litros: number | null;
  saldoDieselAtual: number;
  temRascunho: boolean;
  rascunhoLubrificador?: string | null;
};

export type Modulo = { id: string; codigo: string; nome: string; centro: string | null; deposito: string | null; controle: string | null };
export type Material = { id: string; codigo: number | null; ni: string; referencia: string; material: string; unidade: string; aplicacao: string };
export type Impedimento = { id: string; codigo: string | null; descricao: string };
export type Colaborador = { id: string; nome: string; matricula: string | null; tipo: string | null };

export type FichaInsumo = {
  id: string;
  ficha_id: string;
  insumo_tipo: InsumoTipo;
  acumulado_registradora_inicial: number | null;
  quantidade_inicial: number;
  entrou: number;
  saiu: number;
  acumulado_registradora_final: number | null;
  restou: number;
};

export type LinhaAbastecimento = {
  id: string;
  ficha_id: string;
  hora_inicial: string | null;
  hora_final: string | null;
  equipamento_id: string | null;
  equipamento_texto: string | null;
  horimetro: number | null;
  diesel_registradora: number | null;
  diesel_litros: number | null;
  tanque_diesel: 1 | 2;
  preventiva: boolean | null;
  motor: number | null;
  corrente: number | null;
  graxa: number | null;
  transmissao: number | null;
  fluido_radiador: number | null;
  hidraulico: number | null;
  diferencial: number | null;
  arla: number | null;
  matricula_operador: string | null;
  assinatura_operador_url: string | null;
};

export type FichaAbastecimento = {
  id: string;
  numero_sequencial: number;
  equipamento_id: string;
  modulo_id: string | null;
  turno: "1" | "2" | "3";
  data: string;
  motorista_nome: string | null;
  motorista_matricula: string | null;
  lubrificador_nome: string | null;
  lubrificador_matricula: string | null;
  km_horimetro_inicial: number | null;
  km_horimetro_final: number | null;
  regua_tanque1_inicial_cm: number | null;
  regua_tanque1_inicial_lts: number | null;
  regua_tanque1_final_cm: number | null;
  regua_tanque1_final_lts: number | null;
  regua_tanque2_inicial_cm: number | null;
  regua_tanque2_inicial_lts: number | null;
  regua_tanque2_final_cm: number | null;
  regua_tanque2_final_lts: number | null;
  codigo_impedimento_id: string | null;
  observacoes: string | null;
  status: StatusFicha;
  status_baixa: "PENDENTE" | "BAIXADO";
  criado_por_nome: string | null;
};

export type FichaCompleta = {
  ficha: FichaAbastecimento;
  insumos: FichaInsumo[];
  linhas: LinhaAbastecimento[];
};

export type FiltroFichas = {
  dataInicio?: string; dataFim?: string; moduloId?: string; equipamentoId?: string; turno?: string; status?: StatusFicha;
};

export type FichaAbastecimentoResumo = {
  id: string; numero_sequencial: number; data: string; turno: string; status: StatusFicha; status_baixa: "PENDENTE" | "BAIXADO";
  placa: string; modulo_nome: string | null; motorista_nome: string | null; dieselSaido: number;
};

export type FechamentoPayload = {
  km_horimetro_final: number | null;
  regua_tanque1_final_cm: number | null;
  regua_tanque1_final_lts: number | null;
  regua_tanque2_final_cm: number | null;
  regua_tanque2_final_lts: number | null;
  codigo_impedimento_id: string | null;
  observacoes: string | null;
};

export type EstoqueAtualItem = { insumo_tipo: InsumoTipo; saldoAtual: number };

export type OrigemRecarga = "SKID" | "ALMOXARIFADO" | "FORNECEDOR" | "OUTRO";
export type ItemRecargaInput = { material_id: string; quantidade: number; req_nf: string | null; tanque_diesel?: 1 | 2 | null };
export type RecargaInput = {
  equipamento_id: string;
  modulo_id: string | null;
  turno: "1" | "2" | "3" | null;
  data: string;
  hora: string | null;
  motorista_nome: string | null;
  motorista_matricula: string | null;
  observacao: string | null;
  origem_tipo: OrigemRecarga;
  origem_skid_id: string | null;
  origem_deposito: string | null;
  origem_outro_texto: string | null;
  local_recarga: string | null;
  responsavel_nome: string | null;
  responsavel_matricula: string | null;
  responsavel_assinatura_url: string | null;
  itens: ItemRecargaInput[];
};
export type Skid = { id: string; placa: string; modelo: string | null };
export type SaldoSkidItem = { material_id: string; material_nome: string; ni: string; unidade: string; saldo: number };

// ─── Util ───────────────────────────────────────────────────────────────────

async function getUsuarioAtual(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null as string | null, nome: null as string | null, isAdmin: false };
  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
  return { id: user.id, nome: profile?.full_name || user.email || "Usuário", isAdmin: profile?.role === "admin" };
}

function aplicacaoParaInsumoTipo(aplicacao: string, tanqueDiesel?: 1 | 2 | null): InsumoTipo {
  if (aplicacao === "DIESEL") return tanqueDiesel === 2 ? "DIESEL_T2" : "DIESEL_T1";
  if (aplicacao === "ADITIVO") return "ARLA";
  return aplicacao as InsumoTipo;
}

async function buscarFichaCompleta(supabase: any, fichaId: string): Promise<FichaCompleta | null> {
  const { data: ficha } = await supabase.from("insumos_fichas_abastecimento").select("*").eq("id", fichaId).maybeSingle();
  if (!ficha) return null;
  const { data: insumos } = await supabase.from("insumos_ficha_insumos").select("*").eq("ficha_id", fichaId);
  const { data: linhas } = await supabase.from("insumos_abastecimento_linhas").select("*").eq("ficha_id", fichaId).order("hora_inicial");
  return { ficha, insumos: insumos || [], linhas: linhas || [] };
}

// ─── Abertura/edição de ficha ───────────────────────────────────────────────

export async function abrirOuCriarFicha(equipamentoId: string): Promise<{ ficha?: FichaCompleta; error?: string }> {
  const supabase = createClient();

  const { data: rascunho } = await supabase
    .from("insumos_fichas_abastecimento").select("id")
    .eq("equipamento_id", equipamentoId).eq("status", "RASCUNHO").maybeSingle();

  if (rascunho) {
    const ficha = await buscarFichaCompleta(supabase, rascunho.id);
    return { ficha: ficha || undefined };
  }

  const usuario = await getUsuarioAtual(supabase);

  const { data: ultimaFicha } = await supabase
    .from("insumos_fichas_abastecimento").select("id, km_horimetro_final, modulo_id")
    .eq("equipamento_id", equipamentoId).eq("status", "FINALIZADA")
    .order("data", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();

  let insumosAnteriores: Record<string, { restou: number; acumulado_registradora_final: number | null }> = {};
  if (ultimaFicha) {
    const { data: rows } = await supabase.from("insumos_ficha_insumos").select("insumo_tipo, restou, acumulado_registradora_final").eq("ficha_id", ultimaFicha.id);
    (rows || []).forEach((r: any) => { insumosAnteriores[r.insumo_tipo] = r; });
  }

  const { data: novaFicha, error } = await supabase
    .from("insumos_fichas_abastecimento")
    .insert({
      equipamento_id: equipamentoId,
      modulo_id: ultimaFicha?.modulo_id || null,
      turno: "1",
      data: new Date().toISOString().slice(0, 10),
      km_horimetro_inicial: ultimaFicha?.km_horimetro_final ?? null,
      status: "RASCUNHO",
      criado_por: usuario.id,
      criado_por_nome: usuario.nome,
    })
    .select("id").single();

  if (error || !novaFicha) return { error: error?.message || "Falha ao criar ficha." };

  const linhasInsumos = INSUMO_TIPOS.map((tipo) => ({
    ficha_id: novaFicha.id,
    insumo_tipo: tipo,
    acumulado_registradora_inicial: tipo === "DIESEL_T1" || tipo === "DIESEL_T2" ? insumosAnteriores[tipo]?.acumulado_registradora_final ?? 0 : null,
    quantidade_inicial: insumosAnteriores[tipo]?.restou ?? 0,
    entrou: 0, saiu: 0, restou: insumosAnteriores[tipo]?.restou ?? 0,
  }));
  await supabase.from("insumos_ficha_insumos").insert(linhasInsumos);

  await aplicarRecargasPendentes(supabase, equipamentoId, novaFicha.id);

  const ficha = await buscarFichaCompleta(supabase, novaFicha.id);
  return { ficha: ficha || undefined };
}

export async function getFicha(fichaId: string): Promise<{ ficha?: FichaCompleta; error?: string }> {
  const supabase = createClient();
  const ficha = await buscarFichaCompleta(supabase, fichaId);
  if (!ficha) return { error: "Ficha não encontrada." };
  return { ficha };
}

export async function atualizarCabecalhoFicha(fichaId: string, patch: Partial<FichaAbastecimento>): Promise<{ success?: true; error?: string }> {
  const supabase = createClient();
  const camposPermitidos: (keyof FichaAbastecimento)[] = [
    "turno", "data", "motorista_nome", "motorista_matricula", "lubrificador_nome", "lubrificador_matricula",
    "modulo_id", "km_horimetro_inicial", "regua_tanque1_inicial_cm", "regua_tanque1_inicial_lts",
    "regua_tanque2_inicial_cm", "regua_tanque2_inicial_lts", "observacoes",
  ];
  const payload: any = {};
  camposPermitidos.forEach((c) => { if (c in patch) payload[c] = (patch as any)[c]; });
  payload.updated_at = new Date().toISOString();

  const { error } = await supabase.from("insumos_fichas_abastecimento").update(payload).eq("id", fichaId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function atualizarFichaInsumo(
  fichaId: string,
  insumoTipo: InsumoTipo,
  patch: Partial<Pick<FichaInsumo, "acumulado_registradora_inicial" | "quantidade_inicial" | "entrou" | "acumulado_registradora_final">>
): Promise<{ success?: true; error?: string }> {
  const supabase = createClient();
  const ajusteDeSaldo = "quantidade_inicial" in patch || "acumulado_registradora_inicial" in patch;

  const usuario = await getUsuarioAtual(supabase);
  if (ajusteDeSaldo && !usuario.isAdmin) return { error: "Só o administrador pode ajustar o saldo inicial." };

  const { data: atual } = await supabase.from("insumos_ficha_insumos").select("*").eq("ficha_id", fichaId).eq("insumo_tipo", insumoTipo).maybeSingle();
  if (!atual) return { error: "Insumo não encontrado na ficha." };

  const novo = { ...atual, ...patch };
  const restou = Number(novo.quantidade_inicial || 0) + Number(novo.entrou || 0) - Number(novo.saiu || 0);

  const { error } = await supabase.from("insumos_ficha_insumos")
    .update({ ...patch, restou, updated_at: new Date().toISOString() })
    .eq("id", atual.id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function getFichasAbastecimento(filtro: FiltroFichas = {}): Promise<FichaAbastecimentoResumo[]> {
  const supabase = createClient();
  let query = supabase
    .from("insumos_fichas_abastecimento")
    .select("id, numero_sequencial, data, turno, status, status_baixa, motorista_nome, equipamentos(placa), insumos_modulos(nome)")
    .order("data", { ascending: false }).order("numero_sequencial", { ascending: false }).limit(200);

  if (filtro.dataInicio) query = query.gte("data", filtro.dataInicio);
  if (filtro.dataFim) query = query.lte("data", filtro.dataFim);
  if (filtro.moduloId) query = query.eq("modulo_id", filtro.moduloId);
  if (filtro.equipamentoId) query = query.eq("equipamento_id", filtro.equipamentoId);
  if (filtro.turno) query = query.eq("turno", filtro.turno);
  if (filtro.status) query = query.eq("status", filtro.status);

  const { data, error } = await query;
  if (error || !data) return [];

  const ids = data.map((f: any) => f.id);
  const { data: insumosDiesel } = ids.length
    ? await supabase.from("insumos_ficha_insumos").select("ficha_id, saiu").in("ficha_id", ids).in("insumo_tipo", ["DIESEL_T1", "DIESEL_T2"])
    : { data: [] as any[] };
  const dieselPorFicha = new Map<string, number>();
  (insumosDiesel || []).forEach((i: any) => dieselPorFicha.set(i.ficha_id, (dieselPorFicha.get(i.ficha_id) || 0) + Number(i.saiu || 0)));

  return data.map((f: any) => ({
    id: f.id, numero_sequencial: f.numero_sequencial, data: f.data, turno: f.turno, status: f.status, status_baixa: f.status_baixa,
    placa: f.equipamentos?.placa || "-", modulo_nome: f.insumos_modulos?.nome || null,
    motorista_nome: f.motorista_nome, dieselSaido: dieselPorFicha.get(f.id) || 0,
  }));
}

// ─── Linhas de abastecimento ────────────────────────────────────────────────

const CAMPO_POR_INSUMO: Record<InsumoTipo, keyof LinhaAbastecimento | null> = {
  DIESEL_T1: null, DIESEL_T2: null,
  CORRENTE: "corrente", GRAXA: "graxa", TRANSMISSAO: "transmissao", FLUIDO: "fluido_radiador",
  HIDRAULICO_MOTOR: "motor", DIFERENCIAL: "diferencial", ARLA: "arla",
};

async function recalcularSaiu(supabase: any, fichaId: string) {
  const { data: linhas } = await supabase.from("insumos_abastecimento_linhas").select("*").eq("ficha_id", fichaId);
  const todas = linhas || [];

  for (const tipo of INSUMO_TIPOS) {
    let saiu = 0;
    if (tipo === "DIESEL_T1" || tipo === "DIESEL_T2") {
      const tanqueAlvo = tipo === "DIESEL_T1" ? 1 : 2;
      saiu = todas.filter((l: any) => (l.tanque_diesel || 1) === tanqueAlvo).reduce((s: number, l: any) => s + Number(l.diesel_litros || 0), 0);
    } else if (tipo === "HIDRAULICO_MOTOR") {
      saiu = todas.reduce((s: number, l: any) => s + Number(l.motor || 0) + Number(l.hidraulico || 0), 0);
    } else {
      const campo = CAMPO_POR_INSUMO[tipo]!;
      saiu = todas.reduce((s: number, l: any) => s + Number(l[campo] || 0), 0);
    }

    const { data: insumo } = await supabase.from("insumos_ficha_insumos").select("id, quantidade_inicial, entrou").eq("ficha_id", fichaId).eq("insumo_tipo", tipo).maybeSingle();
    if (insumo) {
      const restou = Number(insumo.quantidade_inicial || 0) + Number(insumo.entrou || 0) - saiu;
      await supabase.from("insumos_ficha_insumos").update({ saiu, restou, updated_at: new Date().toISOString() }).eq("id", insumo.id);
    }
  }
}

export async function salvarLinhaAbastecimento(fichaId: string, linha: Partial<LinhaAbastecimento>): Promise<{ success?: true; warning?: string; error?: string }> {
  const supabase = createClient();

  if (linha.hora_inicial && linha.hora_final && linha.hora_final <= linha.hora_inicial) {
    return { error: "A hora final precisa ser maior que a hora inicial." };
  }

  const payload = { ...linha, ficha_id: fichaId };
  let error;
  if (linha.id) {
    ({ error } = await supabase.from("insumos_abastecimento_linhas").update(payload).eq("id", linha.id));
  } else {
    ({ error } = await supabase.from("insumos_abastecimento_linhas").insert(payload));
  }
  if (error) return { error: error.message };

  await recalcularSaiu(supabase, fichaId);
  return { success: true };
}

export async function excluirLinhaAbastecimento(linhaId: string, fichaId: string): Promise<{ success?: true; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("insumos_abastecimento_linhas").delete().eq("id", linhaId);
  if (error) return { error: error.message };
  await recalcularSaiu(supabase, fichaId);
  return { success: true };
}

// ─── Fechamento ─────────────────────────────────────────────────────────────

export async function finalizarFicha(fichaId: string, fechamento: FechamentoPayload): Promise<{ success?: true; alertas?: string[]; error?: string }> {
  const supabase = createClient();

  const { error: updError } = await supabase.from("insumos_fichas_abastecimento")
    .update({ ...fechamento, updated_at: new Date().toISOString() }).eq("id", fichaId);
  if (updError) return { error: updError.message };

  const { data: insumos } = await supabase.from("insumos_ficha_insumos").select("*").eq("ficha_id", fichaId);
  const alertas: string[] = [];

  for (const insumo of insumos || []) {
    if ((insumo.insumo_tipo === "DIESEL_T1" || insumo.insumo_tipo === "DIESEL_T2") && insumo.acumulado_registradora_final != null && insumo.acumulado_registradora_inicial != null) {
      const porRegistradora = Number(insumo.acumulado_registradora_final) - Number(insumo.acumulado_registradora_inicial);
      const diff = Math.abs(porRegistradora - Number(insumo.saiu));
      const tolerancia = Math.max(porRegistradora, Number(insumo.saiu)) * 0.01;
      if (diff > tolerancia && diff > 0.01) {
        alertas.push(`${insumo.insumo_tipo}: saída pela registradora (${porRegistradora.toFixed(1)} L) diverge da soma dos lançamentos (${Number(insumo.saiu).toFixed(1)} L).`);
      }
    }
  }

  const { error } = await supabase.from("insumos_fichas_abastecimento").update({ status: "FINALIZADA" }).eq("id", fichaId);
  if (error) return { error: error.message };

  const usuario = await getUsuarioAtual(supabase);
  await supabase.from("insumos_ficha_historico").insert({
    tipo_ficha: "ABASTECIMENTO", ficha_id: fichaId, acao: "FINALIZACAO",
    dados_depois: { ...fechamento, alertas }, usuario_id: usuario.id, usuario_nome: usuario.nome,
  });

  return { success: true, alertas: alertas.length ? alertas : undefined };
}

export async function getEstoqueAtualComboio(equipamentoId: string): Promise<EstoqueAtualItem[]> {
  const supabase = createClient();

  const { data: ultimaFicha } = await supabase
    .from("insumos_fichas_abastecimento").select("id")
    .eq("equipamento_id", equipamentoId).eq("status", "FINALIZADA")
    .order("data", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const saldoPorTipo = new Map<string, number>();
  if (ultimaFicha) {
    const { data: insumosAtuais } = await supabase.from("insumos_ficha_insumos").select("insumo_tipo, restou").eq("ficha_id", ultimaFicha.id);
    (insumosAtuais || []).forEach((i: any) => saldoPorTipo.set(i.insumo_tipo, Number(i.restou || 0)));
  }

  return INSUMO_TIPOS.map((tipo) => ({ insumo_tipo: tipo, saldoAtual: saldoPorTipo.get(tipo) || 0 }));
}

export async function criarColaborador(nome: string, tipo: string): Promise<{ colaborador?: Colaborador; error?: string }> {
  const nomeTrim = nome.trim();
  if (!nomeTrim) return { error: "Informe o nome do colaborador." };
  const supabase = createClient();

  const { data: existente } = await supabase.from("colaboradores").select("id, nome, matricula, tipo").ilike("nome", nomeTrim).maybeSingle();
  if (existente) return { colaborador: existente };

  const { data, error } = await supabase.from("colaboradores").insert({ nome: nomeTrim, status: "Ativo", tipo }).select("id, nome, matricula, tipo").single();
  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await supabase.from("colaboradores").select("id, nome, matricula, tipo").ilike("nome", nomeTrim).maybeSingle();
      if (retry) return { colaborador: retry };
    }
    return { error: error.message };
  }
  return { colaborador: data };
}

// ─── Recarga (Skid/Almoxarifado/Fornecedor/Outro → Comboio) ────────────────

async function aplicarItemNaFicha(supabase: any, fichaId: string, tipo: InsumoTipo, quantidade: number) {
  const { data: insumo } = await supabase.from("insumos_ficha_insumos").select("id, entrou, quantidade_inicial, saiu").eq("ficha_id", fichaId).eq("insumo_tipo", tipo).maybeSingle();
  if (!insumo) return;
  const novoEntrou = Number(insumo.entrou || 0) + quantidade;
  const restou = Number(insumo.quantidade_inicial || 0) + novoEntrou - Number(insumo.saiu || 0);
  await supabase.from("insumos_ficha_insumos").update({ entrou: novoEntrou, restou, updated_at: new Date().toISOString() }).eq("id", insumo.id);
}

async function aplicarRecargasPendentes(supabase: any, equipamentoId: string, fichaId: string) {
  const { data: pendentes } = await supabase
    .from("insumos_fichas_recarga").select("id")
    .eq("equipamento_id", equipamentoId).eq("status", "FINALIZADA").is("aplicado_em_ficha_id", null);

  for (const recarga of pendentes || []) {
    const { data: itens } = await supabase
      .from("insumos_recarga_itens").select("material_id, quantidade, tanque_diesel, insumos_materiais(aplicacao)")
      .eq("recarga_id", recarga.id);

    for (const item of itens || []) {
      const aplicacao = (item as any).insumos_materiais?.aplicacao;
      if (!aplicacao) continue;
      await aplicarItemNaFicha(supabase, fichaId, aplicacaoParaInsumoTipo(aplicacao, item.tanque_diesel), Number(item.quantidade));
    }
    await supabase.from("insumos_fichas_recarga").update({ aplicado_em_ficha_id: fichaId }).eq("id", recarga.id);
  }
}

export async function getSkidsDisponiveis(): Promise<Skid[]> {
  const supabase = createClient();
  const { data } = await supabase.from("equipamentos").select("id, placa, modelo").eq("tipo", "SKID").is("deleted_at", null).order("placa");
  return data || [];
}

export async function getSaldoSkid(equipamentoId: string): Promise<SaldoSkidItem[]> {
  const supabase = createClient();
  const { data: materiais } = await supabase.from("insumos_materiais").select("id, material, ni, unidade").eq("ativo", true).order("codigo");
  const { data: movimentos } = await supabase.from("insumos_skid_movimentos").select("material_id, tipo, quantidade").eq("equipamento_id", equipamentoId);

  return (materiais || []).map((m: any) => {
    const saldo = (movimentos || []).filter((mv: any) => mv.material_id === m.id)
      .reduce((s: number, mv: any) => s + (mv.tipo === "ENTRADA" ? Number(mv.quantidade) : -Number(mv.quantidade)), 0);
    return { material_id: m.id, material_nome: m.material, ni: m.ni, unidade: m.unidade, saldo };
  });
}

export async function criarRecargaFinalizada(input: RecargaInput): Promise<{ success?: true; recargaId?: string; error?: string }> {
  if (!input.itens.length) return { error: "Adicione pelo menos um item à recarga." };

  const supabase = createClient();

  if (input.origem_tipo === "ALMOXARIFADO" || input.origem_tipo === "FORNECEDOR") {
    if (input.itens.some((i) => !i.req_nf?.trim())) {
      return { error: "REQ/NF é obrigatório pra todos os itens quando a origem é Almoxarifado ou Fornecedor." };
    }
  }

  const { data: materiaisInfo } = await supabase.from("insumos_materiais").select("id, material, aplicacao").in("id", input.itens.map((i) => i.material_id));
  const mapaMateriais = new Map((materiaisInfo || []).map((m: any) => [m.id, m]));

  const usuario = await getUsuarioAtual(supabase);

  const { data: recarga, error } = await supabase.from("insumos_fichas_recarga").insert({
    equipamento_id: input.equipamento_id, modulo_id: input.modulo_id, turno: input.turno,
    data: input.data, hora: input.hora, motorista_nome: input.motorista_nome, motorista_matricula: input.motorista_matricula,
    observacao: input.observacao, origem_tipo: input.origem_tipo, origem_skid_id: input.origem_skid_id,
    origem_deposito: input.origem_deposito, origem_outro_texto: input.origem_outro_texto, local_recarga: input.local_recarga,
    responsavel_nome: input.responsavel_nome, responsavel_matricula: input.responsavel_matricula,
    responsavel_assinatura_url: input.responsavel_assinatura_url,
    status: "FINALIZADA", criado_por: usuario.id, criado_por_nome: usuario.nome,
  }).select("id").single();
  if (error || !recarga) return { error: error?.message || "Erro ao criar a recarga." };

  await supabase.from("insumos_recarga_itens").insert(
    input.itens.map((i) => ({ recarga_id: recarga.id, material_id: i.material_id, quantidade: i.quantidade, req_nf: i.req_nf, tanque_diesel: i.tanque_diesel || null }))
  );

  const { data: fichaAberta } = await supabase
    .from("insumos_fichas_abastecimento").select("id")
    .eq("equipamento_id", input.equipamento_id).eq("status", "RASCUNHO").maybeSingle();

  if (fichaAberta) {
    for (const item of input.itens) {
      const material = mapaMateriais.get(item.material_id);
      if (!material) continue;
      await aplicarItemNaFicha(supabase, fichaAberta.id, aplicacaoParaInsumoTipo((material as any).aplicacao, item.tanque_diesel), Number(item.quantidade));
    }
    await supabase.from("insumos_fichas_recarga").update({ aplicado_em_ficha_id: fichaAberta.id }).eq("id", recarga.id);
  }

  return { success: true, recargaId: recarga.id };
}
