// Cópia de src/services/OSService.ts (app principal) — CRUD completo (Fase 6: módulo OS
// portado pro field-app). `createOS` já existia antes disso, criado pra cascata do Checklist
// Mecânico (ver field-app/src/modules/checklist-mecanicos/actions.ts) — mantido como estava.
// Sem `importOS` (importação de planilha é só Escritório/Web) nem `deleteBulk` (sem seleção
// em massa no field-app, ações são item a item — ver field-app/src/modules/os/OSClient.tsx).
import { z } from 'zod';
import { OSRepository } from '../repositories/OSRepository';
import { OSInsert, OSUpdate } from '../models/os';
import { getCurrentLocalDatetime } from '../utils/dateUtils';

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
  descricoes_atividade: z
    .array(
      z.object({
        descricao: z.string(),
        hora_inicio: z.string().optional().nullable(),
        hora_fim: z.string().optional().nullable(),
        foto: z.string().optional().nullable(),
        mecanico_nome: z.string().optional().nullable(),
        mecanico_matricula: z.string().optional().nullable(),
        mecanico_assinatura: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable()
    .default([]),
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
  aprovado_pcm: z.boolean().optional().nullable(),
  aprovado_pcm_por: z.string().optional().nullable(),
  aprovado_pcm_por_nome: z.string().optional().nullable(),
  aprovado_pcm_em: z.string().optional().nullable(),
  aprovado_supervisor: z.boolean().optional().nullable(),
  aprovado_supervisor_por: z.string().optional().nullable(),
  aprovado_supervisor_por_nome: z.string().optional().nullable(),
  aprovado_supervisor_em: z.string().optional().nullable(),
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

  static async updateOS(id: string, data: OSUpdate) {
    if (data.status === 'Fechada' || (data.status as any) === 'Concluída') {
      // Só define data_fechamento automaticamente se o formulário não enviou uma
      if (!data.data_fechamento) {
        data.data_fechamento = getCurrentLocalDatetime();
      }
      data.status = 'Fechada';
    }

    // Se numero_os vier vazio (ex: edição que limpou o campo), gerar automaticamente
    if ('numero_os' in data && (!data.numero_os || (data.numero_os as string).trim() === '')) {
      data.numero_os = generateOSNumber();
    }

    const partialSchema = OSSchema.partial();
    const validated = partialSchema.parse(data);

    const { data: records, error } = await OSRepository.update(id, validated as OSUpdate);
    if (error) throw new Error(error.message);

    return records && records.length > 0
      ? { success: true, data: records[0] }
      : { success: true };
  }

  static async deleteOS(id: string) {
    const { error } = await OSRepository.delete(id);
    if (error) throw new Error(error.message);
    return { success: true };
  }
}
