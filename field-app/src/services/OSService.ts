// Cópia MÍNIMA de src/services/OSService.ts (app principal) — só createOS (zod + insert
// simples, sem service-role key), usado pela cascata do Checklist Mecânico. Ver nota em
// field-app/src/repositories/OSRepository.ts.
import { z } from 'zod';
import { OSRepository } from '../repositories/OSRepository';
import { OSInsert } from '../models/os';

function generateOSNumber(): string {
  return `OS-${Date.now()}`;
}

const OSSchema = z.object({
  id: z.string().uuid().optional(),
  numero_os: z.string().min(1, 'Número da OS é obrigatório').or(z.literal('').transform(() => generateOSNumber())),
  equipamento_id: z.string().min(1, 'Equipamento ID é obrigatório'),
  placa: z.string().min(1, 'Placa é obrigatória').transform((val: string) => val.toUpperCase().trim()),
  modulo: z.string().optional().nullable().transform((val: string | null | undefined) => val?.trim() ?? null),
  status: z.enum(['Aberta', 'Programado', 'Fechada', 'Cancelada', 'Concluída']).default('Aberta'),
  data_abertura: z.string().min(1, 'Data de abertura é obrigatória'),
  data_fechamento: z.string().optional().nullable(),
  horimetro: z.number().optional().nullable(),
  km: z.number().optional().nullable(),
  foto_horimetro: z.string().optional().nullable(),
  foto_km: z.string().optional().nullable(),
  operacao_tipo: z.string().optional().nullable(),
  local: z.string().optional().nullable(),
  classe: z.string().default('CORRETIVA'),
  foi_enviado_reserva: z.boolean().default(false),
  // .transform(v => v ?? ...) em vez de .nullable().default(...) (como no app principal):
  // .default() só entra em ação pra undefined, não pra null — então o tipo de saída real
  // continha `string | null`, incompatível com OSInsert.descricao: string. Bug latente no
  // app principal nunca pego lá porque o build do Next.js tolera erro de tipo; aqui o
  // field-app usa tsc --noEmit estrito, então corrigido só nesta cópia local.
  descricao: z.string().optional().nullable().transform((val) => val ?? 'Importação via Planilha'),
  motivo: z.string().optional().nullable(),
  sistema: z.string().optional().nullable(),
  sub_sistema: z.string().optional().nullable(),
  horas_manutencao: z.number().optional().nullable(),
  horario_parada: z.string().optional().nullable(),
  qual_reserva: z.string().optional().nullable(),
  horas_reserva_chegou: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  componente: z.string().optional().nullable(),
  mecanicos: z.array(z.string()).optional().nullable().default([]),
  assinatura_mecanico: z.string().optional().nullable(),
  fotos: z.array(z.string()).optional().nullable().default([]),
  aprovado: z.boolean().optional().default(true),
  created_by: z.string().optional().nullable(),
  created_by_nome: z.string().optional().nullable(),
  aprovado_por: z.string().optional().nullable(),
  aprovado_por_nome: z.string().optional().nullable(),
  aprovado_em: z.string().optional().nullable(),
});

export class OSService {
  static generateOSNumber(): string {
    return generateOSNumber();
  }

  static async createOS(data: OSInsert) {
    if (!data.numero_os) {
      data.numero_os = this.generateOSNumber();
    }

    const validated = OSSchema.parse(data);

    const { data: records, error } = await OSRepository.create(validated);
    if (error) throw new Error(error.message);

    return records && records.length > 0
      ? { success: true, data: records[0] }
      : { success: true };
  }
}
