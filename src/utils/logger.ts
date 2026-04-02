import { createClient } from '@/utils/supabase/server';

export interface LogEntry {
  usuario_id?: string;
  email?: string;
  acao: string;
  modulo: string;
  detalhes?: any;
  ip?: string;
  endpoint?: string;
  nivel: 'INFO' | 'AVISO' | 'ERRO';
}

export class Logger {
  static async log(entry: LogEntry) {
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const payload = {
      ...entry,
      usuario_id: entry.usuario_id || user?.id,
      email: entry.email || user?.email,
      data: new Date().toISOString(),
    };

    // We try to insert into 'sistema_logs'. 
    // If table doesn't exist, this fails silently or can be logged to console in dev.
    const { error } = await supabase.from('sistema_logs').insert(payload);
    
    if (error) {
      console.error('Falha ao registrar log no banco:', error.message);
      // Fallback to console for critical visibility
      console.log(`[${entry.nivel}] ${entry.modulo} - ${entry.acao}:`, entry.detalhes);
    }
  }

  static async info(modulo: string, acao: string, detalhes?: any) {
    return this.log({ nivel: 'INFO', modulo, acao, detalhes });
  }

  static async warning(modulo: string, acao: string, detalhes?: any) {
    return this.log({ nivel: 'AVISO', modulo, acao, detalhes });
  }

  static async error(modulo: string, acao: string, detalhes?: any) {
    return this.log({ nivel: 'ERRO', modulo, acao, detalhes });
  }
}
