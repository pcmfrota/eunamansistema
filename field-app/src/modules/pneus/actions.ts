// Cópia de app/pneus/actions.ts (app principal), convertida pra rodar sem servidor:
// - Removida a diretiva "use server" — vira um módulo comum, chamado direto do cliente.
// - PneusService importado da cópia local (field-app/src/services/PneusService.ts),
//   que por sua vez usa as cópias locais de PneusRepository/EquipamentoRepository
//   (único ponto real de mudança: client em vez de server do Supabase).
// - revalidatePath(...) removido: não existe cache de servidor pra invalidar aqui — a
//   tela já recarrega do IndexedDB local sozinha (ver PneusClient.tsx/PneusPage.tsx).
// - getUsuarioAtual() usa @/utils/supabase/client (mesmo client já autenticado no
//   app inteiro) em vez de @/utils/supabase/server.
import { PneusService } from "../../services/PneusService";
import { getCurrentLocalDate } from "@/src/utils/dateUtils";
import { createClient } from "@/utils/supabase/client";

const POSICOES = ['de','dd','tei','tee','tdi','tde','tei1','tee1','tdi1','tde1','estepe'] as const;
const CAMPOS_SULCO = POSICOES.flatMap(pos => [pos, `${pos}_s1`, `${pos}_s3`] as const);

function lerSulcosDoFormData(formData: FormData) {
  const posicoes: Record<string, number | null> = {};
  for (const campo of CAMPOS_SULCO) {
    const v = formData.get(campo);
    posicoes[campo] = v && v !== '' ? parseFloat(v as string) : null;
  }
  return posicoes;
}

async function getUsuarioAtual() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { registrado_por: null, registrado_por_nome: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  return {
    registrado_por: user.id,
    registrado_por_nome: profile?.full_name || user.email || 'Usuário',
  };
}

export async function registrarInspecaoPneu(formData: FormData) {
  try {
    const sulco_mm = parseFloat(formData.get('sulco_mm') as string);
    const posicoes: any = { [formData.get('eixo') as string]: sulco_mm };
    const condicao = PneusService.calcCondicao(posicoes);
    const usuario = await getUsuarioAtual();

    const data = {
      equipamento_id: formData.get('equipamento_id') as string,
      data_inspecao: getCurrentLocalDate(),
      km_atual: null,
      condicao,
      ...posicoes,
      ...usuario
    };

    await PneusService.create(data);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function importarInspecoesPneus(rows: any[]) {
  try {
    const usuario = await getUsuarioAtual();
    const result = await PneusService.import(rows, usuario);
    return result;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function registrarInspecaoCompleta(formData: FormData) {
  try {
    const posicoes = lerSulcosDoFormData(formData);

    const rawCondicao = formData.get('condicao') as string;
    const condicao = PneusService.sanitizeCondicao(rawCondicao, PneusService.calcCondicao(posicoes));
    const usuario = await getUsuarioAtual();

    const data = {
      equipamento_id: formData.get('equipamento_id') as string,
      data_inspecao: formData.get('data_inspecao')?.toString().split('T')[0] + 'T12:00:00',
      km_atual: formData.get('km_atual') ? parseFloat(formData.get('km_atual') as string) : null,
      horimetro_registro: formData.get('horimetro_registro') ? parseFloat(formData.get('horimetro_registro') as string) : null,
      observacoes: formData.get('observacoes') as string,
      condicao,
      ...posicoes,
      ...usuario
    };

    const res = await PneusService.create(data);
    return { success: true, data: res.data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function atualizarInspecao(id: string, formData: FormData) {
  try {
    const posicoes = lerSulcosDoFormData(formData);

    const rawCondicao = formData.get('condicao') as string;
    const condicao = PneusService.sanitizeCondicao(rawCondicao, PneusService.calcCondicao(posicoes));

    const data = {
      equipamento_id: formData.get('equipamento_id') as string,
      data_inspecao: formData.get('data_inspecao')?.toString().split('T')[0] + 'T12:00:00',
      km_atual: formData.get('km_atual') ? parseFloat(formData.get('km_atual') as string) : null,
      horimetro_registro: formData.get('horimetro_registro') ? parseFloat(formData.get('horimetro_registro') as string) : null,
      observacoes: formData.get('observacoes') as string,
      condicao,
      ...posicoes
    };

    const res = await PneusService.update(id, data);
    return { success: true, data: res.data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function excluirInspecao(id: string) {
  try {
    await PneusService.delete(id);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function excluirInspecoesMassivo(ids: string[]) {
  try {
    await PneusService.deleteBulk(ids);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
