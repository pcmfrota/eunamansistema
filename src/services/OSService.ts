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
  status: z.enum(['Aberta', 'Fechada', 'Cancelada', 'Concluída', 'Em Andamento']).default('Aberta'),
  data_abertura: z.string().min(1, 'Data de abertura é obrigatória'),
  data_fechamento: z.string().optional().nullable(),
  horimetro: z.number().optional().nullable(),
  operacao_tipo: z.string().optional().nullable(),
  local: z.string().optional().nullable(),
  classe: z.string().default('CORRETIVA'),
  foi_enviado_reserva: z.boolean().default(false),
  descricao: z.string().optional().nullable().default('Importação via Planilha'),
  motivo: z.string().optional().nullable(),
  sistema: z.string().optional().nullable(),
  sub_sistema: z.string().optional().nullable(),
  horas_manutencao: z.number().optional().nullable(),
  horario_parada: z.string().optional().nullable(),
  qual_reserva: z.string().optional().nullable(),
  horas_reserva_chegou: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  componente: z.string().optional().nullable(),
});

export class OSService {
  static formatDateTime(): string {
    return getCurrentLocalDatetime();
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
    if (!rows || rows.length === 0) throw new Error('Nenhum dado fornecido para importação');
    
    const { data: equipamentos } = await OSRepository.getEquipamentos();
    const eqMap: Record<string, { id: string; modulo: string }> = {};
    equipamentos?.forEach(e => { eqMap[e.placa.toUpperCase()] = { id: e.id, modulo: e.modulo || '' } });

    const inserts: OSInsert[] = [];
    const missingPlates = new Set<string>();

    for (const row of rows) {
      const placaRaw = this.getVal(row, [
        'placa', 'Placa', 'PLACA', 'equipamento', 'Equipamento', 'EQUIPAMENTO',
        'veiculo', 'Veículo', 'VEÍCULO', 'maquina', 'Máquina', 'MÁQUINA',
        'frota', 'Frota', 'FROTA', 'TAG/FUNAMAN', 'TAG FUNAMAN', 'TAGFUNAMAN',
        'TAG/SUZANO', 'TAG SUZANO', 'TAGSUZANO', 'NRUI', 'NR UI',
      ]);

      if (!placaRaw) continue;

      const placaUpper = String(placaRaw).toUpperCase().trim();
      const eq = eqMap[placaUpper];
      if (!eq) {
        missingPlates.add(placaUpper);
        continue; // Pula esta linha pois equipamento_id é obrigatório no banco
      }

      try {
        const raw = {
          numero_os: this.getVal(row, ['numero_os', 'Nº OS', 'N° OS', 'Numero OS', 'OS', 'num_os', 'NºOS', 'N.O.S', 'NOS', 'NUMERO OS']) || `${generateOSNumber()}-${Math.random().toString(36).substr(2, 5)}`,
          equipamento_id: eq ? eq.id : null,
          placa: placaUpper,
          modulo: this.getVal(row, ['modulo', 'Módulo', 'Modulo', 'MODULO', 'MÓDULO', 'MOD', 'Mod', 'Mód']) || (eq ? eq.modulo : null),
          status: (() => { const s = String(this.getVal(row, ['status', 'Status', 'Situação', 'situacao', 'Estado', 'STATUS']) || 'Aberta').trim().toLowerCase(); const sm: Record<string, string> = {'fechada':'Fechada','fechado':'Fechada','concluida':'Fechada','concluído':'Fechada','aberta':'Aberta','aberto':'Aberta','em aberto':'Aberta','em andamento':'Em Andamento','andamento':'Em Andamento','cancelada':'Cancelada','cancelado':'Cancelada'}; return sm[s] || 'Aberta'; })(),
          data_abertura: this.parsePossibleDate(this.getVal(row, ['data_abertura', 'Abertura', 'Data Abertura', 'Data Início', 'Inicio', 'DATA ABERTURA', 'Data'])) || getCurrentLocalDatetime(),
          data_fechamento: this.parsePossibleDate(this.getVal(row, ['data_fechamento', 'Fechamento', 'Data Fechamento', 'Data Fim', 'Conclusão', 'DATA FECHAMENTO'])),
          horimetro: this.parseFloatSafe(this.getVal(row, ['horimetro', 'Horímetro', 'KM', 'Hori', 'KM/H', 'Hodometro', 'Hodômetro', 'HR', 'HRS'])),
          operacao_tipo: this.getVal(row, ['operacao_tipo', 'Operação (Tipo)', 'Operação', 'Tipo', 'Tipo Operação', 'OPERAÇÃO', 'OP']),
          local: this.getVal(row, ['local', 'Local', 'Frente', 'LOCAL']),
          classe: this.getVal(row, ['classe', 'Classe', 'Tipo Manutenção', 'Tipo de OS', 'CLASSE', 'Tipo OS', 'TIPO']) || 'CORRETIVA',
          foi_enviado_reserva: row.foi_enviado_reserva === true || String(row.foi_enviado_reserva || '').toUpperCase() === 'SIM',
          descricao: this.getVal(row, ['descricao', 'Descrição', 'Descricao', 'Serviço', 'Atividade', 'DESCRIÇÃO', 'Defeito', 'Problema', 'SERVIÇO']) || 'Importação via Planilha',
          motivo: this.getVal(row, ['motivo', 'Motivo', 'Causa', 'MOTIVO']),
          sistema: this.getVal(row, ['sistema', 'Sistema', 'SISTEMA']),
          sub_sistema: this.getVal(row, ['sub_sistema', 'Sub-Sistema', 'Subsistema', 'SUB-SISTEMA', 'Sub-Sistem', 'SUB-SISTEM']),
          horas_manutencao: this.parseFloatSafe(this.getVal(row, ['horas_manutencao', 'Horas', 'Tempo', 'Horas Manut', 'H. Manut', 'HORAS', 'DURAÇÃO'])),
          horario_parada: this.parsePossibleDate(this.getVal(row, ['horario_parada', 'Horário Parada', 'Parada', 'Hora Parada', 'Data Parada', 'HORA PARADA', 'DATA PARADA'])),
          horas_reserva_chegou: this.parsePossibleDate(this.getVal(row, ['horas_reserva_chegou', 'Reserva Chegou', 'Data Reserva', 'Chegada Reserva'])),
          observacoes: this.getVal(row, ['observacoes', 'Observações', 'Observacoes', 'Notas', 'OBSERVAÇÕES', 'OBS', 'Obs']),
        };

        const parsed = OSSchema.safeParse(raw);
        if (parsed.success) {
          inserts.push(parsed.data as OSInsert);
        } else {
          console.warn('[IMPORT] Linha rejeitada:', parsed.error.flatten().fieldErrors, '| placa:', raw.placa);
        }
      } catch (err) {
        console.error('Erro ao processar linha:', err);
      }
    }

    if (inserts.length === 0) {
      console.error('Colunas detectadas:', Object.keys(rows[0]));
      throw new Error('Nenhuma OS válida encontrada. Verifique se as colunas da planilha correspondem aos campos esperados.');
    }

    const { error: insError } = await OSRepository.create(inserts);
    if (insError) throw new Error(insError.message);

    return { 
      success: true, 
      count: inserts.length,
      semCadastro: missingPlates.size,
      placasNaoCadastradas: Array.from(missingPlates),
    };
  }

  private static parsePossibleDate(d?: any) {
    if (!d) return null;
    if (typeof d === 'number' && d > 20000 && d < 100000) {
      const jsDate = new Date(Math.round((d - 25569) * 86400 * 1000));
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${jsDate.getUTCFullYear()}-${pad(jsDate.getUTCMonth() + 1)}-${pad(jsDate.getUTCDate())}T${pad(jsDate.getUTCHours())}:${pad(jsDate.getUTCMinutes())}`;
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
    if (!isNaN(dt.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    }
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
