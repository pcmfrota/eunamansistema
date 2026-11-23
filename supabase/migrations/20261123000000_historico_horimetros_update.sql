-- Correção de leituras do Controle de Horímetro e KM
-- Permite EDITAR uma leitura já lançada (erro de digitação) em historico_horimetros.
-- Antes só existiam as políticas de SELECT e INSERT, então toda edição era bloqueada.
-- Quem pode: quem tem o módulo /preventivas, exceto o perfil visitante.
-- Não altera nem apaga nenhum dado.

DROP POLICY IF EXISTS historico_horimetros_update ON public.historico_horimetros;

CREATE POLICY historico_horimetros_update ON public.historico_horimetros
  FOR UPDATE TO authenticated
  USING (
    public.user_has_module('/preventivas')
    AND COALESCE((SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()), '') <> 'visitante'
  )
  WITH CHECK (
    public.user_has_module('/preventivas')
    AND COALESCE((SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()), '') <> 'visitante'
  );
