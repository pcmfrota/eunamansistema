-- Controle de Baterias escolhe o fornecedor do cadastro do Controle de Custos.
-- Quem tem o módulo de baterias passa a LER os fornecedores da própria filial (só leitura;
-- criar/editar/excluir continua exclusivo do módulo /custos pela policy existente).

DROP POLICY IF EXISTS "custos_fornecedores_leitura_baterias" ON public.custos_fornecedores;
CREATE POLICY "custos_fornecedores_leitura_baterias" ON public.custos_fornecedores
  FOR SELECT TO authenticated
  USING (public.user_has_module('/controle-baterias') AND (public.is_admin_user() OR filial_id = public.get_user_filial()));

NOTIFY pgrst, 'reload schema';
