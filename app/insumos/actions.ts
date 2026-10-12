"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { registrarAtualizacaoHorimetro, inferUnidadeHorimetro } from "@/lib/horimetro-log";
import { InsumoTipo, INSUMO_TIPOS, INSUMO_LABEL } from "./config";
import { aplicarRecargasPendentes } from "./recargaActions";

// ─── Tipos ──────────────────────────────────────────────────────────────────

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
  // Calculado: saldo de diesel (T1+T2) da última ficha finalizada, e se há rascunho em aberto.
  saldoDieselAtual: number;
  temRascunho: boolean;
  rascunhoLubrificador?: string | null;
};

export type Modulo = { id: string; codigo: string; nome: string; centro: string | null; deposito: string | null; controle: string | null };
export type Material = { id: string; codigo: number | null; ni: string; referencia: string; material: string; unidade: string; aplicacao: string };
export type Impedimento = { id: string; codigo: string | null; descricao: string };
export type MaquinaSuzano = { id: string; codigo: string; modulo_id: string | null; frente: "HV" | "FW" | null; tipo: string | null; origem: "CADASTRO" | "MOTORISTA"; foto_url: string | null };
export type Colaborador = { id: string; nome: string; matricula: string | null };

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

// ─── Util ───────────────────────────────────────────────────────────────────

async function getUsuarioAtual(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null, nome: null, isAdmin: false };

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
  return {
    id: user.id,
    nome: profile?.full_name || user.email || "Usuário",
    isAdmin: profile?.role === "admin",
  };
}

// ─── Dados base (comboios + catálogos) ─────────────────────────────────────

export async function getInsumosBaseData(): Promise<{
  comboios: Comboio[];
  modulos: Modulo[];
  materiais: Material[];
  impedimentos: Impedimento[];
  colaboradores: Colaborador[];
  error?: string;
}> {
  const supabase = createClient();

  const [{ data: equipamentos, error: eqError }, { data: modulos }, { data: materiais }, { data: impedimentos }, { data: colaboradores }] = await Promise.all([
    supabase.from("equipamentos").select("id, placa, modelo, tipo, modulo, deposito_suzano, numero_tanques_diesel, capacidade_tanque_litros")
      .eq("tipo", "COMBOIO").is("deleted_at", null).order("placa"),
    supabase.from("insumos_modulos").select("id, codigo, nome, centro, deposito, controle").eq("ativo", true).order("nome"),
    supabase.from("insumos_materiais").select("id, codigo, ni, referencia, material, unidade, aplicacao").eq("ativo", true).order("codigo"),
    supabase.from("insumos_impedimentos").select("id, codigo, descricao").eq("ativo", true).order("descricao"),
    supabase.from("colaboradores").select("id, nome, matricula").eq("status", "Ativo").order("nome"),
  ]);

  if (eqError) return { comboios: [], modulos: [], materiais: [], impedimentos: [], colaboradores: [], error: eqError.message };

  const equipList = equipamentos || [];
  const comboios: Comboio[] = await Promise.all(
    equipList.map(async (eq: any) => {
      const { data: rascunho } = await supabase
        .from("insumos_fichas_abastecimento")
        .select("id, lubrificador_nome, motorista_nome")
        .eq("equipamento_id", eq.id).eq("status", "RASCUNHO").maybeSingle();

      const { data: ultimaFicha } = await supabase
        .from("insumos_fichas_abastecimento")
        .select("id")
        .eq("equipamento_id", eq.id).eq("status", "FINALIZADA")
        .order("data", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();

      let saldoDieselAtual = 0;
      if (ultimaFicha) {
        const { data: insumosUltima } = await supabase
          .from("insumos_ficha_insumos").select("insumo_tipo, restou")
          .eq("ficha_id", ultimaFicha.id).in("insumo_tipo", ["DIESEL_T1", "DIESEL_T2"]);
        saldoDieselAtual = (insumosUltima || []).reduce((s: number, r: any) => s + Number(r.restou || 0), 0);
      }

      return {
        id: eq.id, placa: eq.placa, modelo: eq.modelo, tipo: eq.tipo, modulo: eq.modulo,
        deposito_suzano: eq.deposito_suzano, numero_tanques_diesel: eq.numero_tanques_diesel || 1,
        capacidade_tanque_litros: eq.capacidade_tanque_litros,
        saldoDieselAtual, temRascunho: !!rascunho,
        rascunhoLubrificador: rascunho?.lubrificador_nome || rascunho?.motorista_nome || null,
      };
    })
  );

  return { comboios, modulos: modulos || [], materiais: materiais || [], impedimentos: impedimentos || [], colaboradores: colaboradores || [] };
}

// Autocomplete da grade de abastecimento: máquinas + frota (qualquer tipo), pra sugestão.
export async function getEquipamentosParaAbastecimento(): Promise<{ id: string; placa: string; tipo: string }[]> {
  const supabase = createClient();
  const { data } = await supabase.from("equipamentos").select("id, placa, tipo").is("deleted_at", null).order("placa");
  return data || [];
}

// Cadastro em campo: motorista/lubrificador que o usuário não encontrou na lista de
// colaboradores pode ser adicionado na hora, e fica salvo pra próxima ficha já aparecer.
export async function criarColaborador(nome: string, tipo: string): Promise<{ colaborador?: Colaborador; error?: string }> {
  const nomeTrim = nome.trim();
  if (!nomeTrim) return { error: "Informe o nome do colaborador." };
  const supabase = createClient();

  const { data: existente } = await supabase.from("colaboradores").select("id, nome, matricula").ilike("nome", nomeTrim).maybeSingle();
  if (existente) return { colaborador: existente };

  const { data, error } = await supabase.from("colaboradores").insert({ nome: nomeTrim, status: "Ativo", tipo }).select("id, nome, matricula").single();
  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await supabase.from("colaboradores").select("id, nome, matricula").ilike("nome", nomeTrim).maybeSingle();
      if (retry) return { colaborador: retry };
    }
    return { error: error.message };
  }
  revalidatePath("/insumos");
  return { colaborador: data };
}

// ─── Cadastro de Máquinas Suzano ────────────────────────────────────────────

export async function getMaquinasPorModulo(moduloId: string | null): Promise<MaquinaSuzano[]> {
  if (!moduloId) return [];
  const supabase = createClient();

  // Gruas (GRU-xxxx) não pertencem a um módulo de Carregamento específico — aparecem nos
  // 4 (Carregamento I/II/III/Terceiro), por isso ficam com modulo_id nulo no cadastro.
  const { data: modulo } = await supabase.from("insumos_modulos").select("codigo").eq("id", moduloId).maybeSingle();
  const ehCarregamento = modulo?.codigo?.startsWith("CARREG_");

  const { data } = await supabase
    .from("insumos_maquinas_suzano").select("*")
    .eq("ativo", true)
    .or(ehCarregamento ? `modulo_id.eq.${moduloId},tipo.eq.GRU` : `modulo_id.eq.${moduloId}`)
    .order("codigo");
  return data || [];
}

// Cadastro em campo: o motorista procura a máquina, não encontra na lista do módulo, e
// cadastra na hora — só que precisa de uma foto da placa/equipamento pra confirmar depois
// que o lançamento foi certo (combinado explicitamente com o usuário).
export async function criarMaquinaAdHoc(
  codigo: string, moduloId: string | null, fotoUrl: string
): Promise<{ maquina?: MaquinaSuzano; error?: string }> {
  if (!codigo.trim()) return { error: "Informe o código/placa da máquina." };
  if (!fotoUrl) return { error: "A foto da placa/equipamento é obrigatória pra cadastrar uma máquina nova." };

  const supabase = createClient();
  const usuario = await getUsuarioAtual(supabase);

  const { data, error } = await supabase
    .from("insumos_maquinas_suzano")
    .insert({
      codigo: codigo.trim().toUpperCase(), modulo_id: moduloId, origem: "MOTORISTA",
      foto_url: fotoUrl, criado_por: usuario.id, criado_por_nome: usuario.nome,
    })
    .select("*").single();

  if (error) return { error: error.code === "23505" ? "Já existe uma máquina cadastrada com esse código." : error.message };
  revalidatePath("/insumos");
  return { maquina: data };
}

// ─── Abrir/criar ficha ──────────────────────────────────────────────────────

async function buscarFichaCompleta(supabase: any, fichaId: string): Promise<FichaCompleta | null> {
  const { data: ficha } = await supabase.from("insumos_fichas_abastecimento").select("*").eq("id", fichaId).maybeSingle();
  if (!ficha) return null;
  const { data: insumos } = await supabase.from("insumos_ficha_insumos").select("*").eq("ficha_id", fichaId);
  const { data: linhas } = await supabase.from("insumos_abastecimento_linhas").select("*").eq("ficha_id", fichaId).order("hora_inicial");
  return { ficha, insumos: insumos || [], linhas: linhas || [] };
}

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

  // Aplica recargas que chegaram pro comboio sem ter ficha aberta na hora (ficaram
  // "pendentes" esperando a próxima ficha — ver app/insumos/recargaActions.ts).
  await aplicarRecargasPendentes(supabase, equipamentoId, novaFicha.id);

  const ficha = await buscarFichaCompleta(supabase, novaFicha.id);
  revalidatePath("/insumos");
  return { ficha: ficha || undefined };
}

export async function getFicha(fichaId: string): Promise<{ ficha?: FichaCompleta; error?: string }> {
  const supabase = createClient();
  const ficha = await buscarFichaCompleta(supabase, fichaId);
  if (!ficha) return { error: "Ficha não encontrada." };
  return { ficha };
}

// ─── Atualizações do cabeçalho (autosave por etapa) ────────────────────────

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
  revalidatePath("/insumos");
  return { success: true };
}

// Ajusta um insumo da ficha — usado na Etapa 4 (saldo inicial, só admin), Etapa 6 (entrou,
// qualquer usuário) e Etapa 7 (registradora final do diesel). "saiu" nunca é editável aqui:
// é sempre recalculado a partir das linhas de equipamento.
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

  if (ajusteDeSaldo) {
    await supabase.from("insumos_ficha_historico").insert({
      tipo_ficha: "ABASTECIMENTO", ficha_id: fichaId, acao: "AJUSTE_SALDO_INICIAL",
      dados_antes: { insumo_tipo: insumoTipo, quantidade_inicial: atual.quantidade_inicial, acumulado_registradora_inicial: atual.acumulado_registradora_inicial },
      dados_depois: { insumo_tipo: insumoTipo, ...patch },
      usuario_id: usuario.id, usuario_nome: usuario.nome,
    });
  }

  revalidatePath("/insumos");
  return { success: true };
}

// ─── Lista, detalhe, histórico e reabertura ─────────────────────────────────

export type FiltroFichas = {
  dataInicio?: string; dataFim?: string; moduloId?: string; equipamentoId?: string; turno?: string; status?: StatusFicha;
};

export type FichaAbastecimentoResumo = {
  id: string; numero_sequencial: number; data: string; turno: string; status: StatusFicha; status_baixa: "PENDENTE" | "BAIXADO";
  placa: string; modulo_nome: string | null; motorista_nome: string | null; dieselSaido: number;
};

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

export type HistoricoEntry = { id: string; acao: string; dados_antes: any; dados_depois: any; usuario_nome: string | null; created_at: string };

export async function getHistoricoFicha(tipoFicha: "ABASTECIMENTO" | "RECARGA", fichaId: string): Promise<HistoricoEntry[]> {
  const supabase = createClient();
  const { data } = await supabase.from("insumos_ficha_historico").select("*")
    .eq("tipo_ficha", tipoFicha).eq("ficha_id", fichaId).order("created_at", { ascending: false });
  return data || [];
}

// Reabertura: só admin, e sempre registrada no histórico. Não recalcula a cadeia de saldo
// de fichas posteriores desse comboio — se já existir uma ficha mais nova finalizada, o
// administrador precisa revisar manualmente o saldo herdado dela depois de reabrir esta.
export async function reabrirFicha(fichaId: string): Promise<{ success?: true; aviso?: string; error?: string }> {
  const supabase = createClient();
  const usuario = await getUsuarioAtual(supabase);
  if (!usuario.isAdmin) return { error: "Só o administrador pode reabrir uma ficha finalizada." };

  const { data: ficha } = await supabase.from("insumos_fichas_abastecimento").select("equipamento_id, data, status").eq("id", fichaId).maybeSingle();
  if (!ficha) return { error: "Ficha não encontrada." };
  if (ficha.status === "RASCUNHO") return { error: "Essa ficha já está em rascunho." };

  const { data: rascunhoExistente } = await supabase.from("insumos_fichas_abastecimento").select("id")
    .eq("equipamento_id", ficha.equipamento_id).eq("status", "RASCUNHO").maybeSingle();
  if (rascunhoExistente) return { error: "Esse comboio já tem outra ficha em rascunho. Finalize-a antes de reabrir esta." };

  const { data: maisRecente } = await supabase.from("insumos_fichas_abastecimento").select("id")
    .eq("equipamento_id", ficha.equipamento_id).neq("id", fichaId).gt("data", ficha.data)
    .order("data", { ascending: false }).limit(1).maybeSingle();

  const { error } = await supabase.from("insumos_fichas_abastecimento").update({ status: "RASCUNHO" }).eq("id", fichaId);
  if (error) return { error: error.message };

  await supabase.from("insumos_ficha_historico").insert({
    tipo_ficha: "ABASTECIMENTO", ficha_id: fichaId, acao: "REABERTURA",
    dados_antes: { status: ficha.status }, dados_depois: { status: "RASCUNHO" },
    usuario_id: usuario.id, usuario_nome: usuario.nome,
  });

  revalidatePath("/insumos");
  return {
    success: true,
    aviso: maisRecente ? "Existe uma ficha mais recente desse comboio já finalizada — revise o saldo inicial dela manualmente depois de salvar esta." : undefined,
  };
}

// ─── Linhas de abastecimento por equipamento ───────────────────────────────

const CAMPO_POR_INSUMO: Record<InsumoTipo, keyof LinhaAbastecimento | null> = {
  DIESEL_T1: null, DIESEL_T2: null, // diesel é tratado à parte (depende do tanque da linha)
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
      // Hidráulico/Motor soma Motor + Hidráulico (a ficha trata como um único insumo/tanque,
      // mas a grade de baixo tem as 2 colunas separadas, igual ao formulário em papel).
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

export async function salvarLinhaAbastecimento(
  fichaId: string,
  linha: Partial<LinhaAbastecimento>
): Promise<{ success?: true; warning?: string; error?: string }> {
  const supabase = createClient();

  if (linha.hora_inicial && linha.hora_final && linha.hora_final <= linha.hora_inicial) {
    return { error: "A hora final precisa ser maior que a hora inicial." };
  }

  let warning: string | undefined;
  if (linha.equipamento_id && linha.horimetro != null) {
    const { data: prev } = await supabase
      .from("preventivas").select("horimetro_atual, equipamentos(placa, tipo, categoria)")
      .eq("equipamento_id", linha.equipamento_id).maybeSingle();
    const { data: ultimoLog } = await supabase
      .from("historico_horimetros").select("valor_novo")
      .eq("equipamento_id", linha.equipamento_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const ultimoConhecido = Math.max(Number(prev?.horimetro_atual || 0), Number(ultimoLog?.valor_novo || 0));
    if (ultimoConhecido > 0 && Number(linha.horimetro) < ultimoConhecido) {
      warning = `Horímetro informado (${linha.horimetro}) é menor que o último registrado (${ultimoConhecido}) para este equipamento.`;
    }

    const eq: any = prev?.equipamentos;
    await registrarAtualizacaoHorimetro({
      supabase, equipamentoId: linha.equipamento_id, placa: eq?.placa || linha.equipamento_texto,
      tipo: eq?.tipo, categoria: eq?.categoria, unidade: inferUnidadeHorimetro(eq?.categoria, eq?.tipo),
      valorAnterior: prev?.horimetro_atual, valorNovo: Number(linha.horimetro), origem: "NOVO_APONTAMENTO",
      observacoes: "Lançado via Ficha de Abastecimento (Controle de Insumos)",
    });
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
  revalidatePath("/insumos");
  return { success: true, warning };
}

export async function excluirLinhaAbastecimento(linhaId: string, fichaId: string): Promise<{ success?: true; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("insumos_abastecimento_linhas").delete().eq("id", linhaId);
  if (error) return { error: error.message };
  await recalcularSaiu(supabase, fichaId);
  revalidatePath("/insumos");
  return { success: true };
}

// ─── Fechamento ─────────────────────────────────────────────────────────────

export type FechamentoPayload = {
  km_horimetro_final: number | null;
  regua_tanque1_final_cm: number | null;
  regua_tanque1_final_lts: number | null;
  regua_tanque2_final_cm: number | null;
  regua_tanque2_final_lts: number | null;
  codigo_impedimento_id: string | null;
  observacoes: string | null;
};

export async function finalizarFicha(
  fichaId: string,
  fechamento: FechamentoPayload
): Promise<{ success?: true; alertas?: string[]; error?: string }> {
  const supabase = createClient();

  const { error: updError } = await supabase.from("insumos_fichas_abastecimento")
    .update({ ...fechamento, updated_at: new Date().toISOString() }).eq("id", fichaId);
  if (updError) return { error: updError.message };

  const { data: insumos } = await supabase.from("insumos_ficha_insumos").select("*").eq("ficha_id", fichaId);
  const alertas: string[] = [];

  for (const insumo of insumos || []) {
    if (Number(insumo.restou) < 0) {
      return { error: `"${INSUMO_LABEL[insumo.insumo_tipo as InsumoTipo]}" ficaria com saldo negativo (${insumo.restou}). Confira os lançamentos antes de finalizar.` };
    }
    if ((insumo.insumo_tipo === "DIESEL_T1" || insumo.insumo_tipo === "DIESEL_T2") && insumo.acumulado_registradora_final != null && insumo.acumulado_registradora_inicial != null) {
      const porRegistradora = Number(insumo.acumulado_registradora_final) - Number(insumo.acumulado_registradora_inicial);
      const diff = Math.abs(porRegistradora - Number(insumo.saiu));
      const tolerancia = Math.max(porRegistradora, Number(insumo.saiu)) * 0.01;
      if (diff > tolerancia && diff > 0.01) {
        alertas.push(`${INSUMO_LABEL[insumo.insumo_tipo as InsumoTipo]}: saída pela registradora (${porRegistradora.toFixed(1)} L) diverge da soma dos lançamentos (${Number(insumo.saiu).toFixed(1)} L).`);
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

  revalidatePath("/insumos");
  return { success: true, alertas: alertas.length ? alertas : undefined };
}

// ─── Estoque & Auditoria (comboio) ──────────────────────────────────────────

export type AuditoriaInsumoComboio = { insumo_tipo: InsumoTipo; entrada: number; saida: number; saldoAtual: number };

export async function getAuditoriaComboio(equipamentoId: string, dataInicio: string, dataFim: string): Promise<AuditoriaInsumoComboio[]> {
  const supabase = createClient();

  const { data: fichasPeriodo } = await supabase
    .from("insumos_fichas_abastecimento").select("id")
    .eq("equipamento_id", equipamentoId).eq("status", "FINALIZADA")
    .gte("data", dataInicio).lte("data", dataFim);
  const idsPeriodo = (fichasPeriodo || []).map((f: any) => f.id);

  const movimentoPorTipo = new Map<string, { entrada: number; saida: number }>();
  if (idsPeriodo.length) {
    const { data: insumosPeriodo } = await supabase.from("insumos_ficha_insumos").select("insumo_tipo, entrou, saiu").in("ficha_id", idsPeriodo);
    (insumosPeriodo || []).forEach((i: any) => {
      const atual = movimentoPorTipo.get(i.insumo_tipo) || { entrada: 0, saida: 0 };
      atual.entrada += Number(i.entrou || 0);
      atual.saida += Number(i.saiu || 0);
      movimentoPorTipo.set(i.insumo_tipo, atual);
    });
  }

  const { data: ultimaFicha } = await supabase
    .from("insumos_fichas_abastecimento").select("id")
    .eq("equipamento_id", equipamentoId).eq("status", "FINALIZADA")
    .order("data", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const saldoPorTipo = new Map<string, number>();
  if (ultimaFicha) {
    const { data: insumosAtuais } = await supabase.from("insumos_ficha_insumos").select("insumo_tipo, restou").eq("ficha_id", ultimaFicha.id);
    (insumosAtuais || []).forEach((i: any) => saldoPorTipo.set(i.insumo_tipo, Number(i.restou || 0)));
  }

  return INSUMO_TIPOS.map((tipo) => ({
    insumo_tipo: tipo,
    entrada: movimentoPorTipo.get(tipo)?.entrada || 0,
    saida: movimentoPorTipo.get(tipo)?.saida || 0,
    saldoAtual: saldoPorTipo.get(tipo) || 0,
  }));
}

// Controla o que já foi lançado manualmente no SAP da Suzano, a partir da planilha
// "Baixa de Diesel e Lubrificantes" exportada (ver app/insumos/exportActions.ts).
export async function atualizarStatusBaixa(fichaId: string, status: "PENDENTE" | "BAIXADO"): Promise<{ success?: true; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("insumos_fichas_abastecimento").update({ status_baixa: status }).eq("id", fichaId);
  if (error) return { error: error.message };
  revalidatePath("/insumos");
  return { success: true };
}
