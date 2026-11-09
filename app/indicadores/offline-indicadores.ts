// Variante com suporte a múltipla seleção de `getOfflineIndicadoresData` (lib/offline-calculations.ts).
//
// Não alteramos `getOfflineIndicadoresData` nem `lib/offline-calculations.ts` porque esse arquivo
// já foi convertido e commitado como parte do Dashboard principal (fora do escopo desta tarefa).
// Em vez disso, chamamos `getOfflineDashboardData` diretamente — ela já aceita arrays para
// categoria/area/placa desde essa conversão — e replicamos aqui a mesma transformação de dados
// que `getOfflineIndicadoresData` faz, só que recebendo arrays em vez de um valor único.
import { getOfflineDashboardData } from "@/lib/offline-calculations";

export async function getOfflineIndicadoresDataMulti(filtros?: {
  mes?: number;
  ano?: number;
  categoria?: string[];
  area?: string[];
  placa?: string[];
}): Promise<any> {
  const dash = await getOfflineDashboardData({
    mes: filtros?.mes,
    ano: filtros?.ano,
    categoria: filtros?.categoria && filtros.categoria.length > 0 ? filtros.categoria : undefined,
    area: filtros?.area && filtros.area.length > 0 ? filtros.area : undefined,
    placa: filtros?.placa && filtros.placa.length > 0 ? filtros.placa : undefined,
  });

  const veiculos = dash.veiculos.map(v => {
    const eqInfo = dash.statusFrota.find(sf => sf.placa === v.placa);
    return {
      placa: v.placa,
      categoria: filtros?.categoria?.[0] || "PESADA",
      modulo: eqInfo?.modulo || "BASE",
      area: filtros?.area?.[0] || "GERAL",
      dm: v.disponibilidade,
      dmHorasTotal: v.hTotalDM,
      dmHorasManut: v.horasManut,
      do_: v.disponibilidade_operacional,
      doHorasOp: v.horasDisponiveisOperacional,
      doHorasTotal: v.hTotalDO,
      totalOS: v.totalOS,
      osFechadas: v.osFechadas,
      osAbertas: v.totalOS - v.osFechadas
    };
  });

  return {
    veiculos,
    dmMedia: dash.dm,
    doMedia: dash.doOperacional,
    periodoLabel: dash.periodoLabel,
    diasTranscorridos: dash.veiculos[0] ? dash.veiculos[0].hTotalDM / 24 : 30,
    horasTotaisPeriodo: dash.veiculos[0] ? dash.veiculos[0].hTotalDM : 720,
    filtroOpcoes: {
      meses: dash.filtroOpcoes.meses,
      anos: dash.filtroOpcoes.anos,
      categorias: dash.filtroOpcoes.categorias,
      placas: dash.filtroOpcoes.placas,
      areas: dash.filtroOpcoes.areas
    }
  };
}
