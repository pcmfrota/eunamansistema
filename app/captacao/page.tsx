import { createClient } from '@/utils/supabase/server';
import CaptacaoClient from './CaptacaoClient';

export default async function CaptacaoPage() {
  const supabase = createClient();

  // Load all required data in parallel to avoid backend waterfalls
  const [fichasRes, eqRes, colabRes, calRes] = await Promise.all([
    supabase
      .from('fichas_captacao')
      .select('*, lancamentos:lancamentos_captacao(*)')
      .order('created_at', { ascending: false }),
    supabase
      .from('equipamentos')
      .select('id, placa, status')
      .or("status.is.null,status.neq.Inativo,status.neq.INATIVO")
      .order('placa'),
    supabase
      .from('colaboradores')
      .select('id, nome')
      .order('nome'),
    supabase
      .from('calendario_suzano')
      .select('*')
      .order('ano', { ascending: false })
      .order('mes', { ascending: true })
  ]);

  const fichas = fichasRes.data || [];
  const equipamentos = eqRes.data || [];
  const colaboradores = colabRes.data || [];
  const calendario = calRes.data || [];

  return (
    <CaptacaoClient
      initialFichas={fichas}
      equipamentos={equipamentos}
      colaboradores={colaboradores}
      calendario={calendario}
    />
  );
}
