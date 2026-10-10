"use server";

import { createClient } from "@/utils/supabase/server";

// ─── Exportação "Baixa de Diesel e Lubrificantes" (padrão Suzano) ──────────
// Uma linha por equipamento x insumo lançado — mesmo formato da planilha que a Suzano
// já usa pra conferência. A recarga Skid -> Comboio é transferência interna e NUNCA
// entra aqui (só o consumo de verdade, registrado nas linhas de abastecimento).

export type LinhaBaixaDiesel = {
  data: string; maquina: string; horimetro: number | null;
  cod: number | null; ni: string; referencia: string;
  quantidade: number; unidade: string; aplicacao: string;
  movimento: string; controle: string | null; modulo: string | null; centro: string | null;
  dep: string | null; comboio: string | null; statusBaixa: string;
};

type CampoLinha = "diesel_litros" | "motor" | "corrente" | "graxa" | "transmissao" | "fluido_radiador" | "hidraulico" | "diferencial" | "arla";

const APLICACAO_MATERIAL: Record<CampoLinha, string> = {
  diesel_litros: "DIESEL", motor: "HIDRAULICO_MOTOR", corrente: "CORRENTE", graxa: "GRAXA",
  transmissao: "TRANSMISSAO", fluido_radiador: "FLUIDO", hidraulico: "HIDRAULICO_MOTOR",
  diferencial: "DIFERENCIAL", arla: "ADITIVO",
};

// Rótulo mostrado na coluna APLICAÇÃO da planilha — Motor e Hidráulico usam o mesmo
// material/NI (mesmo óleo), mas são pontos de consumo diferentes na máquina, então saem
// como linhas distintas (igual à ficha de papel, que também separa as duas colunas).
const APLICACAO_LABEL: Record<CampoLinha, string> = {
  diesel_litros: "DIESEL", motor: "MOTOR", corrente: "CORRENTE", graxa: "GRAXA",
  transmissao: "TRANSMISSAO", fluido_radiador: "FLUIDO", hidraulico: "HIDRAULICO",
  diferencial: "DIFERENCIAL", arla: "ARLA",
};

export async function getLinhasBaixaDiesel(dataInicio: string, dataFim: string): Promise<LinhaBaixaDiesel[]> {
  const supabase = createClient();

  const { data: fichas } = await supabase
    .from("insumos_fichas_abastecimento")
    .select("id, data, status_baixa, equipamentos(deposito_suzano), insumos_modulos(nome, centro, deposito, controle)")
    .eq("status", "FINALIZADA").gte("data", dataInicio).lte("data", dataFim);
  if (!fichas || !fichas.length) return [];

  const { data: materiais } = await supabase.from("insumos_materiais").select("codigo, ni, referencia, unidade, aplicacao").eq("ativo", true).order("codigo");
  const materialPorAplicacao = new Map<string, any>();
  (materiais || []).forEach((m: any) => { if (!materialPorAplicacao.has(m.aplicacao)) materialPorAplicacao.set(m.aplicacao, m); });

  const idsFichas = fichas.map((f: any) => f.id);
  const { data: linhas } = await supabase.from("insumos_abastecimento_linhas").select("*").in("ficha_id", idsFichas);
  const fichaPorId = new Map(fichas.map((f: any) => [f.id, f]));

  const campos: CampoLinha[] = ["diesel_litros", "motor", "corrente", "graxa", "transmissao", "fluido_radiador", "hidraulico", "diferencial", "arla"];
  const linhasExport: LinhaBaixaDiesel[] = [];

  (linhas || []).forEach((l: any) => {
    const ficha = fichaPorId.get(l.ficha_id);
    if (!ficha) return;

    campos.forEach((campo) => {
      const quantidade = Number(l[campo] || 0);
      if (quantidade <= 0) return;
      const material = materialPorAplicacao.get(APLICACAO_MATERIAL[campo]);

      linhasExport.push({
        data: ficha.data, maquina: l.equipamento_texto || "-", horimetro: l.horimetro,
        cod: material?.codigo ?? null, ni: material?.ni || "-", referencia: material?.referencia || "-",
        quantidade, unidade: material?.unidade || "L", aplicacao: APLICACAO_LABEL[campo],
        movimento: "201", controle: ficha.insumos_modulos?.controle || null,
        modulo: ficha.insumos_modulos?.nome || null, centro: ficha.insumos_modulos?.centro || null,
        dep: ficha.insumos_modulos?.deposito || null, comboio: ficha.equipamentos?.deposito_suzano || null,
        statusBaixa: ficha.status_baixa,
      });
    });
  });

  return linhasExport;
}

// ─── Exportação "Recargas/Transferências" ──────────────────────────────────

export type LinhaRecargaExport = {
  numeroFicha: number; data: string; turno: string | null; origem: string; comboioDestino: string;
  modulo: string | null; item: string; ni: string; quantidade: number; unidade: string;
  reqNf: string | null; localRecarga: string | null; responsavelEstoque: string | null; matricula: string | null;
};

export async function getLinhasRecargaExport(dataInicio: string, dataFim: string): Promise<LinhaRecargaExport[]> {
  const supabase = createClient();

  const { data: recargas } = await supabase
    .from("insumos_fichas_recarga")
    .select(`
      id, numero_sequencial, data, turno, origem_tipo, origem_deposito, origem_outro_texto, local_recarga,
      responsavel_nome, responsavel_matricula,
      equipamentos!insumos_fichas_recarga_equipamento_id_fkey(placa),
      origem_skid:equipamentos!insumos_fichas_recarga_origem_skid_id_fkey(placa),
      insumos_modulos(nome)
    `)
    .eq("status", "FINALIZADA").gte("data", dataInicio).lte("data", dataFim);
  if (!recargas || !recargas.length) return [];

  const ids = recargas.map((r: any) => r.id);
  const { data: itens } = await supabase.from("insumos_recarga_itens").select("recarga_id, quantidade, req_nf, insumos_materiais(material, ni, unidade)").in("recarga_id", ids);
  const recargaPorId = new Map(recargas.map((r: any) => [r.id, r]));

  return (itens || []).map((i: any) => {
    const r = recargaPorId.get(i.recarga_id);
    const origem = r.origem_tipo === "SKID" ? `Skid ${r.origem_skid?.placa || "-"}`
      : r.origem_tipo === "ALMOXARIFADO" ? `Almoxarifado ${r.origem_deposito || "-"}`
      : r.origem_tipo === "FORNECEDOR" ? "Fornecedor" : (r.origem_outro_texto || "Outro");
    return {
      numeroFicha: r.numero_sequencial, data: r.data, turno: r.turno, origem, comboioDestino: r.equipamentos?.placa || "-",
      modulo: r.insumos_modulos?.nome || null, item: i.insumos_materiais?.material || "-", ni: i.insumos_materiais?.ni || "-",
      quantidade: Number(i.quantidade), unidade: i.insumos_materiais?.unidade || "", reqNf: i.req_nf,
      localRecarga: r.local_recarga, responsavelEstoque: r.responsavel_nome, matricula: r.responsavel_matricula,
    };
  });
}
