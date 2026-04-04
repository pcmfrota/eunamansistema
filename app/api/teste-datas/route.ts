import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase.from('preventivas').select('*').order('created_at', { ascending: false }).limit(5);
  
  if (error) {
    return NextResponse.json({ error: error.message });
  }
  
  return NextResponse.json({ data });
}
