// Conteúdo do Checklist Comboio — portado 1:1 do protótipo HTML/JS testado em campo
// pelo usuário (checklist-comboio.html / js/config.js). Mudar os itens aqui é a única
// coisa necessária pra ajustar o formulário; o componente só itera sobre isto.

export type IdField = { k: string; l: string; type?: "text" | "number" | "date" | "time"; req?: boolean };

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

export type ChecklistSection = { t: string; tire?: boolean; items: string[] };

export const SECTIONS: ChecklistSection[] = [
  { t: "Documentos e acessórios", items: ["CRLV / ANTT", "CIV / CIPP", "Laudo eletromecânico / ART / APR", "FISPQ (diesel e insumos)", "Tacógrafo (disco ou fita)", "Chave principal e reserva", "Cartão combustível / TAG"] },
  { t: "Pneus", tire: true, items: ["DD", "DE", "TD1E", "TD1I", "TD2E", "TD2I", "TE1E", "TE1I", "TE2E", "TE2I", "Estepe"] },
  { t: "Segurança e cabine", items: ["Partida e painel sem luz de falha", "Freio / freio estacionário", "Barra e setor de direção", "Cintos de segurança", "Barras de proteção laterais e traseira", "Extintores (validade) e suportes", "Sirene de ré / trava do radiador", "Iluminação completa", "Faixas refletivas", "Parabrisa e vidros", "Limpador / palhetas", "Retrovisores / quebra-sol", "Cabine / assoalho / bancos", "Pedais / borrachas / estribos", "Ar-condicionado", "Macaco / chave de roda / triângulo", "Calços", "Rodas: porcas, parafusos, trincas"] },
  { t: "Mecânica e chassi", items: ["Vazamento de óleo", "Vazamento de ar", "Vazamento de combustível", "Líquido de arrefecimento", "Suspensão / amortecedor de cabine", "Chassi (trincas, solda)", "Graxeiros (catraca, cruzeta)", "Tomada de força"] },
  { t: "Implemento comboio", items: ["Tanque de diesel (vazamento, tampa, respiro)", "Compartimentos de insumos", "Fixação do tanque / tanque hidráulico", "Aterramento chassi-tanque / MVE", "Propulsora / bombas", "Pistolas diesel, graxa e insumos", "Carretéis", "Mangueiras dos carretéis", "Correia do implemento", "Registradora (leitura e lacre)", "Calibrador / régua / tabela", "Escada / guarda-corpo", "Três pontos de acesso / piso", "Cinto com duplo talabarte", "Rótulos de risco / painel ONU", "Limpeza do implemento"] },
];

export type Foto = { d: string; w: number; h: number };
export type ItemResposta = { s: string; obs: string; photos: Foto[] };
export type Avaria = { local: string; desc: string; photos: Foto[] };
export type Assinatura = { nome: string; matricula: string; dataUrl: string | null };

export function itemKey(si: number, ii: number) { return `${si}-${ii}`; }

export function criarItensVazios(): Record<string, ItemResposta> {
  const items: Record<string, ItemResposta> = {};
  SECTIONS.forEach((sec, si) => sec.items.forEach((_, ii) => { items[itemKey(si, ii)] = { s: "", obs: "", photos: [] }; }));
  return items;
}

export function criarGeralVazio(): Record<number, Foto[]> {
  const geral: Record<number, Foto[]> = {};
  GERAL.forEach((_, gi) => { geral[gi] = []; });
  return geral;
}
