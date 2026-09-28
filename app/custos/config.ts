// Configuração compartilhada das áreas do Controle de Custos (Manutenção, Operação,
// Administrativo, Oficina-Base, Segurança) — sem "use client"/"use server", pra poder ser
// importada tanto pelas server actions (actions.ts) quanto pelos componentes client
// (CustosClient.tsx, CustoModal.tsx, ImportExportModal.tsx, CustosPDF.ts) sem cruzar a
// fronteira client/server e sem duplicar a lista em cada arquivo.
import type { AreaCusto } from "./actions";

export const AREAS: { value: AreaCusto; label: string }[] = [
  { value: "MANUTENCAO", label: "Manutenção" },
  { value: "OPERACAO", label: "Operação" },
  { value: "ADMINISTRATIVO", label: "Administrativo" },
  { value: "OFICINA_BASE", label: "Oficina (Base)" },
  { value: "SEGURANCA", label: "Segurança" },
];

export const AREA_LABEL: Record<AreaCusto, string> = Object.fromEntries(AREAS.map((a) => [a.value, a.label])) as Record<AreaCusto, string>;

// Categorias específicas de cada área não-Manutenção — Manutenção usa seu próprio campo
// tipo_manutencao (Corretiva/Preventiva/Preditiva), que já existia antes dessa separação.
export const CATEGORIAS_POR_AREA: Record<AreaCusto, { value: string; label: string }[]> = {
  MANUTENCAO: [],
  OPERACAO: [
    { value: "MATERIAL", label: "Material" },
    { value: "SERVICOS", label: "Serviços" },
    { value: "MAO_DE_OBRA", label: "Mão de Obra" },
    { value: "OUTROS", label: "Outros" },
  ],
  ADMINISTRATIVO: [
    { value: "MATERIAL_ESCRITORIO", label: "Material de Escritório" },
    { value: "SERVICOS", label: "Serviços" },
    { value: "INFORMATICA", label: "Informática" },
    { value: "OUTROS", label: "Outros" },
  ],
  OFICINA_BASE: [
    { value: "SERVICOS", label: "Serviços" },
    { value: "MANUTENCAO", label: "Manutenção" },
    { value: "OUTROS", label: "Outros" },
  ],
  SEGURANCA: [
    { value: "EPIS", label: "EPIs" },
    { value: "INFORMATICA", label: "Informática" },
    { value: "SERVICOS_GRAFICOS", label: "Serviços Gráficos" },
    { value: "SERVICOS", label: "Serviços" },
    { value: "OUTROS", label: "Outros" },
  ],
};
