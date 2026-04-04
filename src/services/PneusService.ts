import { PneusRepository } from '../repositories/PneusRepository';
import { EquipamentoRepository } from '../repositories/EquipamentoRepository';
import { InspecaoPneuInsert, InspecaoPneuUpdate, CondicaoPneu } from '../models/pneus';

export class PneusService {
  static async getAll() {
    const { data, error } = await PneusRepository.list();
    if (error) throw new Error(error.message);
    return data;
  }

  static async create(data: InspecaoPneuInsert) {
    if (!data.equipamento_id || !data.data_inspecao) {
      throw new Error('Equipamento e Data são obrigatórios');
    }

    const { error } = await PneusRepository.create(data);
    if (error) throw new Error(error.message);
    
    // Sync equipment horimetro/km if applicable
    if (data.km_atual) {
      await EquipamentoRepository.update(data.equipamento_id, { ultimoHist: data.km_atual });
    }

    return { success: true };
  }

  static async update(id: string, data: InspecaoPneuUpdate) {
    const { error } = await PneusRepository.update(id, data);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async delete(id: string) {
    const { error } = await PneusRepository.delete(id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async deleteBulk(ids: string[]) {
    const { error } = await PneusRepository.deleteMany(ids);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async import(rows: any[]) {
    const { data: eqs } = await EquipamentoRepository.list();
    const eqMap: Record<string, { id: string; ultimoHist: number | null }> = {};
    for (const e of eqs || []) eqMap[e.placa.toUpperCase()] = { id: e.id, ultimoHist: e.ultimoHist };

    const inserts: InspecaoPneuInsert[] = [];
    const eqUpdates: Record<string, number> = {};
    const errors: string[] = [];

    for (const row of rows) {
      const placaRaw = this.getVal(row, ['placa', 'Equipamento', 'Veículo', 'Máquina', 'Placa']) || '';
      const placaUpper = String(placaRaw).toUpperCase().trim();
      const eq = eqMap[placaUpper];

      if (!eq) {
        errors.push(`Placa não encontrada: ${placaRaw}`);
        continue;
      }

      const data_inspecao = this.parsePossibleDate(this.getVal(row, ['data_inspecao', 'Data', 'Data Inspeção', 'Dia']));
      if (!data_inspecao) {
        errors.push(`Data inválida para ${placaRaw}`);
        continue;
      }

      const km_atual = this.parseFloatSafe(this.getVal(row, ['km_atual', 'KM', 'Horímetro', 'KM Atual', 'Hori']));
      if (km_atual && (!eq.ultimoHist || km_atual > eq.ultimoHist)) {
        if (!eqUpdates[eq.id] || km_atual > eqUpdates[eq.id]) {
          eqUpdates[eq.id] = km_atual;
        }
      }

      const posicoes: any = {};
      const posAliases: Record<string, string[]> = {
        de: ['de', 'DIANTEIRO ESQUERDO', 'DIANTEIRO ESQ', 'DE'],
        dd: ['dd', 'DIANTEIRO DIREITO', 'DIANTEIRO DIR', 'DD'],
        tei: ['tei', 'TRASEIRO ESQ INTERNO', 'TEI'],
        tee: ['tee', 'TRASEIRO ESQ EXTERNO', 'TEE'],
        tdi: ['tdi', 'TRASEIRO DIR INTERNO', 'TDI'],
        tde: ['tde', 'TRASEIRO DIR EXTERNO', 'TDE'],
        tei1: ['tei1', 'TRASEIRO ESQ INTERNO 2', 'TEI1'],
        tee1: ['tee1', 'TRASEIRO ESQ EXTERNO 2', 'TEE1'],
        tdi1: ['tdi1', 'TRASEIRO DIR INTERNO 2', 'TDI1'],
        tde1: ['tde1', 'TRASEIRO DIR EXTERNO 2', 'TDE1'],
        estepe: ['estepe', 'ESTEPE', 'RESERVA']
      };

      for (const [pos, aliases] of Object.entries(posAliases)) {
        posicoes[pos] = this.parseFloatSafe(this.getVal(row, aliases));
      }

      const condicaoFallback = this.calcCondicao(posicoes);
      const condicao = this.sanitizeCondicao(this.getVal(row, ['condicao', 'Condição', 'Status']), condicaoFallback);

      inserts.push({
        equipamento_id: eq.id,
        data_inspecao,
        km_atual,
        observacoes: this.getVal(row, ['observacoes', 'Observações', 'Notas']),
        condicao,
        ...posicoes,
      });
    }

    if (inserts.length === 0) throw new Error(errors.join(', ') || 'Nenhuma linha válida para importar');

    // Chunks of 50
    const CHUNK = 50;
    for (let i = 0; i < inserts.length; i += CHUNK) {
      const chunk = inserts.slice(i, i + CHUNK);
      const { error } = await PneusRepository.createMany(chunk);
      if (error) throw new Error(`Erro no lote ${Math.floor(i / CHUNK) + 1}: ${error.message}`);
    }

    // Sync equipment
    for (const [id, val] of Object.entries(eqUpdates)) {
      await EquipamentoRepository.update(id, { ultimoHist: val });
    }

    return { success: true, importados: inserts.length, erros: errors };
  }

  // --- Logic Helpers ---

  static calcCondicao(posicoes: Record<string, number | null>): CondicaoPneu {
    const vals = Object.values(posicoes).filter(v => v != null) as number[];
    if (!vals.length) return 'BOM';
    const min = Math.min(...vals);
    if (min < 3) return 'TROCAR';
    if (min < 5) return 'CRITICO';
    if (min < 9) return 'REGULAR';
    return 'BOM';
  }

  static sanitizeCondicao(raw: string | null | undefined, fallback: CondicaoPneu): CondicaoPneu {
    if (!raw || !raw.trim()) return fallback;
    const clean = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    const map: Record<string, CondicaoPneu> = {
      BOM: 'BOM', BOA: 'BOM', GOOD: 'BOM', OK: 'BOM', OTIMO: 'BOM', EXCELENTE: 'BOM', NOVO: 'BOM',
      REGULAR: 'REGULAR', REG: 'REGULAR', ATENCAO: 'REGULAR', WATCH: 'REGULAR', MODERADO: 'REGULAR',
      CRITICO: 'CRITICO', CRITICA: 'CRITICO', CRITICAL: 'CRITICO', URGENTE: 'CRITICO', ALERTA: 'CRITICO',
      TROCAR: 'TROCAR', REPLACE: 'TROCAR', SUBSTITUIR: 'TROCAR', RUIM: 'TROCAR', MAU: 'TROCAR',
      DESGASTADO: 'TROCAR', SUCATA: 'TROCAR',
    };
    return map[clean] ?? fallback;
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
}
