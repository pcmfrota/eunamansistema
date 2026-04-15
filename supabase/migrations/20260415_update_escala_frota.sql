-- Atualiza/Insere todos os veículos com base na imagem fornecida
-- Período "08:00 AS 00:00" = 16h (turno duplo)
-- Período "08:00 A 16:00"  = 8h (turno simples)

INSERT INTO public.escala_frota (placa, categoria, modelo, modulo, tipo, carga_horaria, periodo_inicio, periodo_fim)
VALUES
  -- 16h (08:00 às 00:00)
  ('ROG1I38', 'COMBOIO',       'VM 270 6X4R - VOLVO',         'RESERVA',              'PESADO', 16, '08:00:00', '00:00:00'),
  ('ROE8F66', 'COMBOIO',       'VM 270 6X4R - VOLVO',         'RESERVA',              'PESADO', 16, '08:00:00', '00:00:00'),
  ('ROG1I40', 'COMBOIO',       'VM 270 6X4R - VOLVO',         'RESERVA',              'PESADO', 16, '08:00:00', '00:00:00'),
  ('TCN7J72', 'COMBOIO',       'M. BENZ / ATEGO 2730 CE',     'MÓDULO 2',             'PESADO', 16, '08:00:00', '00:00:00'),
  ('TCN7J90', 'COMBOIO',       'M. BENZ / ATEGO 2730 CE',     'MÓDULO 7',             'PESADO', 16, '08:00:00', '00:00:00'),

  -- 8h (08:00 às 16:00)
  ('ROE8F63', 'COMBOIO',       'VM 270 6X4R - VOLVO',         'MÓDULO 7',             'PESADO',  8, '08:00:00', '16:00:00'),
  ('ROG1I26', 'COMBOIO',       'VM 270 6X4R - VOLVO',         'MÓDULO 5',             'PESADO',  8, '08:00:00', '16:00:00'),
  ('LMT7E29', 'COMBOIO',       'VW-17.190 CRM 4X2 ROB',       'CARREGAMENTO',         'PESADO',  8, '08:00:00', '16:00:00'),
  ('ROG1I41', 'COMBOIO',       'VM 270 6X4R - VOLVO',         'MÓDULO 5',             'PESADO',  8, '08:00:00', '16:00:00'),
  ('TCN7J82', 'COMBOIO',       'M. BENZ / ATEGO 2730 CE',     'CARREGAMENTO',         'PESADO',  8, '08:00:00', '16:00:00'),
  ('TCC4D15', 'COMBOIO',       'M. BENZ / ATEGO 2730 CE',     'CARREGAMENTO',         'PESADO',  8, '08:00:00', '16:00:00'),
  ('TCA4B23', 'PIPA',          'M. BENZ / ATEGO 2730 CE',     'MÓDULO 2',             'PESADO',  8, '08:00:00', '16:00:00'),
  ('TCA4B26', 'PIPA',          'M. BENZ / ATEGO 2730 CE',     'MÓDULO 7',             'PESADO',  8, '08:00:00', '16:00:00'),
  ('PTF4236', 'PIPA',          'VW-17.190 CRM 4X2',           'RESERVA',              'PESADO',  8, '08:00:00', '16:00:00'),
  ('TCC2E83', 'PIPA',          'M. BENZ / ATEGO 2730 CE',     'MÓDULO 5',             'PESADO',  8, '08:00:00', '16:00:00'),
  ('TCC6G17', 'PIPA',          'M. BENZ / ATEGO 2730 CE',     'MÓDULO 5',             'PESADO',  8, '08:00:00', '16:00:00'),
  ('LUC7J90', 'PIPA',          'VW 26.280 CRM 6X4',           'MÓDULO 7',             'PESADO',  8, '08:00:00', '16:00:00'),
  ('SFR4F28', 'MUNCK',         'M. BENZ / ATEGO 2730 CE',     'MALHA VIARIA',         'PESADO',  8, '08:00:00', '16:00:00'),
  ('SFR4F37', 'MUNCK',         'M. BENZ / ATEGO 2730 CE',     'MÓDULO 5',             'PESADO',  8, '08:00:00', '16:00:00'),
  ('SGJ1G11', 'MUNCK',         'M. BENZ / ATEGO 2730 CE',     'MÓDULO 2',             'PESADO',  8, '08:00:00', '16:00:00'),
  ('SGJ7I82', 'MUNCK',         'M. BENZ / ATEGO 2730 CE',     'MÓDULO 7',             'PESADO',  8, '08:00:00', '16:00:00'),
  ('PTT8D46', 'MUNCK',         'MBB-1719-ATEGO',              'CARREGAMENTO',         'PESADO',  8, '08:00:00', '16:00:00'),
  ('PTV4G53', 'MULTIFUNCIONAL','MBB-ATEGO-17.190 -CL',        'RESERVA/CARREGAMENTO', 'PESADO',  8, '08:00:00', '16:00:00'),
  ('PTV3A59', 'MULTIFUNCIONAL','MBB-ATEGO-17.190 -CL',        'CARREGAMENTO',         'PESADO',  8, '08:00:00', '16:00:00'),
  ('PTV5G37', 'SKID',          'LT20.000',                    'MÓDULO 7',             'SKID',    8, '08:00:00', '16:00:00'),
  ('PTW0F01', 'SKID',          'LT15.000',                    'MÓDULO 5',             'SKID',    8, '08:00:00', '16:00:00')

ON CONFLICT (placa) DO UPDATE SET
  categoria      = EXCLUDED.categoria,
  modelo         = EXCLUDED.modelo,
  modulo         = EXCLUDED.modulo,
  tipo           = EXCLUDED.tipo,
  carga_horaria  = EXCLUDED.carga_horaria,
  periodo_inicio = EXCLUDED.periodo_inicio,
  periodo_fim    = EXCLUDED.periodo_fim,
  updated_at     = now();
