// utils/filial.ts
// Utilitário central para gestão de filiais no servidor e cliente

import { SupabaseClient } from '@supabase/supabase-js'

// ── Configuração das Filiais ───────────────────────────────────────────────────
export const FILIAIS_CONFIG = [
  { id: 'MATRIZ',         nome: 'Matriz',                cor: '#16a34a', emoji: '🏢' },
  { id: 'MALUT_SERVICOS', nome: 'Filial Malut/serviços',  cor: '#2563eb', emoji: '🏭' },
  { id: 'MALUT_LOCALIZA', nome: 'Filial Malut/localiza',  cor: '#7c3aed', emoji: '🏭' },
  { id: 'MALUT_PNEUS',    nome: 'Filial Malut Pneus',     cor: '#dc2626', emoji: '🔧' },
] as const

export type FilialId = typeof FILIAIS_CONFIG[number]['id'] | 'TODAS'

export function getFilialNome(filialId: string): string {
  if (filialId === 'TODAS') return 'TODAS AS FILIAIS'
  return FILIAIS_CONFIG.find(f => f.id === filialId)?.nome ?? filialId
}

export function getFilialCor(filialId: string): string {
  return FILIAIS_CONFIG.find(f => f.id === filialId)?.cor ?? '#6b7280'
}

// ── Tipo do contexto de filial do usuário ────────────────────────────────────
export type UserFilialContext = {
  filialId: string
  filialNome: string
  isAdmin: boolean
  /** true se o admin optou por ver "TODAS" as filiais no dashboard */
  verTodasFiliais: boolean
}

// ── Busca filial e role do usuário autenticado (Server-side) ─────────────────
export async function getUserFilial(supabase: SupabaseClient): Promise<UserFilialContext> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { filialId: 'MATRIZ', filialNome: 'MATRIZ', isAdmin: false, verTodasFiliais: false }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, filial_id')
      .eq('id', user.id)
      .single()

    const filialId = profile?.filial_id ?? 'MATRIZ'
    const isAdmin = profile?.role === 'admin'

    return {
      filialId,
      filialNome: getFilialNome(filialId),
      isAdmin,
      // Admin começa vendo todas as filiais (pode mudar via filtro no dashboard)
      verTodasFiliais: isAdmin,
    }
  } catch {
    return { filialId: 'MATRIZ', filialNome: 'MATRIZ', isAdmin: false, verTodasFiliais: false }
  }
}

// ── Aplica filtro de filial em uma query Supabase ────────────────────────────
// Uso: let q = supabase.from('tabela').select('*')
//      q = applyFilialFilter(q, ctx, filialOverride)
export function applyFilialFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  ctx: UserFilialContext,
  /** Filial explicitamente selecionada pelo admin (undefined = usa a do usuário) */
  filialOverride?: string
): T {
  const filialAlvo = filialOverride && filialOverride !== 'TODAS'
    ? filialOverride
    : ctx.filialId

  // Admin sem override = vê tudo (RLS cuidará no banco, mas evitamos filtro extra)
  if (ctx.isAdmin && (!filialOverride || filialOverride === 'TODAS')) {
    return query
  }

  return query.eq('filial_id', filialAlvo)
}
