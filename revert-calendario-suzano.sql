-- REVERTER CALENDÁRIO SUZANO PARA O PADRÃO DA EMPRESA (2026)
-- Este script irá alterar o calendário base do sistema para as datas operacionais
-- conforme as regras padrão (e não as regras de Semanas ISO).

UPDATE calendario_suzano SET data_inicio = '2025-12-22', data_fim = '2026-01-21' WHERE ano = 2026 AND mes = 1;
UPDATE calendario_suzano SET data_inicio = '2026-01-22', data_fim = '2026-02-19' WHERE ano = 2026 AND mes = 2;
UPDATE calendario_suzano SET data_inicio = '2026-02-20', data_fim = '2026-03-22' WHERE ano = 2026 AND mes = 3;
UPDATE calendario_suzano SET data_inicio = '2026-03-23', data_fim = '2026-04-21' WHERE ano = 2026 AND mes = 4;
UPDATE calendario_suzano SET data_inicio = '2026-04-22', data_fim = '2026-05-21' WHERE ano = 2026 AND mes = 5;
UPDATE calendario_suzano SET data_inicio = '2026-05-22', data_fim = '2026-06-21' WHERE ano = 2026 AND mes = 6;
UPDATE calendario_suzano SET data_inicio = '2026-06-22', data_fim = '2026-07-22' WHERE ano = 2026 AND mes = 7;
UPDATE calendario_suzano SET data_inicio = '2026-07-23', data_fim = '2026-08-20' WHERE ano = 2026 AND mes = 8;
UPDATE calendario_suzano SET data_inicio = '2026-08-21', data_fim = '2026-09-20' WHERE ano = 2026 AND mes = 9;
UPDATE calendario_suzano SET data_inicio = '2026-09-21', data_fim = '2026-10-21' WHERE ano = 2026 AND mes = 10;
UPDATE calendario_suzano SET data_inicio = '2026-10-22', data_fim = '2026-11-21' WHERE ano = 2026 AND mes = 11;
UPDATE calendario_suzano SET data_inicio = '2026-11-22', data_fim = '2026-12-21' WHERE ano = 2026 AND mes = 12;
