export type ItemType = 'pneus' | 'standard' | 'multi' | 'iluminacao' | 'barras' | 'cinto'

export interface ChecklistItem {
  id: string
  label: string
  type: ItemType
  subItems?: { id: string; label: string }[]
}

export interface ChecklistGroup {
  id: string
  title: string
  items: ChecklistItem[]
}

const pneusItem: ChecklistItem = {
  id: 'pneus',
  label: '1. Pneus (POSIÇÃO / ESTADOS: N-Normal, M-Meia Vida, F-Fim de Vida)',
  type: 'pneus'
}

const barrasItem: ChecklistItem = {
  id: 'barras',
  label: 'Barras de Proteção',
  type: 'barras'
}

const cintoItem: ChecklistItem = {
  id: 'cinto',
  label: 'Cinto de Segurança',
  type: 'cinto'
}

const iluminacaoItem: ChecklistItem = {
  id: 'iluminacao',
  label: 'Sistema de Iluminação',
  type: 'iluminacao'
}

const group1EquipInterditado: ChecklistGroup = {
  id: 'g1',
  title: '1. EQUIPAMENTO INTERDITADO',
  items: [pneusItem]
}

const group2EquipInterditadoCommon = [
  barrasItem,
  cintoItem,
  { id: 'tacografo', label: 'Tacógrafo / Cronotacógrafo / APR / Laudo Eletromecânico / ART', type: 'multi', subItems: [{id:'tacografo', label:'Tacógrafo'}, {id:'crono', label:'Crono'}, {id:'doc', label:'APR/LAUDO/ART'}] },
  { id: 'docs', label: 'CRLV / CIV / CIPP / ANTT / FISPQ', type: 'multi', subItems: [{id:'civ', label:'CIV/CIPP'}, {id:'crlv', label:'CRLV/ANTT'}, {id:'fispq', label:'FISPQ'}] },
  { id: 'partida', label: 'Partida (Ignição)', type: 'standard' },
  { id: 'freio', label: 'Sistema de Freio / Freio Estacionário', type: 'standard' },
  { id: 'direcao', label: 'Barra de Direção', type: 'standard' },
  { id: 'escada_comum', label: 'Escada de Acesso / Guarda Corpo', type: 'multi', subItems: [{id:'escada', label:'Escada'}, {id:'guarda', label:'Guarda C.'}] },
  { id: 'tres_pontos', label: 'Três Pontos de Acesso / Piso Antiderrapante', type: 'multi', subItems: [{id:'tresp', label:'Três Pontos'}, {id:'piso', label:'Piso'}] },
  { id: 'vazamento_comb', label: 'Vazamento de Combustível', type: 'standard' },
  { id: 'sirene', label: 'Sirene de Ré / Buzina', type: 'multi', subItems: [{id:'re', label:'Ré'}, {id:'buzina', label:'Buzina'}] },
  { id: 'sinalizacao_rad', label: 'Sinalização / Trava do Radiador', type: 'multi', subItems: [{id:'sinalizacao', label:'Sinalização'}, {id:'trava', label:'Trava'}] },
  { id: 'extintor', label: 'Extintor / Suporte', type: 'multi', subItems: [{id:'extintor', label:'Extintor'}, {id:'suporte', label:'Suporte'}] },
] as ChecklistItem[]

const group4ManutencaoCommon = [
  { id: 'ferramentas', label: 'Macaco / Chave de Roda / Triângulo / Mão de Força', type: 'multi', subItems: [{id:'macaco', label:'Macaco'}, {id:'chave', label:'Chave'}, {id:'triangulo', label:'Triângulo'}, {id:'mao', label:'Mão Força'}] },
  { id: 'estepe', label: 'Estepe / Calços', type: 'multi', subItems: [{id:'estepe', label:'Estepe'}, {id:'calcos', label:'Calços'}] },
  { id: 'rodas', label: 'Porcas / Parafusos / Trincas Rodas', type: 'multi', subItems: [{id:'porcas', label:'Porcas'}, {id:'parafusos', label:'Parafusos'}, {id:'trincas', label:'Trincas Rodas'}] },
  { id: 'vidros', label: 'Parabrisa / Vidros das Portas', type: 'multi', subItems: [{id:'parabrisa', label:'Parabrisa'}, {id:'vidrosp', label:'Vidros p.'}] },
  { id: 'retrovisor', label: 'Espelhos Retrovisor / Quebra Sol', type: 'multi', subItems: [{id:'retrovisor', label:'Retrovisor'}, {id:'quebra', label:'Que Sol'}] },
  { id: 'pedais', label: 'Pedais / Borrachas / Estribos', type: 'multi', subItems: [{id:'pedais', label:'Pedais'}, {id:'borrachas', label:'Borrachas'}, {id:'estribos', label:'Estribos'}] },
  { id: 'cones', label: 'Cones / Placas de Sinalização', type: 'multi', subItems: [{id:'cones', label:'Cones'}, {id:'placas', label:'Placas Sina.'}, {id:'placa_isol', label:'Placa Isolamento'}] },
  iluminacaoItem,
  { id: 'limpador', label: 'Limpador do Parabrisa / Injetor / Palheta', type: 'multi', subItems: [{id:'limpador', label:'Limpador'}, {id:'injetor', label:'Injetor'}, {id:'palheta', label:'Palheta'}] },
  { id: 'vaz_ar', label: 'Vazamento de Ar', type: 'standard' },
  { id: 'vaz_oleo', label: 'Vazamento de Óleo - Implemento ou Caminhão', type: 'standard' },
  { id: 'suspensao', label: 'Suspensão', type: 'standard' },
  { id: 'cabine', label: 'Cabine / Assoalho / Bancos', type: 'multi', subItems: [{id:'cabine', label:'Cabine'}, {id:'assoalho', label:'Assoalho'}, {id:'bancos', label:'Bancos'}] },
  { id: 'ar', label: 'Ar Condicionado / Climatizador', type: 'multi', subItems: [{id:'ar', label:'Ar Condicionado'}, {id:'climatizador', label:'Climatizador'}] },
  { id: 'faixas', label: 'Faixas Refletivas', type: 'standard' },
] as ChecklistItem[]

// =============== ESPECÍFICOS POR CAMINHÃO ===============

// 1. COMBOIO
export const getComboioConfig = (): ChecklistGroup[] => [
  group1EquipInterditado,
  {
    id: 'g2',
    title: '2. EQUIPAMENTO INTERDITADO',
    items: [
      ...group2EquipInterditadoCommon,
      { id: 'kit_ambiental', label: 'KIT AMBIENTAL (Botas, Cones, Pá, Placas, Envelope, Lacre)', type: 'standard' },
      { id: 'aterramento', label: 'Aterramento Chassi Tanque / Tanque MVE', type: 'multi', subItems: [{id:'chassi', label:'Chassi/Tanque'}, {id:'mve', label:'Tan/MVE'}] },
    ]
  },
  {
    id: 'g3',
    title: '3. OBRIGATÓRIOS PARA OPERAÇÃO',
    items: [
      { id: 'propulsora', label: 'Propulsora / Pistola Diesel / Graxa / Insumos / Calibrador / Régua / Tabela / Cinto', type: 'multi', subItems: [
        {id:'propulsora', label:'Propulsora'}, {id:'diesel', label:'Bico P Diesel'}, {id:'graxa', label:'Bico P Graxa'}, 
        {id:'insumo', label:'Bico P Insumo'}, {id:'calibrador', label:'Calibrador'}, {id:'regua', label:'Régua P Tanque'},
        {id:'tabela', label:'Tabela'}, {id:'cinto_tala', label:'Cinto C/ Tala'}
      ]},
      { id: 'registradora', label: 'Registradora de Diesel / Insumo', type: 'multi', subItems: [{id:'diesel', label:'DIESEL'}, {id:'insumo', label:'INSUMO'}] }
    ]
  },
  {
    id: 'g4',
    title: '4. MANUTENÇÃO PROGRAMADA',
    items: [
      ...group4ManutencaoCommon.filter(i => i.id !== 'cabine' && i.id !== 'ar' && i.id !== 'faixas'), // Reordenando para bater com ficha Comboio
      { id: 'disp_porta', label: 'Dispositivo de Limitação da Porta', type: 'multi', subItems: [{id:'limitador', label:'Limitador P/ porta'}] },
      group4ManutencaoCommon.find(i=>i.id==='cabine')!,
      group4ManutencaoCommon.find(i=>i.id==='ar')!,
      group4ManutencaoCommon.find(i=>i.id==='faixas')!,
      { id: 'pto', label: 'Tomada de Força (ruído, vazamento, funcionamento)', type: 'standard' },
      { id: 'mang_carreteis', label: 'Mangueira dos Carretéis', type: 'standard' },
      { id: 'integ_carreteis', label: 'Integridade dos Carretéis', type: 'standard' },
      { id: 'amortecedor', label: 'Amortecedor de Casaria', type: 'standard' },
      { id: 'correia', label: 'Correia do Implemento', type: 'standard' },
      { id: 'sup_hidr', label: 'Suporte de Fixação do Tanque Hidráulico', type: 'standard' },
      { id: 'graxeiros', label: 'Graxeiros do Equipamento (Catraca, Cruzeta etc)', type: 'standard' },
      { id: 'setor_dir', label: 'Setor de Direção', type: 'standard' },
      { id: 'arref', label: 'Liquido de Arrefecimento', type: 'standard' },
      { id: 'chassi', label: 'Chassi (Trincas etc...)', type: 'standard' }
    ]
  }
]

// 2. PIPA
export const getPipaConfig = (): ChecklistGroup[] => [
  group1EquipInterditado,
  {
    id: 'g2',
    title: '2. EQUIPAMENTO INTERDITADO',
    items: [
      ...group2EquipInterditadoCommon
    ]
  },
  {
    id: 'g3',
    title: '3. OBRIGATÓRIOS PARA OPERAÇÃO',
    items: [
      { id: 'escada_pipa', label: 'Escada de Alumínio 08 Degraus / Gancho / Canhão LGE / Maraca', type: 'multi', subItems: [
        {id:'escada', label:'ESCADA'}, {id:'gancho', label:'GANCHO'}, {id:'canhao', label:'CANHÃO LGE'}, {id:'maraca', label:'MARACA'}
      ]}
    ]
  },
  {
    id: 'g4',
    title: '4. MANUTENÇÃO PROGRAMADA',
    items: [
      ...group4ManutencaoCommon.filter(i => i.id !== 'cabine' && i.id !== 'ar' && i.id !== 'faixas'),
      { id: 'vaz_agua_bomba', label: 'Vazamento de Água na Bomba', type: 'standard' },
      { id: 'mang_agua', label: 'Mangueiras D\'Água', type: 'standard' },
      group4ManutencaoCommon.find(i=>i.id==='cabine')!,
      group4ManutencaoCommon.find(i=>i.id==='ar')!,
      group4ManutencaoCommon.find(i=>i.id==='faixas')!,
      { id: 'disp_porta', label: 'Dispositivo de Limitação da Porta', type: 'standard' },
      { id: 'carroceria', label: 'Carroceria', type: 'standard' },
      { id: 'graxeiros', label: 'Graxeiros do Equipamento (Catraca, Cruzeta etc...)', type: 'standard' },
      { id: 'mangueiras', label: 'Mangueiras', type: 'standard' },
      { id: 'setor_dir', label: 'Setor de Direção', type: 'standard' },
      { id: 'arref', label: 'Liquido de Arrefecimento', type: 'standard' },
      { id: 'chassi', label: 'Chassi (Trincas etc...)', type: 'standard' },
      { id: 'pto', label: 'Tomada de Força (ruído, vazamento, funcionamento)', type: 'standard' },
      { id: 'caixote', label: 'Caixote Guarda Volumes', type: 'standard' },
      { id: 'manometro', label: 'Manômetro de Pressão da Bomba do Implemento', type: 'standard' },
      { id: 'registros', label: 'Registros', type: 'standard' },
      { id: 'maraca', label: 'Maraca', type: 'standard' }
    ]
  }
]

// 3. MULTIFUNCIONAL
export const getMultifuncionalConfig = (): ChecklistGroup[] => [
  group1EquipInterditado,
  {
    id: 'g2',
    title: '2. EQUIPAMENTO INTERDITADO',
    items: [
      ...group2EquipInterditadoCommon
    ]
  },
  {
    id: 'g3',
    title: '3. OBRIGATÓRIOS PARA OPERAÇÃO',
    items: [
      { id: 'cintas_mf', label: 'Cinta de 2T / Cinta de 4T / Catraca 7M 1T / Cinta 4 Pontos', type: 'multi', subItems: [
        {id:'c2t', label:'2 CINTA 2T 4M'}, {id:'c4t', label:'2 CINTA DE 4T 4M'}, 
        {id:'catraca', label:'2 CINTA CATRACA 7M 1T'}, {id:'c4p', label:'4 CINTA 4 PONTOS 4M 8T'}
      ]}
    ]
  },
  {
    id: 'g4',
    title: '4. MANUTENÇÃO PROGRAMADA',
    items: [
      ...group4ManutencaoCommon.filter(i => i.id !== 'cabine' && i.id !== 'ar' && i.id !== 'faixas' && i.id !== 'cones'),
      { id: 'cones', label: 'Cones / Placas de Sinalização', type: 'multi', subItems: [{id:'cones', label:'Cones'}, {id:'placas', label:'Placas Sina'}, {id:'isolamento', label:'Placa Isolamento'}] },
      { id: 'pinos', label: 'Pinos do Guindauto', type: 'standard' },
      { id: 'valvula', label: 'Válvula de Segurança do Guindauto', type: 'standard' },
      { id: 'patolas', label: 'Patolas', type: 'standard' },
      { id: 'trava_moitao', label: 'Trava do Moitão', type: 'standard' },
      { id: 'vaz_agua_bomba', label: 'Vazamento de Água na Bomba', type: 'standard' },
      { id: 'mang_agua', label: 'Mangueiras D\'Água', type: 'standard' },
      group4ManutencaoCommon.find(i=>i.id==='cabine')!,
      group4ManutencaoCommon.find(i=>i.id==='ar')!,
      group4ManutencaoCommon.find(i=>i.id==='faixas')!,
      { id: 'adesivo', label: 'Adesivo de Capacidade de Carga', type: 'standard' },
      { id: 'disp_porta', label: 'Dispositivo de Limitação da Porta', type: 'standard' },
      { id: 'carroceria', label: 'Carroceria', type: 'standard' },
      { id: 'giro_torre', label: 'Giro da Torre', type: 'standard' },
      { id: 'graxeiros', label: 'Graxeiros do Equipamento', type: 'standard' },
      { id: 'mangueiras', label: 'Mangueiras', type: 'standard' },
      { id: 'setor_dir', label: 'Setor de Direção', type: 'standard' },
      { id: 'arref', label: 'Líquido de Arrefecimento', type: 'standard' },
      { id: 'chassi', label: 'Chassi (Trincas etc...)', type: 'standard' },
      { id: 'pto', label: 'Tomada de Força (ruído, vazamento, funcionamento)', type: 'standard' },
      { id: 'caixote', label: 'Caixote de Cintas', type: 'standard' },
      { id: 'monometro', label: 'Monômetro de Pressão da Bomba do Implemento', type: 'standard' },
      { id: 'cilindro_pneu', label: 'Cilindro Pneumático Carroceria', type: 'standard' },
      { id: 'registros', label: 'Registros', type: 'standard' },
      { id: 'maraca', label: 'Maraca', type: 'standard' }
    ]
  }
]

// 4. MUNCK
export const getMunckConfig = (): ChecklistGroup[] => [
  group1EquipInterditado,
  {
    id: 'g2',
    title: '2. EQUIPAMENTO INTERDITADO',
    items: [
      ...group2EquipInterditadoCommon
    ]
  },
  {
    id: 'g3',
    title: '3. OBRIGATÓRIOS PARA OPERAÇÃO',
    items: [
      { id: 'cintas_mk', label: 'Cinta de 2T / Cinta de 4T / Catraca 7M 1T / Cinta 4 Pontos', type: 'multi', subItems: [
        {id:'c2t', label:'2 CINTA 2T 4M'}, {id:'c4t', label:'2 CINTA DE 4T 4M'}, 
        {id:'catraca', label:'2 CINTA CATRACA 7M 1T'}, {id:'c4p', label:'4 CINTA 4 PONTOS 4M 8T'}
      ]}
    ]
  },
  {
    id: 'g4',
    title: '4. MANUTENÇÃO PROGRAMADA',
    items: [
      ...group4ManutencaoCommon.filter(i => i.id !== 'cabine' && i.id !== 'ar' && i.id !== 'faixas' && i.id !== 'cones' && i.id !== 'escada_comum'),
      { id: 'escada_comum', label: 'Escada de Acesso / Guarda Corpo', type: 'multi', subItems: [{id:'escada', label:'Escada'}, {id:'guarda', label:'Guarda C.'}] },
      { id: 'cones', label: 'Cones / Placas de Sinalização', type: 'multi', subItems: [{id:'cones', label:'Cones'}, {id:'placas', label:'Placas Sina'}, {id:'isolamento', label:'Placa Isolamento'}] },
      group4ManutencaoCommon.find(i=>i.id==='iluminacao')!,
      { id: 'sirene', label: 'Sirene de Ré', type: 'standard' },
      group4ManutencaoCommon.find(i=>i.id==='limpador')!,
      group4ManutencaoCommon.find(i=>i.id==='vaz_ar')!,
      group4ManutencaoCommon.find(i=>i.id==='vaz_oleo')!,
      group4ManutencaoCommon.find(i=>i.id==='suspensao')!,
      { id: 'pinos', label: 'Pinos do Guindauto', type: 'standard' },
      { id: 'valvula', label: 'Válvula de Segurança do Guindauto', type: 'standard' },
      { id: 'patolas', label: 'Patolas', type: 'standard' },
      { id: 'trava_moitao', label: 'Trava do Moitão', type: 'standard' },
      group4ManutencaoCommon.find(i=>i.id==='cabine')!,
      group4ManutencaoCommon.find(i=>i.id==='ar')!,
      { id: 'extintor_suporte', label: 'Extintor / Suporte', type: 'multi', subItems: [{id:'extintor', label:'Extintor'}, {id:'suporte', label:'Suporte'}] },
      group4ManutencaoCommon.find(i=>i.id==='faixas')!,
      { id: 'adesivo', label: 'Adesivo de Capacidade de Carga', type: 'standard' },
      { id: 'disp_porta', label: 'Dispositivo de Limitação da Porta', type: 'standard' },
      { id: 'carroceria', label: 'Carroceria', type: 'standard' },
      { id: 'giro_torre', label: 'Giro da Torre', type: 'standard' },
      { id: 'graxeiros', label: 'Graxeiros do Equipamento', type: 'standard' },
      { id: 'mangueiras', label: 'Mangueiras', type: 'standard' },
      { id: 'setor_dir', label: 'Setor de Direção', type: 'standard' },
      { id: 'arref', label: 'Líquido de Arrefecimento', type: 'standard' },
      { id: 'chassi', label: 'Chassi (Trincas etc...)', type: 'standard' },
      { id: 'pto', label: 'Tomada de Força (ruído, vazamento, funcionamento)', type: 'standard' },
      { id: 'caixote', label: 'Caixote de Cintas', type: 'standard' },
    ]
  }
]
