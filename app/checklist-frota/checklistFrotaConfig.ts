// Conteúdo do Checklist de Frota (Comboio, Pipa, Multifuncional, Munck) — generaliza o
// antigo Checklist Comboio pra cobrir todos os tipos de caminhão. Os itens de cada frota
// foram reaproveitados dos checklists já existentes em
// app/checklist-mecanicos/checklistConfig.ts (getComboioConfig/getPipaConfig/
// getMultifuncionalConfig/getMunckConfig — mesmo conteúdo validado da empresa), só
// reorganizados neste formato: lista única, com `f` marcando em quais frotas o item
// aparece (sem `f` = aparece em todas) e `critical:true` nos itens que, se ficarem NC
// (ou pneu F) sem reparo, interditam o equipamento. O critério de quais itens são
// críticos foi uma escolha conservadora (freio, direção, pinos/válvula do guindauto) —
// ajuste a propriedade `critical` de qualquer item livremente, é só um booleano aqui.

export type FrotaKey = "comboio" | "pipa" | "multifuncional" | "munck";
export const FROTAS: Record<FrotaKey, string> = {
  comboio: "Comboio",
  pipa: "Pipa",
  multifuncional: "Multifuncional",
  munck: "Munck",
};

export type TipoChecklist = "ENTRADA" | "DEVOLUCAO" | "RECEBIMENTO";
export const TIPOS: { k: TipoChecklist; l: string }[] = [
  { k: "ENTRADA", l: "Entrada" },
  { k: "DEVOLUCAO", l: "Devolução" },
  { k: "RECEBIMENTO", l: "Recebimento" },
];

export type IdField = {
  k: string; l: string; type?: "text" | "number" | "date" | "time" | "select"; req?: boolean; opts?: string[];
};

export const ID_FIELDS: IdField[] = [
  { k: "placa", l: "Placa", req: true },
  { k: "frota", l: "Frota / Prefixo" },
  { k: "modelo", l: "Marca / Modelo" },
  { k: "nucleo", l: "Núcleo / Módulo" },
  { k: "km", l: "Km", type: "number", req: true },
  { k: "horimetro", l: "Horímetro (PTO)", type: "number" },
  { k: "regdiesel", l: "Registradora diesel (leitura)", type: "number" },
  { k: "reginsumo", l: "Registradora insumo (leitura)", type: "number" },
  { k: "saldo", l: "Saldo no tanque (L)", type: "number" },
  { k: "local", l: "Local" },
  { k: "data", l: "Data", type: "date", req: true },
  { k: "hora", l: "Hora", type: "time" },
  { k: "mecanico", l: "Mecânico", req: true },
  { k: "matricula", l: "Matrícula" },
  { k: "recebedor", l: "Responsável que recebe" },
];

export const GERAL: string[] = ["Frente", "Traseira", "Lateral direita", "Lateral esquerda", "Painel (km)", "Horímetro", "Implemento"];

export type SigDef = { k: string; m: string; l: string; p: string };
export const SIGS: SigDef[] = [
  { k: "mecanico", m: "matricula", l: "Mecânico", p: "Mecanico" },
  { k: "recebedor", m: "recebedormat", l: "Recebedor do caminhão", p: "Recebedor do caminhao" },
  { k: "pcm", m: "pcmmat", l: "PCM", p: "PCM" },
  { k: "supervisor", m: "supervisormat", l: "Supervisor de manutenção", p: "Supervisor de manutencao" },
  { k: "coordenador", m: "coordenadormat", l: "Coordenador do contrato", p: "Coordenador do contrato" },
];

export type SectionItem = { t: string; f?: FrotaKey[]; tp?: TipoChecklist[]; critical?: boolean };
export type ChecklistSection = { t: string; tire?: boolean; f?: FrotaKey[]; items: SectionItem[] };

const item = (t: string, extra?: Partial<SectionItem>): SectionItem => ({ t, ...extra });

export const SECTIONS: ChecklistSection[] = [
  {
    t: "Documentos e acessórios",
    items: [
      item("CRLV / ANTT"), item("CIV / CIPP"), item("Laudo eletromecânico / ART / APR"),
      item("FISPQ (diesel e insumos)"), item("Tacógrafo (disco ou fita)"),
      item("Chave principal e reserva"), item("Cartão combustível / TAG"),
    ],
  },
  {
    t: "Pneus", tire: true,
    items: ["DD", "DE", "TD1E", "TD1I", "TD2E", "TD2I", "TE1E", "TE1I", "TE2E", "TE2I", "Estepe"].map(t => item(t)),
  },
  {
    t: "Segurança e cabine",
    items: [
      item("Partida e painel sem luz de falha"),
      item("Freio / freio estacionário", { critical: true }),
      item("Barra e setor de direção", { critical: true }),
      item("Cintos de segurança"),
      item("Barras de proteção laterais e traseira"),
      item("Extintores (validade) e suportes"),
      item("Sirene de ré / trava do radiador"),
      item("Iluminação completa"),
      item("Faixas refletivas"),
      item("Parabrisa e vidros"),
      item("Limpador / palhetas"),
      item("Retrovisores / quebra-sol"),
      item("Cabine / assoalho / bancos"),
      item("Pedais / borrachas / estribos"),
      item("Ar-condicionado"),
      item("Macaco / chave de roda / triângulo"),
      item("Calços"),
      item("Rodas: porcas, parafusos, trincas"),
    ],
  },
  {
    t: "Mecânica e chassi",
    items: [
      item("Vazamento de óleo"), item("Vazamento de ar"), item("Vazamento de combustível"),
      item("Líquido de arrefecimento"), item("Suspensão / amortecedor de cabine"),
      item("Chassi (trincas, solda)"), item("Graxeiros (catraca, cruzeta)"), item("Tomada de força"),
      item("Setor de direção"), item("Carroceria", { f: ["pipa", "multifuncional", "munck"] }),
      item("Mangueiras", { f: ["pipa", "multifuncional", "munck"] }),
      item("Registros", { f: ["pipa", "multifuncional"] }),
    ],
  },
  {
    t: "Implemento comboio", f: ["comboio"],
    items: [
      item("Tanque de diesel (vazamento, tampa, respiro)"), item("Compartimentos de insumos"),
      item("Fixação do tanque / tanque hidráulico"), item("Aterramento chassi-tanque / MVE"),
      item("Propulsora / bombas"), item("Pistolas diesel, graxa e insumos"), item("Carretéis"),
      item("Mangueiras dos carretéis"), item("Correia do implemento"),
      item("Registradora (leitura e lacre)"), item("Calibrador / régua / tabela"),
      item("Escada / guarda-corpo"), item("Três pontos de acesso / piso"),
      item("Cinto com duplo talabarte"), item("Rótulos de risco / painel ONU"),
      item("Limpeza do implemento"), item("Kit ambiental (botas, cones, pá, placas, envelope, lacre)"),
      item("Dispositivo de limitação da porta"),
    ],
  },
  {
    t: "Implemento pipa", f: ["pipa"],
    items: [
      item("Escada de alumínio 08 degraus"), item("Gancho"), item("Canhão LGE"), item("Maraca"),
      item("Vazamento de água na bomba"), item("Mangueiras d'água"), item("Caixote guarda-volumes"),
      item("Manômetro de pressão da bomba do implemento"), item("Dispositivo de limitação da porta"),
    ],
  },
  {
    t: "Guindauto / carroceria", f: ["multifuncional", "munck"],
    items: [
      item("2 cintas de 2T 4M"), item("2 cintas de 4T 4M"), item("2 cintas catraca 7M 1T"), item("4 cintas 4 pontos 4M 8T"),
      item("Pinos do guindauto", { critical: true }), item("Válvula de segurança do guindauto", { critical: true }),
      item("Patolas"), item("Trava do moitão"), item("Adesivo de capacidade de carga"),
      item("Giro da torre"), item("Caixote de cintas"), item("Dispositivo de limitação da porta"),
      item("Teste de carga", { tp: ["RECEBIMENTO"] }),
    ],
  },
  {
    t: "Guindauto — detalhes", f: ["multifuncional"],
    items: [item("Cilindro pneumático da carroceria"), item("Monômetro de pressão da bomba do implemento")],
  },
];

export type Foto = { d: string; w: number; h: number };
export type ItemResposta = { s: string; obs: string; reparado: boolean; photos: Foto[] };
export type Avaria = { local: string; desc: string; photos: Foto[] };
export type Assinatura = { nome: string; matricula: string; dataUrl: string | null };

// Posição plana (si-ii) continua servindo de chave, mas agora precisa levar em conta que
// seções/itens são filtrados por frota/tipo — então a MESMA posição "si-ii" pode
// corresponder a um item diferente dependendo da frota selecionada. Pra manter uma chave
// estável independente do filtro (e não embaralhar respostas ao trocar a frota), a chave
// real é a própria seção+item concatenados.
export function itemKey(secaoTitulo: string, itemTexto: string) {
  return `${secaoTitulo}::${itemTexto}`;
}

export function secoesParaFrota(frota: FrotaKey, tipo: TipoChecklist): { sec: ChecklistSection; itens: SectionItem[] }[] {
  return SECTIONS
    .filter(sec => !sec.f || sec.f.includes(frota))
    .map(sec => ({
      sec,
      itens: sec.items.filter(it => (!it.f || it.f.includes(frota)) && (!it.tp || it.tp.includes(tipo))),
    }))
    .filter(({ itens }) => itens.length > 0);
}

export function criarItensVazios(): Record<string, ItemResposta> {
  const items: Record<string, ItemResposta> = {};
  SECTIONS.forEach(sec => sec.items.forEach(it => { items[itemKey(sec.t, it.t)] = { s: "", obs: "", reparado: false, photos: [] }; }));
  return items;
}

export function criarGeralVazio(): Record<number, Foto[]> {
  const geral: Record<number, Foto[]> = {};
  GERAL.forEach((_, gi) => { geral[gi] = []; });
  return geral;
}

export type Resultado = "LIBERADO" | "RESSALVAS" | "INTERDITADO";
export const RESULTADO_LABEL: Record<Resultado, string> = {
  LIBERADO: "Liberado", RESSALVAS: "Liberado com ressalvas", INTERDITADO: "Equipamento interditado",
};

export function calcularResultado(frota: FrotaKey, tipo: TipoChecklist, items: Record<string, ItemResposta>): Resultado {
  let temRessalva = false;
  for (const { sec, itens } of secoesParaFrota(frota, tipo)) {
    for (const it of itens) {
      const r = items[itemKey(sec.t, it.t)];
      if (!r) continue;
      const problema = r.s === "NC" || r.s === "F";
      if (!problema) continue;
      if (it.critical && !r.reparado) return "INTERDITADO";
      temRessalva = true;
    }
  }
  return temRessalva ? "RESSALVAS" : "LIBERADO";
}
