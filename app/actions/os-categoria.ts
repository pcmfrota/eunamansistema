"use server";

import { createClient } from "@/utils/supabase/server";

function parseLocal(dateStr: string | null): number {
  if (!dateStr) return 0;
  // Tenta formato PT-BR legado: DD/MM/YYYY HH:mm — o parser nativo do Date não entende isso.
  const matchBR = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
  if (matchBR) {
    return new Date(
      parseInt(matchBR[3]),
      parseInt(matchBR[2]) - 1,
      parseInt(matchBR[1]),
      parseInt(matchBR[4]),
      parseInt(matchBR[5])
    ).getTime();
  }
  // ISO (com ou sem timezone, ex: "...+00:00" vindo do Postgres timestamptz) — o parser
  // nativo já respeita o offset gravado. A reconstrução manual que existia aqui antes
  // descartava esse offset e tratava os números como se já fossem hora local, criando
  // um erro sistemático de 3h (o fuso de Brasília) em cada OS.
  return new Date(dateStr).getTime();
}

export async function getOSporCategoriaV3(
  categoria: string,   // 'PIPA' | 'COMBOIO' | 'MUNCK' | 'MULTI'
  mes?: number,
  ano?: number,
  dataInicio?: string,
  dataFim?: string
) {
  const supabase = createClient();
  const debugData: any = {
    timestamp: new Date().toISOString(),
    inputs: { categoria, mes, ano, dataInicio, dataFim }
  };

  try {
    const catUpper = categoria.toUpperCase().trim();

    // 1. Buscar todos os equipamentos
    const { data: equips, error: eqError } = await supabase
      .from("equipamentos")
      .select("id, placa, tipo, modelo, modulo, categoria, created_at, deleted_at");
    
    debugData.allEquipsCount = equips?.length || 0;
    debugData.eqError = eqError;

    if (eqError) throw eqError;

    const eqTimestamps = (equips ?? [])
      .map(eq => eq.created_at ? new Date(eq.created_at).getTime() : null)
      .filter((t): t is number => t !== null);
    const minCreatedAt = eqTimestamps.length > 0 ? Math.min(...eqTimestamps) : Date.now();
    const baselineThreshold = minCreatedAt + 7 * 24 * 60 * 60 * 1000;

    // Filtra localmente os equipamentos da categoria
    const filteredEquips = (equips ?? []).filter(e => {
      const tipoRaw = (e.tipo || '').toUpperCase().trim();
      const TIPO_PARA_LABEL: Record<string, string> = {
        'PIPA': 'PIPA',
        'COMBOIO': 'COMBOIO',
        'MUNCK': 'MUNCK',
        'MULTIFUNCIONAL': 'MULTI',
        'MULTI': 'MULTI',
      };
      if (TIPO_PARA_LABEL[tipoRaw] !== catUpper) return false;

      // Filtro temporal de criação (com tratamento de baseline para meses passados)
      const createdAt = e.created_at ? new Date(e.created_at).getTime() : 0;
      const isPeriodBeforeSystemInit = fimTime < minCreatedAt;

      if (isPeriodBeforeSystemInit) {
        if (createdAt > baselineThreshold) return false;
      } else {
        if (createdAt > fimTime) return false;
      }

      // Filtro temporal de deleção
      if (e.deleted_at) {
        const deletedAt = new Date(e.deleted_at).getTime();
        if (deletedAt < inicioTime) return false;
      }

      return true;
    });

    debugData.filteredEquipsCount = filteredEquips.length;

    const platesSet = new Set(filteredEquips.map(e => e.placa?.toUpperCase().trim()).filter(Boolean));
    const equipIdsSet = new Set(filteredEquips.map(e => e.id));

    // 2. Calcular período
    let inicio = dataInicio || "";
    let fim = dataFim || "";

    if (!inicio || !fim) {
      const mesFiltro = mes || new Date().getMonth() + 1;
      const anoFiltro = ano || new Date().getFullYear();

      const { data: cal } = await supabase
        .from("calendario_suzano")
        .select("data_inicio, data_fim")
        .eq("mes", mesFiltro)
        .eq("ano", anoFiltro)
        .single();

      inicio = cal?.data_inicio || `${anoFiltro}-${String(mesFiltro).padStart(2, "0")}-01`;
      fim = cal?.data_fim || `${anoFiltro}-${String(mesFiltro).padStart(2, "0")}-30`;
    }

    const inicioFiltro = inicio.includes("T") ? inicio : `${inicio}T00:00:00`;
    const fimFiltro = fim.includes("T") ? fim : `${fim}T23:59:59`;
    debugData.inicioFiltro = inicioFiltro;
    debugData.fimFiltro = fimFiltro;

    const inicioTime = parseLocal(inicioFiltro);
    const fimTime = parseLocal(fimFiltro);

    // 3. Buscar escalas e OSs em paralelo
    const [escalasRes, osRes] = await Promise.all([
      supabase
        .from("escala_frota")
        .select("placa, carga_horaria, periodo_inicio, periodo_fim"),
      supabase
        .from("ordens_servico")
        .select(`
          id, numero_os, status, descricao, classe,
          data_abertura, data_fechamento, horario_parada,
          horas_manutencao, foi_enviado_reserva, horas_reserva_chegou,
          placa, equipamento_id
        `)
        .or(`data_abertura.lte.${fimFiltro},horario_parada.lte.${fimFiltro}`)
    ]);

    const escalas = escalasRes.data ?? [];
    const osList = osRes.data ?? [];
    debugData.allOsInDatabaseCount = osList.length;
    debugData.osError = osRes.error;
    debugData.escalasError = escalasRes.error;

    if (osRes.error) throw osRes.error;

    // Filtra localmente por data e pertença à categoria usando parseLocal para segurança total
    const osFiltradasData = osList.filter(os => {
      // OS "Programado" é só planejamento futuro — não conta como indisponibilidade real.
      if (os.status === 'Programado') return false;

      const osPlaca = os.placa?.toUpperCase().trim();
      const osEquipId = os.equipamento_id;

      const isFromCategory = (osPlaca && platesSet.has(osPlaca)) || (osEquipId && equipIdsSet.has(osEquipId));
      if (!isFromCategory) return false;

      const abTime = parseLocal(os.horario_parada || os.data_abertura);
      const fcTime = os.data_fechamento ? parseLocal(os.data_fechamento) : null;

      const part1 = abTime <= fimTime;
      const part2 = !fcTime || fcTime >= inicioTime;
      return part1 && part2;
    });

    debugData.osFiltradasDataCount = osFiltradasData.length;

    // Mapeamento de escalas
    const timeToMs = (tStr: string) => {
      if (!tStr) return 0;
      const [h, m] = tStr.split(':').map(Number);
      return (h * 3600 + m * 60) * 1000;
    };

    const escalaMap = new Map<string, { carga_horaria: number, startOffset: number, endOffset: number, isOvernight: boolean }>();
    escalas.forEach(e => {
      const s = timeToMs(e.periodo_inicio);
      const end = timeToMs(e.periodo_fim);
      const pKey = e.placa?.toUpperCase().trim();
      if (pKey) {
        escalaMap.set(pKey, {
          carga_horaria: Number(e.carga_horaria),
          startOffset: s,
          endOffset: end,
          isOvernight: end <= s
        });
      }
    });

    // Mapear dias do período
    const pInicioTime = new Date(inicioFiltro).getTime();
    const pFimTime = new Date(fimFiltro).getTime();
    const diffMsRange = Math.max(0, pFimTime - pInicioTime);
    const diasReferencia = Math.floor(diffMsRange / 86400000) + 1;

    const diasMesInfo = Array.from({ length: diasReferencia }).map((_, d) => {
      const dC = new Date(pInicioTime);
      dC.setDate(dC.getDate() + d);
      const dStr = dC.toISOString().split('T')[0];
      const d0 = new Date(`${dStr}T00:00:00`).getTime();
      const d24 = d0 + 86400000;
      return { d0, d24 };
    });

    // Calcular horas_impacto_do em memória para cada OS filtrada
    const osProcessed = osFiltradasData.map(os => {
      const start = parseLocal(os.horario_parada || os.data_abertura);
      const endDMRaw = os.data_fechamento ? parseLocal(os.data_fechamento) : new Date().getTime();
      const endDM = Math.min(endDMRaw, pFimTime);

      let endDO = endDM;
      if (os.foi_enviado_reserva && os.horas_reserva_chegou) {
        const reservaTime = parseLocal(os.horas_reserva_chegou);
        if (reservaTime > start && reservaTime < endDM) {
          endDO = reservaTime;
        }
      }

      let horas_impacto_do = 0;
      const placaKey = os.placa?.toUpperCase().trim();
      const escala = escalaMap.get(placaKey);

      diasMesInfo.forEach(dia => {
        const { d0, d24 } = dia;
        let shiftStart = d0 + (escala?.startOffset || 0);
        let shiftEnd = d0 + (escala?.endOffset || 0);
        if (escala?.isOvernight) shiftEnd += 86400000;
        if (!escala) shiftEnd = d24;

        const intDOini = start > shiftStart ? start : shiftStart;
        const intDOfim = endDO < shiftEnd ? endDO : shiftEnd;
        if (intDOini < intDOfim) {
          horas_impacto_do += (intDOfim - intDOini) / 3600000;
        }
      });

      return {
        ...os,
        horas_impacto_do: Math.round(horas_impacto_do * 10) / 10
      };
    });

    // Enriquecer com dados do equipamento
    const equipMap = new Map(filteredEquips.map((e) => [e.placa?.toUpperCase().trim(), e]));

    const result = osProcessed.map((os) => {
      const eq = equipMap.get(os.placa?.toUpperCase().trim());
      return {
        ...os,
        modelo: eq?.modelo || "—",
        modulo: eq?.modulo || "—",
      };
    });

    debugData.finalResultCount = result.length;

    // Salvar debug info localmente para auditoria
    try {
      const fs = require('fs');
      const path = require('path');
      fs.writeFileSync(
        path.join('c:\\Users\\jessi\\OneDrive\\Área de Trabalho\\EUNAMAN SISTEMA\\eunamansistema', 'tmp', 'debug_action.json'),
        JSON.stringify(debugData, null, 2),
        'utf-8'
      );
    } catch (e) {}

    return result;

  } catch (error: any) {
    debugData.globalError = error.message;
    try {
      const fs = require('fs');
      const path = require('path');
      fs.writeFileSync(
        path.join('c:\\Users\\jessi\\OneDrive\\Área de Trabalho\\EUNAMAN SISTEMA\\eunamansistema', 'tmp', 'debug_action.json'),
        JSON.stringify(debugData, null, 2),
        'utf-8'
      );
    } catch (e) {}
    return [];
  }
}
