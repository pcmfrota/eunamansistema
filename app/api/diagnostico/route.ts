import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    // 1. Fetch equipments
    const { data: equips, error: eqError } = await supabase
      .from('equipamentos')
      .select('*');
      
    if (eqError) throw eqError;

    // 2. Fetch OSs
    const { data: osList, error: osError } = await supabase
      .from('ordens_servico')
      .select('*');

    if (osError) throw osError;

    // 3. Analyze
    const analysis: any = {
      timestamp: new Date().toISOString(),
      equipmentsCount: equips.length,
      osCount: osList.length,
      equipments_by_tipo: {},
      os_by_placa: {},
      os_unmatched_plates: [],
      os_without_placa_or_equip_id: [],
      equips_sample: equips.map(e => ({ id: e.id, placa: e.placa, tipo: e.tipo, categoria: e.categoria }))
    };

    equips.forEach(e => {
      const t = e.tipo || 'NULL';
      analysis.equipments_by_tipo[t] = (analysis.equipments_by_tipo[t] || 0) + 1;
    });

    const equipPlates = new Set(equips.map(e => (e.placa || '').toUpperCase().trim()));
    const equipIds = new Set(equips.map(e => e.id));

    osList.forEach(os => {
      const p = (os.placa || '').toUpperCase().trim();
      if (p) {
        analysis.os_by_placa[p] = (analysis.os_by_placa[p] || 0) + 1;
      }
      
      const hasPlaca = !!p;
      const hasEquipId = !!os.equipamento_id;
      
      if (!hasPlaca && !hasEquipId) {
        analysis.os_without_placa_or_equip_id.push(os);
      } else {
        const matchesPlaca = hasPlaca && equipPlates.has(p);
        const matchesEquipId = hasEquipId && equipIds.has(os.equipamento_id);
        
        if (!matchesPlaca && !matchesEquipId) {
          analysis.os_unmatched_plates.push({
            id: os.id,
            numero_os: os.numero_os,
            placa: os.placa,
            equipamento_id: os.equipamento_id,
            descricao: os.descricao
          });
        }
      }
    });

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir);
    }
    fs.writeFileSync(path.join(tmpDir, 'db_dump_analysis.json'), JSON.stringify(analysis, null, 2), 'utf-8');
    
    // Dump actual OSs
    fs.writeFileSync(path.join(tmpDir, 'debug_os_dates.json'), JSON.stringify(osList.slice(0, 50), null, 2), 'utf-8');

    return NextResponse.json({ success: true, analysis, osSample: osList.slice(0, 10) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}

