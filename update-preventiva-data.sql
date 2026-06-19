-- 1. Atualizar Calendário Operacional para 2026 segundo ISO 8601 exato
UPDATE calendario_suzano SET data_inicio = '2025-12-29', data_fim = '2026-02-01' WHERE ano = 2026 AND mes = 1;
UPDATE calendario_suzano SET data_inicio = '2026-02-02', data_fim = '2026-03-01' WHERE ano = 2026 AND mes = 2;
UPDATE calendario_suzano SET data_inicio = '2026-03-02', data_fim = '2026-04-05' WHERE ano = 2026 AND mes = 3;
UPDATE calendario_suzano SET data_inicio = '2026-04-06', data_fim = '2026-05-03' WHERE ano = 2026 AND mes = 4;
UPDATE calendario_suzano SET data_inicio = '2026-05-04', data_fim = '2026-05-31' WHERE ano = 2026 AND mes = 5;
UPDATE calendario_suzano SET data_inicio = '2026-06-01', data_fim = '2026-07-05' WHERE ano = 2026 AND mes = 6;
UPDATE calendario_suzano SET data_inicio = '2026-07-06', data_fim = '2026-08-02' WHERE ano = 2026 AND mes = 7;
UPDATE calendario_suzano SET data_inicio = '2026-08-03', data_fim = '2026-09-06' WHERE ano = 2026 AND mes = 8;
UPDATE calendario_suzano SET data_inicio = '2026-09-07', data_fim = '2026-10-04' WHERE ano = 2026 AND mes = 9;
UPDATE calendario_suzano SET data_inicio = '2026-10-05', data_fim = '2026-11-01' WHERE ano = 2026 AND mes = 10;
UPDATE calendario_suzano SET data_inicio = '2026-11-02', data_fim = '2026-11-29' WHERE ano = 2026 AND mes = 11;
UPDATE calendario_suzano SET data_inicio = '2026-11-30', data_fim = '2027-01-03' WHERE ano = 2026 AND mes = 12;

-- 2. Limpar lançamentos das semanas 18 a 25 para evitar duplicatas (usar apenas MATRIZ)
DELETE FROM prev_prog_semanal WHERE ano = 2026 AND semana_iso BETWEEN 18 AND 25 AND filial_id = 'MATRIZ';

-- 3. Inserir lançamentos (Semana 18 a 25)
INSERT INTO prev_prog_semanal 
  (id, ano, mes_numero, semana_numero, semana_iso, data_inicio, data_fim, placa, modulo, categoria_operacional, tipo, data_inicio_exec, data_fim_exec, termino, dias, mpbt, status, percentual, horimetro_dia, filial_id)
VALUES 
-- Semana 18
(gen_random_uuid(), 2026, 4, 4, 18, '2026-04-27', '2026-05-03', 'ROE8F63', '7', 'COMBOIO', 'PREVENTIVA', '2026-04-28', '2026-05-11', '2026-05-11', 13, '13.000', 'CONCLUÍDO', 100, '13.095', 'MATRIZ'),
(gen_random_uuid(), 2026, 4, 4, 18, '2026-04-27', '2026-05-03', 'TCC2E83', '5', 'PIPA', 'PREVENTIVA', '2026-04-27', '2026-05-03', '2026-05-03', NULL, NULL, 'REPROGRAMADO', 0, NULL, 'MATRIZ'),

-- Semana 19
(gen_random_uuid(), 2026, 5, 1, 19, '2026-05-04', '2026-05-10', 'TCC4D15', 'CARREG', 'COMBOIO', 'PREVENTIVA', '2026-05-04', '2026-05-10', '2026-05-10', NULL, NULL, 'REPROGRAMADO', 0, NULL, 'MATRIZ'),
(gen_random_uuid(), 2026, 5, 1, 19, '2026-05-04', '2026-05-10', 'TCC2E83', '5', 'PIPA', 'PREVENTIVA', '2026-05-04', '2026-05-10', '2026-05-10', NULL, NULL, 'REPROGRAMADO', 0, NULL, 'MATRIZ'),

-- Semana 20
(gen_random_uuid(), 2026, 5, 2, 20, '2026-05-11', '2026-05-17', 'TCC2E83', '5', 'PIPA', 'PREVENTIVA', '2026-05-11', '2026-05-17', '2026-05-17', NULL, NULL, 'REPROGRAMADO', 0, NULL, 'MATRIZ'),
(gen_random_uuid(), 2026, 5, 2, 20, '2026-05-11', '2026-05-17', 'TCC4D15', 'CARREG', 'COMBOIO', 'PREVENTIVA', '2026-05-11', '2026-05-17', '2026-05-17', NULL, NULL, 'REPROGRAMADO', 0, NULL, 'MATRIZ'),

-- Semana 21
(gen_random_uuid(), 2026, 5, 3, 21, '2026-05-18', '2026-05-24', 'TCC2E83', '5', 'PIPA', 'PREVENTIVA', '2026-05-21', '2026-05-21', '2026-05-21', 1, '2.500', 'CONCLUÍDO', 100, '2.565', 'MATRIZ'),
(gen_random_uuid(), 2026, 5, 3, 21, '2026-05-18', '2026-05-24', 'TCC4D15', 'CARREG', 'COMBOIO', 'PREVENTIVA', '2026-05-19', '2026-05-21', '2026-05-21', 3, '1.000', 'CONCLUÍDO', 100, '1.165', 'MATRIZ'),

-- Semana 22
(gen_random_uuid(), 2026, 5, 4, 22, '2026-05-25', '2026-05-31', 'ROG1I38', 'CARREG', 'COMBOIO', 'PREVENTIVA', '2026-05-23', '2026-06-03', '2026-06-03', 12, '11.000', 'CONCLUÍDO', 95, '10.992', 'MATRIZ'),
(gen_random_uuid(), 2026, 5, 4, 22, '2026-05-25', '2026-05-31', 'ROE8F66', 'RESERVA', 'COMBOIO', 'PREVENTIVA', '2026-05-09', '2026-05-28', '2026-05-28', 20, '14.500', 'CONCLUÍDO', 100, '14.774', 'MATRIZ'),
(gen_random_uuid(), 2026, 5, 4, 22, '2026-05-25', '2026-05-31', 'PTV3A59', 'CARREG', 'MULTI', 'PREVENTIVA', '2026-05-23', '2026-06-12', '2026-06-12', 21, '8.500', 'CONCLUÍDO', 40, '8.614', 'MATRIZ'),

-- Semana 23
(gen_random_uuid(), 2026, 6, 1, 23, '2026-06-01', '2026-06-07', 'TCN7J90', '7', 'COMBOIO', 'PREVENTIVA', '2026-06-02', '2026-06-09', '2026-06-09', 8, '4.000', 'CONCLUÍDO', 100, '4.189', 'MATRIZ'),
(gen_random_uuid(), 2026, 6, 1, 23, '2026-06-01', '2026-06-07', 'TCC6G17', '5', 'PIPA', 'PREVENTIVA', '2026-06-02', '2026-06-07', '2026-06-07', NULL, NULL, 'REPROGRAMADO', 0, NULL, 'MATRIZ'),

-- Semana 24
(gen_random_uuid(), 2026, 6, 2, 24, '2026-06-08', '2026-06-14', 'TCN7J72', '2', 'COMBOIO', 'PREVENTIVA', '2026-06-12', '2026-06-15', '2026-06-15', 4, '4.000', 'EM ANDAMENTO', 20, '3.876', 'MATRIZ'),
(gen_random_uuid(), 2026, 6, 2, 24, '2026-06-08', '2026-06-14', 'TCC6G17', '5', 'PIPA', 'PREVENTIVA', '2026-06-02', '2026-06-07', '2026-06-07', NULL, NULL, 'REPROGRAMADO', 0, NULL, 'MATRIZ'),

-- Semana 25
(gen_random_uuid(), 2026, 6, 3, 25, '2026-06-15', '2026-06-21', 'PTV4G53', 'RESERVA', NULL, 'PREVENTIVA', NULL, NULL, NULL, NULL, NULL, 'PROGRAMADO', 0, NULL, 'MATRIZ'),
(gen_random_uuid(), 2026, 6, 3, 25, '2026-06-15', '2026-06-21', 'TCC6G17', '5', NULL, 'PREVENTIVA', NULL, NULL, NULL, NULL, NULL, 'PROGRAMADO', 0, NULL, 'MATRIZ');
