import { NextResponse } from 'next/server';
import { EquipamentoService } from '@/src/services/EquipamentoService';

export async function GET() {
  try {
    // 1. Obter todos os equipamentos atuais
    const todos = await EquipamentoService.getAll();
    const ids = todos.map(e => e.id);

    // 2. Apagar toda a frota se houver
    if (ids.length > 0) {
      await EquipamentoService.deleteBulk(ids);
    }

    // 3. Cadastrar a nova frota (segunda imagem)
    const novaFrota = [
      { "placa": "ROG1I38", "tipo": "COMBOIO", "modulo": "RESERVA", "categoria": "PESADO" },
      { "placa": "ROE8F63", "tipo": "COMBOIO", "modulo": "MÓDULO 7", "categoria": "PESADO" },
      { "placa": "ROE8F66", "tipo": "COMBOIO", "modulo": "RESERVA", "categoria": "PESADO" },
      { "placa": "ROG1I26", "tipo": "COMBOIO", "modulo": "MÓDULO 5", "categoria": "PESADO" },
      { "placa": "ROG1I40", "tipo": "COMBOIO", "modulo": "RESERVA", "categoria": "PESADO" },
      { "placa": "LMT7E29", "tipo": "COMBOIO", "modulo": "CARREGAMENTO", "categoria": "PESADO" },
      { "placa": "ROG1I41", "tipo": "COMBOIO", "modulo": "MÓDULO 5", "categoria": "PESADO" },
      { "placa": "TCN7J72", "tipo": "COMBOIO", "modulo": "MÓDULO 2", "categoria": "PESADO" },
      { "placa": "TCN7J90", "tipo": "COMBOIO", "modulo": "MÓDULO 7", "categoria": "PESADO" },
      { "placa": "TCN7J82", "tipo": "COMBOIO", "modulo": "CARREGAMENTO", "categoria": "PESADO" },
      { "placa": "TCA4B23", "tipo": "PIPA", "modulo": "MÓDULO 2", "categoria": "PESADO" },
      { "placa": "TCA4B26", "tipo": "PIPA", "modulo": "MÓDULO 7", "categoria": "PESADO" },
      { "placa": "PTF4236", "tipo": "PIPA", "modulo": "RESERVA", "categoria": "PESADO" },
      { "placa": "TCC2E83", "tipo": "PIPA", "modulo": "MÓDULO 5", "categoria": "PESADO" },
      { "placa": "TCC6G17", "tipo": "PIPA", "modulo": "MÓDULO 5", "categoria": "PESADO" },
      { "placa": "LUC7J90", "tipo": "PIPA", "modulo": "MÓDULO 7", "categoria": "PESADO" },
      { "placa": "SFR4F28", "tipo": "MUNCK", "modulo": "MALHA VIARIA", "categoria": "PESADO" },
      { "placa": "SFR4F37", "tipo": "MUNCK", "modulo": "MÓDULO 5", "categoria": "PESADO" },
      { "placa": "SGJ1G11", "tipo": "MUNCK", "modulo": "MÓDULO 2", "categoria": "PESADO" },
      { "placa": "SGJ7I82", "tipo": "MUNCK", "modulo": "MÓDULO 7", "categoria": "PESADO" },
      { "placa": "PTV4G53", "tipo": "MULTIFUNCIONAL", "modulo": "RESERVA/CARREGAMENTO", "categoria": "PESADO" },
      { "placa": "PTV3A59", "tipo": "MULTIFUNCIONAL", "modulo": "CARREGAMENTO", "categoria": "PESADO" },
      { "placa": "GCU3C91", "tipo": "SAVEIRO", "modulo": "CAMPO", "categoria": "LEVE" },
      { "placa": "TWY2I61", "tipo": "STRADA", "modulo": "CAMPO", "categoria": "LEVE" },
      { "placa": "TEZ7A70", "tipo": "STRADA", "modulo": "CAMPO", "categoria": "LEVE" },
      { "placa": "TIS4I06", "tipo": "SAVEIRO", "modulo": "CAMPO", "categoria": "LEVE" },
      { "placa": "TCW3A28", "tipo": "C3", "modulo": "GESTÃO", "categoria": "LEVE" },
      { "placa": "TCW3A29", "tipo": "C3", "modulo": "TÉC.SEG", "categoria": "LEVE" },
      { "placa": "TJJ3E07", "tipo": "SAVEIRO", "modulo": "CAMPO", "categoria": "LEVE" }
    ];

    await EquipamentoService.import(novaFrota);

    return NextResponse.json({ success: true, message: "Frota antiga apagada e substituída com sucesso!", insertedCount: novaFrota.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
