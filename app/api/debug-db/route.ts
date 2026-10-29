
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Rota de debug que consulta o banco ao vivo — nunca deve ser pré-renderizada
// estaticamente no build (se o Supabase estiver fora do ar na hora do build, isso trava
// e derruba o build inteiro, mesmo sem relação nenhuma com o que mudou no código).
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: os, error: osErr } = await supabase
      .from('ordens_servico')
      .select('*')
      .limit(10);

    const { count: totalOs } = await supabase
      .from('ordens_servico')
      .select('*', { count: 'exact', head: true });

    const { data: eq } = await supabase
      .from('equipamentos')
      .select('placa, categoria')
      .limit(5);

    return NextResponse.json({
      success: true,
      totalOs,
      sampleOs: os,
      sampleEq: eq,
      error: osErr?.message,
      now: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
