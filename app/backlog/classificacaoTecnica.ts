// Classificação técnica (Sistema → Subsistema → Componente) e demais listas de apoio
// pro formulário de Backlog. Taxonomia fixa de engenharia (não é cadastro editável pelo
// usuário, por isso fica hardcoded aqui em vez de uma tabela auxiliar no banco) — só os
// 3 códigos (sistema_cod/subsistema_cod/componente_cod) são persistidos; nome exibido
// sempre vem deste mapa, nunca duplicado/guardado solto no registro.

export type ItemClassificacao = { cod: number; nome: string }
export type SubsistemaItem = ItemClassificacao & { sistemaCod: number }
export type ComponenteItem = ItemClassificacao & { subsistemaCod: number }

export const SISTEMAS: ItemClassificacao[] = [
  { cod: 1, nome: "CABINE" },
  { cod: 2, nome: "ESTRUTURA" },
  { cod: 3, nome: "ESTABILIDADE" },
  { cod: 4, nome: "GERAL" },
  { cod: 5, nome: "MOTOR" },
  { cod: 6, nome: "RODAGEM" },
  { cod: 7, nome: "ELÉTRICO" },
  { cod: 8, nome: "TRANSMISSÃO" },
  { cod: 9, nome: "HIDRÁULICO" },
  { cod: 10, nome: "IMPLEMENTO" },
]

export const SUBSISTEMAS: SubsistemaItem[] = [
  { cod: 110, nome: "CABINE INTERNA", sistemaCod: 1 },
  { cod: 120, nome: "CABINE EXTERNA", sistemaCod: 1 },
  { cod: 210, nome: "CHASSI", sistemaCod: 2 },
  { cod: 220, nome: "CARROCERIA", sistemaCod: 2 },
  { cod: 310, nome: "DIREÇÃO", sistemaCod: 3 },
  { cod: 320, nome: "SUSPENSÃO", sistemaCod: 3 },
  { cod: 330, nome: "FREIOS", sistemaCod: 3 },
  { cod: 340, nome: "EIXOS", sistemaCod: 3 },
  { cod: 410, nome: "SEGURANÇA", sistemaCod: 4 },
  { cod: 420, nome: "LAVAGEM", sistemaCod: 4 },
  { cod: 430, nome: "LUBRIFICAÇÃO", sistemaCod: 4 },
  { cod: 440, nome: "CHECK LIST", sistemaCod: 4 },
  { cod: 510, nome: "ADMISSÃO & ESCAPE", sistemaCod: 5 },
  { cod: 520, nome: "ALIMENTAÇÃO E COMBUSTÍVEL", sistemaCod: 5 },
  { cod: 530, nome: "ARREFECIMENTO", sistemaCod: 5 },
  { cod: 540, nome: "MOTOR COMPLETO", sistemaCod: 5 },
  { cod: 610, nome: "PNEUMÁTICO", sistemaCod: 6 },
  { cod: 710, nome: "ACIONADOR BATERIA", sistemaCod: 7 },
  { cod: 720, nome: "REFRIGERAÇÃO CABINE", sistemaCod: 7 },
  { cod: 730, nome: "ILUMINAÇÃO", sistemaCod: 7 },
  { cod: 740, nome: "CABINE", sistemaCod: 7 },
  { cod: 750, nome: "CHICOTE ELÉTRICO", sistemaCod: 7 },
  { cod: 810, nome: "CÂMBIO", sistemaCod: 8 },
  { cod: 820, nome: "DIFERENCIAL", sistemaCod: 8 },
  { cod: 910, nome: "BLOCOS", sistemaCod: 9 },
  { cod: 920, nome: "MANGUEIRAS", sistemaCod: 9 },
  { cod: 930, nome: "CILINDROS", sistemaCod: 9 },
  { cod: 940, nome: "RESERVATÓRIO", sistemaCod: 9 },
  { cod: 950, nome: "BOMBAS", sistemaCod: 9 },
  { cod: 960, nome: "MOTORES", sistemaCod: 9 },
  { cod: 1010, nome: "MUNCK", sistemaCod: 10 },
  { cod: 1020, nome: "COMBOIO", sistemaCod: 10 },
  { cod: 1030, nome: "PIPA", sistemaCod: 10 },
  { cod: 1040, nome: "MULT", sistemaCod: 10 },
  { cod: 1050, nome: "SKID", sistemaCod: 10 },
]

// subsistemaCod preenchido pela regra FLOOR(cód/10)*10, igual ao pedido original — nos
// componentes 911–961 isso aponta pra um nome de subsistema que não bate 100% (ex: 911
// CILINDROS cai em 910 BLOCOS), inconsistência que já vem dos dados originais, mantida
// de propósito em vez de "corrigida" por conta própria.
export const COMPONENTES: ComponenteItem[] = [
  { cod: 111, nome: "CABINE INTERNA", subsistemaCod: 110 },
  { cod: 121, nome: "CABINE EXTERNA", subsistemaCod: 120 },
  { cod: 122, nome: "FILTRO DA CABINE", subsistemaCod: 120 },
  { cod: 211, nome: "CHASSI", subsistemaCod: 210 },
  { cod: 221, nome: "CARROCERIA", subsistemaCod: 220 },
  { cod: 311, nome: "DIREÇÃO", subsistemaCod: 310 },
  { cod: 321, nome: "SUSPENSÃO DIANT.", subsistemaCod: 320 },
  { cod: 322, nome: "SUSPENSÃO TRAS.", subsistemaCod: 320 },
  { cod: 331, nome: "RESERVATÓRIO FLUIDO FREIO", subsistemaCod: 330 },
  { cod: 332, nome: "CUÍCA", subsistemaCod: 330 },
  { cod: 333, nome: "TAMBOR", subsistemaCod: 330 },
  { cod: 334, nome: "COMPRESSOR AR", subsistemaCod: 330 },
  { cod: 335, nome: "FREIOS", subsistemaCod: 330 },
  { cod: 341, nome: "EIXO LIVRE", subsistemaCod: 340 },
  { cod: 411, nome: "SEGURANÇA", subsistemaCod: 410 },
  { cod: 412, nome: "TACÓGRAFO", subsistemaCod: 410 },
  { cod: 413, nome: "BUZINA, SIRENE E CINTO DE SEGURANÇA", subsistemaCod: 410 },
  { cod: 414, nome: "EXTINTOR DE INCÊNDIO", subsistemaCod: 410 },
  { cod: 421, nome: "LAVAGEM", subsistemaCod: 420 },
  { cod: 431, nome: "LUBRIFICAÇÃO", subsistemaCod: 430 },
  { cod: 441, nome: "CHECK LIST", subsistemaCod: 440 },
  { cod: 511, nome: "FILTRO AR PRIMÁRIO", subsistemaCod: 510 },
  { cod: 512, nome: "FILTRO AR SECUNDÁRIO", subsistemaCod: 510 },
  { cod: 513, nome: "ADMISSÃO & ESCAPE", subsistemaCod: 510 },
  { cod: 521, nome: "TANQUE DE COMBUSTÍVEL", subsistemaCod: 520 },
  { cod: 522, nome: "FILTRO SEDIMENTADOR", subsistemaCod: 520 },
  { cod: 523, nome: "FILTRO COMBUSTÍVEL PRIMA.", subsistemaCod: 520 },
  { cod: 524, nome: "FILTRO COMBUSTÍVEL SEC.", subsistemaCod: 520 },
  { cod: 525, nome: "ALIMENTAÇÃO E COMBUSTÍVEL", subsistemaCod: 520 },
  { cod: 526, nome: "SISTEMA ARLA", subsistemaCod: 520 },
  { cod: 531, nome: "RADIADOR ÁGUA", subsistemaCod: 530 },
  { cod: 532, nome: "ARREFECIMENTO", subsistemaCod: 530 },
  { cod: 541, nome: "FILTRO MOTOR", subsistemaCod: 540 },
  { cod: 542, nome: "TENSOR, POLIA E CORREIA", subsistemaCod: 540 },
  { cod: 543, nome: "MOTOR COMPLETO", subsistemaCod: 540 },
  { cod: 611, nome: "RODA", subsistemaCod: 610 },
  { cod: 612, nome: "PNEU", subsistemaCod: 610 },
  { cod: 711, nome: "BATERIA", subsistemaCod: 710 },
  { cod: 712, nome: "ALTERNADOR", subsistemaCod: 710 },
  { cod: 713, nome: "MOTOR PARTIDA", subsistemaCod: 710 },
  { cod: 721, nome: "RADIADOR (AR COND.)", subsistemaCod: 720 },
  { cod: 722, nome: "CONDENSADOR (AR COND.)", subsistemaCod: 720 },
  { cod: 723, nome: "COMPRESSOR (AR COND.)", subsistemaCod: 720 },
  { cod: 724, nome: "CLIMATIZADOR", subsistemaCod: 720 },
  { cod: 725, nome: "SISTEMA GERAL", subsistemaCod: 720 },
  { cod: 731, nome: "ILUMINAÇÃO", subsistemaCod: 730 },
  { cod: 741, nome: "COMUNICAÇÃO", subsistemaCod: 740 },
  { cod: 751, nome: "CHICOTE PRINCIPAL", subsistemaCod: 750 },
  { cod: 752, nome: "CHICOTE PERIFÉRICOS", subsistemaCod: 750 },
  { cod: 753, nome: "CHICOTE DE ILUMINAÇÃO", subsistemaCod: 750 },
  { cod: 811, nome: "EMBREAGEM", subsistemaCod: 810 },
  { cod: 812, nome: "CÁRTER CÂMBIO", subsistemaCod: 810 },
  { cod: 813, nome: "CAIXA TRANSFERÊNCIA", subsistemaCod: 810 },
  { cod: 814, nome: "TRANS. HIDRÁULICA", subsistemaCod: 810 },
  { cod: 815, nome: "FILTRO TRANSMISSÃO", subsistemaCod: 810 },
  { cod: 816, nome: "TOMADA FORÇA", subsistemaCod: 810 },
  { cod: 817, nome: "CÂMBIO", subsistemaCod: 810 },
  { cod: 821, nome: "CARDAN", subsistemaCod: 820 },
  { cod: 822, nome: "DIFERENCIAL DIANT.", subsistemaCod: 820 },
  { cod: 823, nome: "DIFERENCIAL TRAS.", subsistemaCod: 820 },
  { cod: 824, nome: "CUBO", subsistemaCod: 820 },
  { cod: 911, nome: "CILINDROS", subsistemaCod: 910 },
  { cod: 921, nome: "MANGUEIRAS", subsistemaCod: 920 },
  { cod: 931, nome: "RESERVATÓRIO", subsistemaCod: 930 },
  { cod: 941, nome: "BLOCOS", subsistemaCod: 940 },
  { cod: 951, nome: "MOTORES", subsistemaCod: 950 },
  { cod: 961, nome: "BOMBAS", subsistemaCod: 960 },
  { cod: 1011, nome: "MUNCK", subsistemaCod: 1010 },
  { cod: 1012, nome: "COMANDO", subsistemaCod: 1010 },
  { cod: 1013, nome: "MANGUEIRAS", subsistemaCod: 1010 },
  { cod: 1014, nome: "CILINDROS", subsistemaCod: 1010 },
  { cod: 1015, nome: "CARROCERIA", subsistemaCod: 1010 },
  { cod: 1016, nome: "GUARDA-CORPO", subsistemaCod: 1010 },
  { cod: 1017, nome: "BOMBAS", subsistemaCod: 1010 },
  { cod: 1018, nome: "TOMADA DE FORÇA", subsistemaCod: 1010 },
  { cod: 1021, nome: "COMBOIO", subsistemaCod: 1020 },
  { cod: 1022, nome: "PORTAS CASARIA", subsistemaCod: 1020 },
  { cod: 1023, nome: "CARRETEL", subsistemaCod: 1020 },
  { cod: 1024, nome: "PISTOLAS", subsistemaCod: 1020 },
  { cod: 1025, nome: "RESERVATÓRIOS", subsistemaCod: 1020 },
  { cod: 1026, nome: "PROPULSORA", subsistemaCod: 1020 },
  { cod: 1027, nome: "BOMBAS", subsistemaCod: 1020 },
  { cod: 1028, nome: "GUARDA-CORPO", subsistemaCod: 1020 },
  { cod: 1031, nome: "PIPA", subsistemaCod: 1030 },
  { cod: 1032, nome: "MANGUEIRAS", subsistemaCod: 1030 },
  { cod: 1033, nome: "CARRETEL", subsistemaCod: 1030 },
  { cod: 1034, nome: "BOMBAS", subsistemaCod: 1030 },
  { cod: 1035, nome: "REGISTROS", subsistemaCod: 1030 },
  { cod: 1036, nome: "PISTOLA/ESGUICHO", subsistemaCod: 1030 },
  { cod: 1037, nome: "GUARDA-CORPO", subsistemaCod: 1030 },
  { cod: 1041, nome: "MULT", subsistemaCod: 1040 },
  { cod: 1051, nome: "SKID", subsistemaCod: 1050 },
]

export function subsistemasDoSistema(sistemaCod: number | null): SubsistemaItem[] {
  if (!sistemaCod) return []
  return SUBSISTEMAS.filter(s => s.sistemaCod === sistemaCod)
}

export function componentesDoSubsistema(subsistemaCod: number | null): ComponenteItem[] {
  if (!subsistemaCod) return []
  return COMPONENTES.filter(c => c.subsistemaCod === subsistemaCod)
}

export function nomeSistema(cod: number | null): string {
  return SISTEMAS.find(s => s.cod === cod)?.nome || ""
}
export function nomeSubsistema(cod: number | null): string {
  return SUBSISTEMAS.find(s => s.cod === cod)?.nome || ""
}
export function nomeComponente(cod: number | null): string {
  return COMPONENTES.find(c => c.cod === cod)?.nome || ""
}

// ── Listas de apoio (sugestões iniciais — campo continua aceitando texto livre) ──

export const ORIGENS: { cod: string; nome: string }[] = [
  { cod: "CEMMEC", nome: "CHECKLIST ENTRADA MANUTENÇÃO - MECÂNICO" },
  { cod: "CEMMOT", nome: "CHECKLIST ENTRADA MANUTENÇÃO - MOTORISTA" },
  { cod: "CSMMEC", nome: "CHECKLIST SAÍDA MANUTENÇÃO - MECÂNICO" },
  { cod: "CSMMOT", nome: "CHECKLIST SAÍDA MANUTENÇÃO - MOTORISTA" },
  { cod: "CMOT", nome: "CHECKLIST MOTORISTA" },
  { cod: "MVE", nome: "INSPEÇÃO DE MÁQUINAS, VEÍCULOS E EQUIPAMENTOS" },
  { cod: "GAOS", nome: "GRUPO ABERTURA DE OS" },
  { cod: "IS", nome: "INSPEÇÃO SENSITIVA" },
  { cod: "OPA", nome: "OPA" },
  { cod: "DNA", nome: "DNA" },
  { cod: "IC", nome: "INSPEÇÃO PELO CLIENTE" },
]

export const MAO_DE_OBRA_SUGESTOES = ["THIAGO", "HIGOR", "SOLDA", "TERCEIRO", "BORRACHARIA"]

export const REGIAO_PROGRAMACAO_SUGESTOES = [
  "OFICINA",
  "PROG PARA OFICINA",
  "PROGRAMAR NA BASE",
]

export const DETALHAMENTO_PEDIDO_SUGESTOES = [
  "AGUARDANDO PAGAMENTO",
  "LIBERADO FORNECEDOR",
  "RECEBIDO ALMOXARIFADO",
  "RETIRADO ALMOXARIFADO",
  "SERVIÇO/BASE",
  "AGUARDANDO AVALIAÇÃO DA MANUTENÇÃO",
  "AGUARDANDO COMPRADOR",
  "AGUARDANDO FORNECEDOR",
  "AGUARDANDO REFERÊNCIA",
  "AGUARDANDO PROGRAMAÇÃO",
  "SEM PROGRAMAÇÃO",
  "EM ANDAMENTO",
  "ATENDIDO",
  "ESTOQUE",
  "FALTOU ITEM NA REQUISIÇÃO",
]

// ── Cálculos auxiliares (só exibidos — nunca sobrescrevem o que o usuário decide) ──

function soDia(v?: string | null): Date | null {
  if (!v) return null
  const d = new Date(String(v).split("T")[0])
  return isNaN(d.getTime()) ? null : d
}

/** URGENTE (<4 dias) / NORMAL (4–7) / PROGRAMADO (>7) entre a evidência e a necessidade do material. */
export function calcularTipoPedido(dataEvidencia?: string | null, dataNecessidade?: string | null): string {
  const evid = soDia(dataEvidencia)
  const nec = soDia(dataNecessidade)
  if (!evid || !nec) return ""
  const diffDias = Math.round((nec.getTime() - evid.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDias < 4) return "URGENTE"
  if (diffDias <= 7) return "NORMAL"
  return "PROGRAMADO"
}

/** ATENDE / NÃO ATENDE / SEM PREVISÃO / SEM REQUISIÇÃO — e vazio se ainda não há necessidade de material. */
export function calcularSituacaoRC(params: {
  dataNecessidade?: string | null
  nrRc?: string | null
  previsaoMaterial?: string | null
}): string {
  const { dataNecessidade, nrRc, previsaoMaterial } = params
  if (!dataNecessidade) return ""
  if (!nrRc || !String(nrRc).trim()) return "SEM REQUISIÇÃO"
  const nec = soDia(dataNecessidade)
  const prev = soDia(previsaoMaterial)
  if (!prev) return "SEM PREVISÃO"
  if (!nec) return "ATENDE"
  return prev.getTime() > nec.getTime() ? "NÃO ATENDE" : "ATENDE"
}
