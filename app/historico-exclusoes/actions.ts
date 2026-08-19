'use server'

import { getUserFilial } from '@/utils/filial';

export async function getHistoricoExclusoes(limit: number = 1000) {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Não autenticado.' };

    const { isAdmin } = await getUserFilial(supabase);
    if (!isAdmin) return { error: 'Apenas o administrador pode ver o histórico de exclusões.' };

    const { data, error } = await supabase
      .from('historico_exclusoes')
      .select('*')
      .order('excluido_em', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return { data: data || [] };
  } catch (error: any) {
    return { error: error.message };
  }
}
