import { OSRepository } from '../repositories/OSRepository';
import { OSInsert, OSUpdate } from '../models/os';

export class OSService {
  static formatDateTime(date: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  static generateOSNumber(): string {
    return `OS-${Date.now()}`;
  }

  static async createOS(data: OSInsert) {
    if (!data.equipamento_id || !data.status || !data.data_abertura) {
      throw new Error('Preencha os campos obrigatórios (Placa, Status, Data Inicial)');
    }

    if (!data.numero_os) {
      data.numero_os = this.generateOSNumber();
    }

    const { error } = await OSRepository.create(data);
    if (error) throw new Error(error.message);
    
    return { success: true };
  }

  static async updateOS(id: string, data: OSUpdate) {
    if (data.status === 'Fechada' || data.status === 'Concluída') {
      data.data_fechamento = this.formatDateTime();
      data.status = 'Fechada';
    }

    const { error } = await OSRepository.update(id, data);
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
      const placaRaw = this.getVal(row, ['placa', 'Equipamento', 'Veículo', 'Máquina', 'Placa']) || '';
      let placaUpper = String(placaRaw).toUpperCase().trim();
      const eq = eqMap[placaUpper];

      const horimetro = this.parseFloatSafe(this.getVal(row, ['horimetro', 'Horímetro', 'KM', 'Hori']));
      
      if (eq && horimetro && (!eq.ultimoHist || horimetro > eq.ultimoHist)) {
        if (!eqUpdates[eq.id] || horimetro > eqUpdates[eq.id]) {
          eqUpdates[eq.id] = horimetro;
        }
      }

      inserts.push({
        numero_os: `${this.generateOSNumber()}-${Math.floor(Math.random() * 1000)}`,
        equipamento_id: eq ? eq.id : '',
        placa: eq ? placaUpper : 'EQUIPAMENTO_NAO_ENCONTRADO',
        modulo: eq ? eq.modulo : (this.getVal(row, ['modulo', 'Módulo']) || null),
        status: this.getVal(row, ['status', 'Situação', 'Estado']) || 'Aberta',
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
      });
    }

    const { error: insError } = await OSRepository.create(inserts as any); // Using any for bulk insert support check
    if (insError) throw new Error(insError.message);

    for (const [id, value] of Object.entries(eqUpdates)) {
      await OSRepository.updateEquipamentoHorimetro(id, value);
    }

    return { success: true };
  }

  // --- Internals copied for refactoring (Service is responsible for this logic) ---
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
