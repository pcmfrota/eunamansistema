-- Remove as 4 abas (Indicadores, PCM, Semanal, Afiação) do sistema de
-- autorização por indivíduo. As rotas/telas já foram apagadas do código-fonte
-- (app/indicadores, app/pcm, app/semanal, e os componentes de UI de
-- app/afiacao — mantendo app/afiacao/actions.ts e materiaisDB.ts, usados pela
-- fila de sincronização offline para reproduzir gravações já enfileiradas).
--
-- NÃO apaga nenhuma tabela nem dado de negócio: afiacao, aux_afiacao e tudo
-- que os módulos de Indicadores/PCM/Semanal liam (equipamentos, ordens_servico,
-- preventivas) permanecem intactos — só a concessão de acesso é removida.
delete from public.user_module_permissions
where modulo in ('/indicadores', '/pcm', '/semanal', '/afiacao');
