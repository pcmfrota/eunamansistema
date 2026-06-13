import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

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
