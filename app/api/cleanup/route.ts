import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const placasParaExcluir = ['QWE-5555', 'QWE-5556', 'XYZ-3876', 'XYZ-9876'];

    const { data: eqs } = await supabase
      .from("equipamentos")
      .select("id, placa")
      .in("placa", placasParaExcluir);

    if (!eqs || eqs.length === 0) {
      return NextResponse.json({ msg: "Placas ja foram excluidas!" });
    }

    const ids = eqs.map(e => e.id);
    const log: string[] = [];

    // Tentar cada tabela individualmente
    for (const table of ["manutencoes", "ordens_servico", "horimetros", "preventivas", "pneus", "boletim_pneus"]) {
      const res = await supabase.from(table).delete().in("equipamento_id", ids).select("id");
      if (res.error) {
        log.push(`${table}: ${res.error.code}`);
      } else {
        log.push(`${table}: ${res.data?.length ?? 0} excluidos`);
      }
    }

    // Agora excluir equipamentos
    const { data: del, error: delErr } = await supabase
      .from("equipamentos")
      .delete()
      .in("id", ids)
      .select("placa");

    if (delErr) {
      return NextResponse.json({ 
        erro: delErr.message, 
        log,
        placas: eqs.map(e => e.placa) 
      });
    }

    return NextResponse.json({ excluidas: del?.map(e => e.placa), log });
  } catch (e: any) {
    return NextResponse.json({ crash: e.message });
  }
}
