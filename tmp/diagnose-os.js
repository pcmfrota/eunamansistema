const fetch = require('node-fetch');

const url = "https://ffvwappomyuhyyeylpgt.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmdndhcHBvbXl1aHl5ZXlscGd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDczOTI5MCwiZXhwIjoyMDkwMzE1MjkwfQ.fKnqnMW0hnVWalOJD4NYDN2W6p4JJzPKAKzHlPlY4xc";

async function run() {
  console.log("Starting diagnosis...");
  try {
    // 1. Fetch all equipments
    const eqRes = await fetch(`${url}/rest/v1/equipamentos?select=*`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    const equips = await eqRes.json();
    console.log(`Fetched ${equips.length} equipments.`);

    // 2. Fetch all OSs
    const osRes = await fetch(`${url}/rest/v1/ordens_servico?select=*`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    const osList = await osRes.json();
    console.log(`Fetched ${osList.length} work orders (OS).`);

    // 3. Fetch all calendar suzano entries
    const calRes = await fetch(`${url}/rest/v1/calendario_suzano?select=*`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    const calendar = await calRes.json();
    console.log(`Fetched ${calendar.length} calendar entries.`);

    // Analyze plates and classifications
    const equipsByPlaca = {};
    const equipsById = {};
    const plateToCategory = {};
    const plateToTipo = {};
    equips.forEach(e => {
      if (e.placa) {
        const pKey = e.placa.toUpperCase().trim();
        equipsByPlaca[pKey] = e;
        plateToCategory[pKey] = e.categoria;
        plateToTipo[pKey] = e.tipo;
      }
      equipsById[e.id] = e;
    });

    const TIPO_PARA_LABEL = {
      'PIPA': 'PIPA',
      'COMBOIO': 'COMBOIO',
      'MUNCK': 'MUNCK',
      'MULTIFUNCIONAL': 'MULTI',
      'MULTI': 'MULTI',
    };

    // Analyze OSs
    let unmatchedPlatesCount = 0;
    let missingPlatesCount = 0;
    let unmatchedEquipIdsCount = 0;
    const osByPlateStatus = {};
    const missingPlatesList = [];

    const analyzedOs = osList.map(os => {
      const placa = os.placa ? os.placa.toUpperCase().trim() : null;
      const equipId = os.equipamento_id;
      
      let matchedEquip = null;
      let matchReason = "";

      if (placa && equipsByPlaca[placa]) {
        matchedEquip = equipsByPlaca[placa];
        matchReason = "plate";
      } else if (equipId && equipsById[equipId]) {
        matchedEquip = equipsById[equipId];
        matchReason = "equip_id";
      }

      if (!placa) {
        missingPlatesCount++;
      } else if (!matchedEquip) {
        unmatchedPlatesCount++;
        missingPlatesList.push({ id: os.id, numero_os: os.numero_os, placa });
      }

      const equipTipo = matchedEquip ? (matchedEquip.tipo || '').toUpperCase().trim() : null;
      const mappedCategory = equipTipo ? TIPO_PARA_LABEL[equipTipo] : null;

      return {
        id: os.id,
        numero_os: os.numero_os,
        placa: os.placa,
        equipamento_id: os.equipamento_id,
        data_abertura: os.data_abertura,
        data_fechamento: os.data_fechamento,
        horario_parada: os.horario_parada,
        status: os.status,
        matchedEquipPlaca: matchedEquip ? matchedEquip.placa : null,
        matchedEquipTipo: matchedEquip ? matchedEquip.tipo : null,
        mappedCategory,
        matchReason
      };
    });

    // Test filter for current month (May 2026)
    // May 2026 is 2026-04-22 to 2026-05-21
    const inicioMay = "2026-04-22T00:00:00";
    const fimMay = "2026-05-21T23:59:59";
    const inicioMayTime = new Date(inicioMay).getTime();
    const fimMayTime = new Date(fimMay).getTime();

    function parseLocal(dateStr) {
      if (!dateStr) return 0;
      const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (match) {
        return new Date(
          parseInt(match[1]),
          parseInt(match[2]) - 1,
          parseInt(match[3]),
          parseInt(match[4]),
          parseInt(match[5])
        ).getTime();
      }
      return new Date(dateStr).getTime();
    }

    const mayOsList = analyzedOs.filter(os => {
      if (!os.mappedCategory) return false;
      const abTime = parseLocal(os.horario_parada || os.data_abertura);
      const fcTime = os.data_fechamento ? parseLocal(os.data_fechamento) : null;
      const part1 = abTime <= fimMayTime;
      const part2 = !fcTime || fcTime >= inicioMayTime;
      return part1 && part2;
    });

    console.log(`May 2026 OS count with categories: ${mayOsList.length}`);
    const mayOsByCat = {};
    mayOsList.forEach(os => {
      mayOsByCat[os.mappedCategory] = (mayOsByCat[os.mappedCategory] || 0) + 1;
    });
    console.log("May OS by category:", mayOsByCat);

    // Save detailed analysis to file
    const fs = require('fs');
    const analysis = {
      timestamp: new Date().toISOString(),
      counts: {
        totalEquips: equips.length,
        totalOs: osList.length,
        unmatchedPlatesCount,
        missingPlatesCount,
        unmatchedEquipIdsCount,
        mayOsListCount: mayOsList.length
      },
      mayOsByCat,
      calendar,
      missingPlatesList: missingPlatesList.slice(0, 50)
    };

    fs.writeFileSync('c:\\Users\\jessi\\OneDrive\\Área de Trabalho\\EUNAMAN SISTEMA\\eunamansistema\\tmp\\detailed_diagnosis.json', JSON.stringify(analysis, null, 2), 'utf-8');
    console.log("Diagnosis completed successfully. saved to detailed_diagnosis.json");

  } catch (err) {
    console.error("Diagnosis error:", err);
  }
}

run();
