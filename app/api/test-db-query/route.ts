import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// Rota de teste que consulta o banco ao vivo — nunca deve ser pré-renderizada
// estaticamente no build (se o Supabase estiver fora do ar na hora do build, isso trava
// e derruba o build inteiro, mesmo sem relação nenhuma com o que mudou no código).
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const res = await supabase.from('equipamentos')
    .select('id, placa, tipo, categoria, modulo, modelo, status, area, created_at, deleted_at')
    .limit(5);

  return NextResponse.json({
    error: res.error ? res.error.message : null,
    details: res.error,
    data: res.data
  });
}
