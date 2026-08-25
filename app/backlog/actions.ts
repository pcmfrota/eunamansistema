'use server'

import { BacklogService } from '@/src/services/BacklogService';
import { BacklogRepository } from '@/src/repositories/BacklogRepository';
import { OSService } from '@/src/services/OSService';
import { OSRepository } from '@/src/repositories/OSRepository';
import { OSInsert } from '@/src/models/os';
import { getCurrentLocalDatetime } from '@/src/utils/dateUtils';
import { revalidatePath } from 'next/cache';
import { getUserFilial } from '@/utils/filial';
import { registrarExclusao } from '@/lib/audit-log';
import { GoogleGenAI, Type, ApiError } from '@google/genai';
import { z } from 'zod';

export async function getBacklog(limit: number = 5000) {
  try {
    const data = await BacklogService.getAll(limit);
    return { data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function upsertBacklogItem(item: any) {
  try {
    const { data } = await BacklogService.upsert(item);
    revalidatePath('/backlog');
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteBacklogItems(ids: string[]) {
  try {
    await BacklogService.deleteBulk(ids);
    revalidatePath('/backlog');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function importarBacklog(rows: any[]) {
  try {
    const result = await BacklogService.import(rows);
    revalidatePath('/backlog');
    return result;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function encerrarBacklogs(ids: string[], osNumero: string, dataConclusao: string) {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('backlog')
      .update({
        status: 'ENCERRADO',
        os: osNumero,
        data_conclusao: dataConclusao
      })
      .in('id', ids)
      .select();
      
    if (error) throw new Error(error.message);
    revalidatePath('/backlog');
    revalidatePath('/os');
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ── Gerar O.S. a partir de itens de Backlog selecionados ────────────────────
// Fluxo inverso ao de `encerrarBacklogs`: em vez de vincular o backlog a uma OS
// já existente, aqui a OS nasce a partir dos itens de backlog escolhidos.

export async function gerarOSDeBacklog(ids: string[]) {
  try {
    if (!ids || ids.length === 0) return { error: 'Nenhum item selecionado.' };

    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();

    const { data: backlogItems, error: fetchError } = await supabase
      .from('backlog')
      .select('*')
      .in('id', ids);
    if (fetchError) throw new Error(fetchError.message);

    const usaveis = (backlogItems || []).filter(item => {
      const st = String(item.status || '').toUpperCase().trim();
      return st !== 'ENCERRADO' && st !== 'CONCLUIDO' && st !== 'CONCLUÍDO' && st !== 'ENCERRADA';
    });
    if (usaveis.length === 0) {
      return { error: 'Os itens selecionados já estão encerrados.' };
    }

    const placas = new Set(usaveis.map(i => String(i.frota || '').toUpperCase().trim()).filter(Boolean));
    if (placas.size === 0) {
      return { error: 'Os itens selecionados não têm placa/frota definida.' };
    }
    if (placas.size > 1) {
      return { error: 'Selecione itens de uma única placa para gerar a O.S.' };
    }
    const placa = Array.from(placas)[0];

    const { data: equipamentos, error: eqError } = await OSRepository.getEquipamentos();
    if (eqError) throw new Error(eqError.message);
    const equipamento = (equipamentos || []).find((e: any) => String(e.placa || '').toUpperCase().trim() === placa);
    if (!equipamento) {
      return { error: `A placa ${placa} não está cadastrada em Equipamentos.` };
    }

    const descricao = usaveis
      .map(i => String(i.descricao || '').trim().replace(/\.+$/, ''))
      .filter(Boolean)
      .join('. ') + '.';

    // Determina o cargo e a filial do usuário autenticado no servidor
    const { data: { user } } = await supabase.auth.getUser();
    let userRole = 'visitante';
    let filialId = 'MATRIZ';
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, filial_id')
        .eq('id', user.id)
        .single();
      if (profile) {
        userRole = profile.role;
        filialId = profile.filial_id || 'MATRIZ';
      }
    }

    const payload: OSInsert = {
      numero_os: OSService.generateOSNumber(),
      equipamento_id: equipamento.id,
      placa,
      modulo: equipamento.modulo || usaveis[0].modulo || null,
      status: 'Aberta',
      data_abertura: getCurrentLocalDatetime(),
      classe: 'CORRETIVA',
      foi_enviado_reserva: false,
      descricao,
      aprovado: userRole !== 'mecanico',
    } as OSInsert;
    ;(payload as any).filial_id = filialId;

    const result = await OSService.createOS(payload);
    if (!result.success || !result.data) {
      return { error: 'Falha ao criar a Ordem de Serviço.' };
    }

    const idsUsados = usaveis.map(i => i.id);
    const { error: linkError } = await supabase
      .from('backlog')
      .update({ status: 'PROGRAMADO', os: result.data.numero_os })
      .in('id', idsUsados);
    if (linkError) throw new Error(linkError.message);

    revalidatePath('/backlog');
    revalidatePath('/os');
    return { success: true, data: result.data };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ── Lançar Backlog via print/mensagem do WhatsApp (IA) ───────────────────────
// Fluxo: usuário cola um print + o texto da mensagem -> IA extrai as pendências
// por placa -> tela de revisão editável no client -> confirma -> insere em massa.

const ItemExtraidoSchema = z.object({
  placa: z.string().nullable(),
  placa_detectada_bruta: z.string().nullable(),
  descricao: z.string(),
  criticidade: z.enum(['A', 'B']),
});
const ExtracaoBacklogSchema = z.object({ itens: z.array(ItemExtraidoSchema) });

export type ItemBacklogExtraido = z.infer<typeof ItemExtraidoSchema>;

export async function extrairPendenciasBacklogIA(imagemBase64: string | null, textoColado: string) {
  try {
    if (!imagemBase64 && !(textoColado || '').trim()) {
      return { error: 'Cole a imagem e/ou o texto da mensagem antes de analisar.' };
    }
    if (!process.env.GEMINI_API_KEY) {
      return { error: 'GEMINI_API_KEY não configurada no servidor. Configure a chave da IA (gratuita em aistudio.google.com/apikey) antes de usar este recurso.' };
    }

    const { data: equipamentos, error: eqError } = await OSRepository.getEquipamentos();
    if (eqError) throw new Error(eqError.message);
    const placasValidas = Array.from(new Set(
      (equipamentos || []).map((e: any) => String(e.placa || '').toUpperCase().trim()).filter(Boolean)
    ));

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (imagemBase64) {
      const match = /^data:(image\/\w+);base64,(.+)$/.exec(imagemBase64);
      parts.push({
        inlineData: {
          mimeType: match ? match[1] : 'image/jpeg',
          data: match ? match[2] : imagemBase64,
        },
      });
    }
    parts.push({
      text: [
        textoColado?.trim() ? `Mensagem colada:\n${textoColado.trim()}` : null,
        'Extraia cada pendência de manutenção mencionada (uma por linha/bullet/❌), agrupando por placa.',
      ].filter(Boolean).join('\n\n'),
    });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: `Você extrai pendências de manutenção de frota a partir de prints/mensagens de WhatsApp.

Placas cadastradas no sistema (use um valor EXATAMENTE igual a um destes em "placa" apenas quando tiver certeza da correspondência com o que foi lido/mencionado; senão deixe "placa" como null e preencha "placa_detectada_bruta" com o texto bruto que você identificou):
${placasValidas.join(', ') || '(nenhuma placa cadastrada)'}

Regras:
- Uma pendência por item/linha/bullet (cada "❌", "·" ou item de lista é uma pendência separada).
- Não invente pendência que não esteja no texto/imagem enviada.
- "criticidade": use "A" apenas se houver indicação explícita de urgência/gravidade (interdição, risco, parada total); use "B" nos demais casos.
- "descricao": texto da pendência, resumido e em maiúsculas, sem repetir o nome da placa.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            itens: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  placa: { type: Type.STRING, nullable: true },
                  placa_detectada_bruta: { type: Type.STRING, nullable: true },
                  descricao: { type: Type.STRING },
                  criticidade: { type: Type.STRING, enum: ['A', 'B'] },
                },
                required: ['descricao', 'criticidade'],
              },
            },
          },
          required: ['itens'],
        },
      },
    });

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(response.text ?? '');
    } catch {
      return { error: 'Não foi possível interpretar a resposta da IA. Tente novamente.' };
    }

    const validated = ExtracaoBacklogSchema.safeParse(parsedJson);
    if (!validated.success) {
      return { error: 'A IA devolveu um formato inesperado. Tente novamente.' };
    }

    const validas = new Set(placasValidas);
    const itens = validated.data.itens.map(item => {
      const placaNormalizada = String(item.placa || '').toUpperCase().trim();
      return { ...item, placa: validas.has(placaNormalizada) ? placaNormalizada : null };
    });

    return { success: true, itens, placasDisponiveis: placasValidas };
  } catch (error: any) {
    if (error instanceof ApiError) {
      if (error.status === 400 || error.status === 403) {
        return { error: 'Chave de IA inválida. Verifique a GEMINI_API_KEY configurada.' };
      }
      if (error.status === 429) {
        return { error: 'Limite de uso gratuito da IA atingido. Tente novamente em alguns minutos.' };
      }
      return { error: `Erro na IA: ${error.message}` };
    }
    return { error: error.message };
  }
}

export async function lancarBacklogsExtraidos(itens: ItemBacklogExtraido[], imagemBase64: string | null) {
  try {
    if (!itens || itens.length === 0) return { error: 'Nenhum item para lançar.' };

    const validos = itens.filter(i => i.placa && String(i.placa).trim() && String(i.descricao || '').trim());
    if (validos.length === 0) return { error: 'Nenhum item válido — confira a placa e a descrição de cada item.' };

    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();

    const { data: equipamentos, error: eqError } = await OSRepository.getEquipamentos();
    if (eqError) throw new Error(eqError.message);
    const moduloPorPlaca = new Map(
      (equipamentos || []).map((e: any) => [String(e.placa || '').toUpperCase().trim(), e.modulo || null])
    );

    const { data: { user } } = await supabase.auth.getUser();
    let colaborador: string | null = null;
    let filialId = 'MATRIZ';
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('full_name, filial_id').eq('id', user.id).maybeSingle();
      if (profile) {
        colaborador = profile.full_name || null;
        filialId = profile.filial_id || 'MATRIZ';
      }
    }

    const agora = getCurrentLocalDatetime();
    const rows = validos.map(item => {
      const placa = String(item.placa).toUpperCase().trim();
      return {
        frota: placa,
        modulo: moduloPorPlaca.get(placa) || null,
        descricao: String(item.descricao).trim(),
        criticidade: item.criticidade === 'A' ? 'A' : 'B',
        status: 'PENDENTE',
        data_evidencia: agora,
        origem: 'IA_WHATSAPP',
        colaborador,
        evidencia_imagem: imagemBase64 || null,
        filial_id: filialId,
      };
    });

    const { error } = await BacklogRepository.insertMany(rows as any);
    if (error) throw new Error(error.message);

    revalidatePath('/backlog');
    return { success: true, count: rows.length };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ── Solicitações de Exclusão de Backlog ─────────────────────────────────────
// Usuários não-administradores não excluem diretamente: eles criam uma solicitação
// (com motivo) que fica pendente até o administrador aprovar ou rejeitar.

export async function solicitarExclusaoBacklog(ids: string[], motivo: string) {
  try {
    if (!ids || ids.length === 0) return { error: 'Nenhum item selecionado.' };
    const motivoTrim = (motivo || '').trim();
    if (!motivoTrim) return { error: 'Informe o motivo da solicitação de exclusão.' };

    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Não autenticado.' };

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const solicitanteNome = profile?.full_name || user.email || 'Usuário';

    const { data: backlogItems, error: fetchError } = await supabase
      .from('backlog')
      .select('id, frota, modulo, criticidade, status, descricao, data_evidencia, tag')
      .in('id', ids);
    if (fetchError) throw new Error(fetchError.message);
    if (!backlogItems || backlogItems.length === 0) {
      return { error: 'Nenhum item válido encontrado para solicitar exclusão.' };
    }

    // Evita solicitações duplicadas para itens que já têm uma solicitação pendente
    const { data: existentes } = await supabase
      .from('backlog_delete_requests')
      .select('backlog_id')
      .eq('status', 'PENDENTE')
      .in('backlog_id', ids);
    const idsComPendencia = new Set((existentes || []).map((r: any) => r.backlog_id));
    const itensParaSolicitar = backlogItems.filter(item => !idsComPendencia.has(item.id));

    if (itensParaSolicitar.length === 0) {
      return { error: 'Este(s) item(ns) já possui(em) uma solicitação de exclusão pendente.' };
    }

    const rows = itensParaSolicitar.map(item => ({
      backlog_id: item.id,
      backlog_frota: item.frota,
      backlog_modulo: item.modulo,
      backlog_criticidade: item.criticidade,
      backlog_status: item.status,
      backlog_descricao: item.descricao,
      backlog_data_evidencia: item.data_evidencia,
      backlog_tag: item.tag,
      motivo: motivoTrim,
      solicitado_por: user.id,
      solicitado_por_nome: solicitanteNome,
    }));

    const { error } = await supabase.from('backlog_delete_requests').insert(rows);
    if (error) throw new Error(error.message);

    revalidatePath('/backlog');
    return { success: true, count: rows.length };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getSolicitacoesExclusaoBacklog() {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();

    const { data, error } = await supabase
      .from('backlog_delete_requests')
      .select('*')
      .order('solicitado_em', { ascending: false });
    if (error) throw new Error(error.message);
    return { data: data || [] };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function responderSolicitacaoExclusao(requestId: string, aprovado: boolean) {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Não autenticado.' };

    const { isAdmin } = await getUserFilial(supabase);
    if (!isAdmin) {
      return { error: 'Apenas o administrador pode aprovar ou rejeitar solicitações de exclusão.' };
    }

    const { data: request, error: fetchError } = await supabase
      .from('backlog_delete_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    if (!request) return { error: 'Solicitação não encontrada.' };
    if (request.status !== 'PENDENTE') return { error: 'Esta solicitação já foi respondida.' };

    // Atualiza o status primeiro: se aprovado, a exclusão do backlog em seguida
    // não pode apagar o rastro da solicitação (backlog_id vira NULL via ON DELETE SET NULL).
    const { error: updateError } = await supabase
      .from('backlog_delete_requests')
      .update({
        status: aprovado ? 'APROVADO' : 'REJEITADO',
        respondido_por: user.id,
        respondido_em: new Date().toISOString(),
      })
      .eq('id', requestId);
    if (updateError) throw new Error(updateError.message);

    if (aprovado && request.backlog_id) {
      const { error: deleteError } = await supabase.from('backlog').delete().eq('id', request.backlog_id);
      if (deleteError) throw new Error(deleteError.message);

      await registrarExclusao({
        supabase,
        modulo: 'Backlog',
        tabelaOrigem: 'backlog',
        registroId: request.backlog_id,
        descricao: `${request.backlog_frota || 'S/ FROTA'} — ${request.backlog_descricao || ''}`,
        dados: request,
        origem: 'SOLICITACAO_APROVADA',
      });
    }

    revalidatePath('/backlog');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function syncRolePermissions() {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();
    
    const { data: permissionsList, error: getError } = await supabase
      .from('role_permissions')
      .select('role, allowed_tabs');
      
    if (getError) throw new Error(getError.message);
    
    if (permissionsList && permissionsList.length > 0) {
      for (const row of permissionsList) {
        let changed = false;
        const tabs = row.allowed_tabs || [];
        
        if (['admin', 'pcm', 'gestao', 'mecanico'].includes(row.role)) {
          if (!tabs.includes('/afiacao')) {
            tabs.push('/afiacao');
            changed = true;
          }
        }
        
        if (['admin', 'pcm', 'gestao', 'mecanico', 'motorista'].includes(row.role)) {
          if (!tabs.includes('/captacao')) {
            tabs.push('/captacao');
            changed = true;
          }
          if (!tabs.includes('/documentos')) {
            tabs.push('/documentos');
            changed = true;
          }
        }
        
        if (['admin', 'pcm', 'gestao', 'mecanico'].includes(row.role)) {
          if (!tabs.includes('/checklist-mecanicos')) {
            tabs.push('/checklist-mecanicos');
            changed = true;
          }
        }
        
        if (changed) {
          await supabase
            .from('role_permissions')
            .update({ allowed_tabs: tabs })
            .eq('role', row.role);
        }
      }
    }
    
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao sincronizar permissões:", error);
    return { error: error.message };
  }
}

