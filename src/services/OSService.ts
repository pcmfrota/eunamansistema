import { z } from 'zod';
import { OSRepository } from '../repositories/OSRepository';
import { OSInsert, OSUpdate } from '../models/os';

function generateOSNumber(): string {
  return `OS-${Date.now()}`;
}

const OSSchema = z.object({
  id: z.string().uuid().optional(),
  numero_os: z.string().min(1, 'Número da OS é obrigatório').or(z.literal('').transform(() => generateOSNumber())),
  equipamento_id: z.string().uuid('Equipamento é obrigatório'),
  placa: z.string().min(1, 'Placa é obrigatória').transform((val: string) => val.toUpperCase().trim()),
  modulo: z.string().optional().nullable().transform((val: string | null | undefined) => val?.trim() ?? null),
  status: z.enum(['Aberta', 'Fechada', 'Cancelada', 'Concluída']).default('Aberta'),
  data_abertura: z.string().min(1, 'Data de abertura é obrigatória'),
  data_fechamento: z.string().optional().nullable(),
  horimetro: z.number().optional().nullable(),
  operacao_tipo: z.string().optional().nullable(),
  local: z.string().optional().nullable(),
  classe: z.string().default('CORRETIVA'),
  foi_enviado_reserva: z.boolean().default(false),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  motivo: z.string().optional().nullable(),
  sistema: z.string().optional().nullable(),
  sub_sistema: z.string().optional().nullable(),
  horas_manutencao: z.number().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export class OSService {
  static formatDateTime(date: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  static generateOSNumber(): string {
    return generateOSNumber();
  }

  static async createOS(data: OSInsert) {
    if (!data.numero_os) {
      data.numero_os = this.generateOSNumber();
    }

    const validated = OSSchema.parse(data);

    const { error } = await OSRepository.create(validated);
    if (error) throw new Error(error.message);
    
    return { success: true };
  }

  static async updateOS(id: string, data: OSUpdate) {
    if (data.status === 'Fechada' || data.status === 'Concluída') {
      // Só define data_fechamento automaticamente se o formulário não enviou uma
      if (!data.data_fechamento) {
        data.data_fechamento = this.formatDateTime();
      }
      data.status = 'Fechada';
    }

    // Se numero_os vier vazio (OS importada sem número), gerar automaticamente
    if (!data.numero_os || (data.numero_os as string).trim() === '') {
      data.numero_os = generateOSNumber();
    }

    const partialSchema = OSSchema.partial();
    const validated = partialSchema.parse(data);

    const { error } = await OSRepository.update(id, validated);
    if (error) throw new Error(error.message);

    return { success: true };
  }

  static async deleteOS(id: string) {
    const { error } = await OSRepository.delete(id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async deleteBulk(ids: string[]) {
    const { error } = await OSRepository.deleteMany(ids);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async importOS(rows: any[]) {
    const { data: equipamentos } = await OSRepository.getEquipamentos();
    const eqMap: Record<string, { id: string; modulo: string; ultimoHist: number | null }> = {};
    equipamentos?.forEach(e => { eqMap[e.placa.toUpperCase()] = { id: e.id, modulo: e.modulo || '', ultimoHist: e.ultimoHist } });

    const inserts: OSInsert[] = [];
    const eqUpdates: Record<string, number> = {};

    for (const row of rows) {
      try {
        const placaRaw = this.getVal(row, ['placa', 'Equipamento', 'Veículo', 'Máquina', 'Placa']) || '';
        let placaUpper = String(placaRaw).toUpperCase().trim();
        const eq = eqMap[placaUpper];

        const horimetro = this.parseFloatSafe(this.getVal(row, ['horimetro', 'Horímetro', 'KM', 'Hori']));
        
        if (eq && horimetro && (!eq.ultimoHist || horimetro > eq.ultimoHist)) {
          if (!eqUpdates[eq.id] || horimetro > eqUpdates[eq.id]) {
            eqUpdates[eq.id] = horimetro;
          }
        }

        const raw = {
          numero_os: `${this.generateOSNumber()}-${Math.floor(Math.random() * 1000)}`,
          equipamento_id: eq ? eq.id : null,
          placa: eq ? placaUpper : 'EQUIPAMENTO_NAO_ENCONTRADO',
          modulo: eq ? eq.modulo : (this.getVal(row, ['modulo', 'Módulo']) || null),
          status: this.getVal(row, ['status', 'Situação', 'Estado', 'Status']) || 'Aberta',
          data_abertura: this.parsePossibleDate(this.getVal(row, ['data_abertura', 'Abertura', 'Data Início', 'Início'])) || new Date().toISOString(),
          data_fechamento: this.parsePossibleDate(this.getVal(row, ['data_fechamento', 'Fechamento', 'Data Fim', 'Conclusão'])),
          horimetro,
          operacao_tipo: this.getVal(row, ['operacao_tipo', 'Operação (Tipo)', 'Operação', 'Tipo']),
          local: this.getVal(row, ['local', 'Local', 'Frente']),
          classe: this.getVal(row, ['classe', 'Classe', 'Tipo Manutenção', 'Tipo de OS']) || 'CORRETIVA',
          foi_enviado_reserva: row.foi_enviado_reserva === true || String(row.foi_enviado_reserva).toUpperCase() === 'SIM',
          descricao: this.getVal(row, ['descricao', 'Descrição', 'Serviço', 'Atividade']) || 'Importação via Planilha',
          motivo: this.getVal(row, ['motivo', 'Motivo', 'Causa']),
          sistema: this.getVal(row, ['sistema', 'Sistema']),
          sub_sistema: this.getVal(row, ['sub_sistema', 'Sub-Sistema', 'Subsistema']),
          horas_manutencao: this.parseFloatSafe(this.getVal(row, ['horas_manutencao', 'Horas', 'Tempo'])),
          observacoes: this.getVal(row, ['observacoes', 'Observações', 'Notas'])
        };

        if (raw.equipamento_id) {
          inserts.push(OSSchema.parse(raw));
        }
      } catch (err) {
        console.warn('Falha ao validar linha de OS durante importação:', err);
      }
    }

    if (inserts.length === 0) throw new Error('Nenhuma OS válida encontrada para importação');

    const { error: insError } = await OSRepository.create(inserts);
    if (insError) throw new Error(insError.message);

    for (const [id, value] of Object.entries(eqUpdates)) {
      await OSRepository.updateEquipamentoHorimetro(id, value);
    }

    return { success: true, count: inserts.length };
  }

  private static parsePossibleDate(d?: any) {
    if (!d) return null;
    if (typeof d === 'number' && d > 20000 && d < 100000) {
      const jsDate = new Date(Math.round((d - 25569) * 86400 * 1000));
      return jsDate.toISOString();
    }
    const str = String(d).trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(str)) {
      const parts = str.split(' ');
      const dateParts = parts[0].split('/');
      const day = dateParts[0].padStart(2, '0');
      const month = dateParts[1].padStart(2, '0');
      let year = dateParts[2];
      if (year.length === 2) year = '20' + year;
      let timePart = parts[1] || '00:00:00';
      if (timePart.split(':').length === 2) timePart += ':00';
      return `${year}-${month}-${day}T${timePart}`;
    }
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) return dt.toISOString();
    return null;
  }

  private static getVal(row: any, aliases: string[]) {
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') return row[alias];
      const key = Object.keys(row).find(k => k.toLowerCase() === alias.toLowerCase());
      if (key && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    }
    return null;
  }

  private static parseFloatSafe(val: any) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return val;
    const strVal = String(val).trim();
    if (strVal.includes(',')) {
      const parsed = parseFloat(strVal.replace(/\./g, '').replace(',', '.'));
      return isNaN(parsed) ? null : parsed;
    }
    const parsed = parseFloat(strVal);
    return isNaN(parsed) ? null : parsed;
  }
}
