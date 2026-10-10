-- Preenche o depósito Suzano (CBxx) dos comboios confirmados pelo usuário via print do
-- relatório "Baixa de Diesel e Lubrificantes" por depósito — o CB é por PLACA do comboio,
-- não por módulo (confirmado pelo usuário). Os demais comboios (ROG1I38, ROG1I26) e os
-- 2 skids seguem sem depósito até serem confirmados.

UPDATE public.equipamentos SET deposito_suzano = 'CB59' WHERE placa = 'TCN7J82';
UPDATE public.equipamentos SET deposito_suzano = 'CB92' WHERE placa = 'ROG1I41';
UPDATE public.equipamentos SET deposito_suzano = 'CB57' WHERE placa = 'TCN7J72';
UPDATE public.equipamentos SET deposito_suzano = 'CB95' WHERE placa = 'ROE8F63';
UPDATE public.equipamentos SET deposito_suzano = 'CB56' WHERE placa = 'TCN7J90';
UPDATE public.equipamentos SET deposito_suzano = 'CB94' WHERE placa = 'ROE8F66';
UPDATE public.equipamentos SET deposito_suzano = 'CB58' WHERE placa = 'LMT7E29';
UPDATE public.equipamentos SET deposito_suzano = 'CB93' WHERE placa = 'ROG1I40';
UPDATE public.equipamentos SET deposito_suzano = 'CB10' WHERE placa = 'TCC4D15';

NOTIFY pgrst, 'reload schema';
