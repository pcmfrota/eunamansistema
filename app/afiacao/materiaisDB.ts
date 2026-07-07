export const MATERIAIS_DB = [
  { cod: "1",  material: "COROA 14 DENTES OREGON/ORC14404",                 ni: "25045281", custo: 115.52,  tipo: "Coroa" },
  { cod: "12", material: "CORRENTE OREGON/18HX V132",                        ni: "25301352", custo: 1612.35, tipo: "Corrente" },
  { cod: "13", material: "CORRENTE OREGON/18HX V370",                        ni: "25301352", custo: 1612.35, tipo: "Corrente" },
  { cod: "14", material: "CORRENTE 370E (MAQNOVA)",                          ni: "25301352", custo: 1612.35, tipo: "Corrente" },
  { cod: "2",  material: "EMENDA UNIAO OREGON/512935 MACHO",                 ni: "25301353", custo: 1.75,    tipo: "Emenda" },
  { cod: "3",  material: "EMENDA UNIAO OREGON/518853 FEMEA",                 ni: "25301351", custo: 1.21,    tipo: "Emenda" },
  { cod: "15", material: "ESTRELA P/BARRA HARVESTER OREGON/101918 (ROLTOP)", ni: "25045282", custo: 70.79,   tipo: "Estrela" },
  { cod: "16", material: "SABRE JET FIT OREGON/752HSFB194 (370E)",           ni: "25301354", custo: 298.69,  tipo: "Sabre" },
  { cod: "17", material: "SABRE KOMATSU/5256506 (370E)",                     ni: "27036813", custo: 371.06,  tipo: "Sabre" },
  { cod: "18", material: "SABRE KOMATSU/5208092 (V132)",                     ni: "27057056", custo: 361.31,  tipo: "Sabre" },
  { cod: "20", material: "CHAPA MAQNOVA/P0239",                              ni: "27104167", custo: 100.00,  tipo: "Chapa" },
  { cod: "21", material: "SABRE MAQNOVA/P0199",                              ni: "27076237", custo: 10.50,   tipo: "Sabre" },
  { cod: "11", material: "BOLSA SABRE FLORENSTEC BS1345",                    ni: "25132431", custo: 12.00,   tipo: "Bolsa" },
  { cod: "10", material: "BOLSA",                                            ni: "27095494", custo: 12.00,   tipo: "Bolsa" },
  { cod: "22", material: "REBITE MAQNOVA",                                   ni: "27190176", custo: 11.00,   tipo: "Emenda" },
  { cod: "40", material: "CHAPA ROTARY-AX (PONTEIRA)",                       ni: "27274881", custo: 101.00,  tipo: "Chapa" },
  { cod: "23", material: "SABRE ROTARY-AX",                                  ni: "27276133", custo: 100.00,  tipo: "Sabre" },
];


export const ESTADO_RECEBIMENTO: Record<string, string> = {
  A: "QUEIMADA (O)",
  B: "TORCIDA (O)",
  C: "CONTAMINADA (O) COM AREIA",
  D: "SEM LUBRIFICAÇÃO",
  E: "NORMAL",
  F: "FALTANDO PEDAÇO",
  G: "ELOS DE TRAÇÃO DANIFICADOS",
  H: "QUEBRADA",
  I: "FACAS AMASSADAS",
  J: "PEÇA NÃO ENTREGUE",
  K: "PEÇA NÃO UTILIZADA",
  L: "MATERIAL DO KIT INCORRETO",
  M: "EMPENADO",
  N: "PONTEIRA FECHADA",
  O: "CANALETA DANIFICADA",
  P: "CANALETA FECHADA",
  Q: "ROOLTOP DANIFICADO"
};

export const TIPO_DESCARTE: Record<string, string> = {
  A: "MAL USO",
  B: "PERDA",
  C: "QUEBRA",
  D: "LUBRIFICAÇÃO",
  E: "VIDA ÚTIL",
  F: "ACIDENTE",
  G: "TORÇÃO",
  H: "PONTEIRA QUEIMADA",
  I: "PONTEIRA FECHADA",
  J: "PONTEIRA QUEBRADA"
};

export function buscarMaterialPorCodigo(codigo: string) {
  return MATERIAIS_DB.find(m => m.cod === codigo) || { material: "Desconhecido", ni: "-", custo: 0 };
}
