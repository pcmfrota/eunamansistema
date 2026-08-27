-- Histórico/auditoria de apontamentos individuais da jornada de mão de obra.
--
-- Por quê: a jornada (fichas_mao_obra) é reaberta e continuada por VÁRIOS
-- colaboradores ao mesmo tempo, cada um pelo próprio celular, ao longo do
-- dia inteiro. Guardar as atividades como um único JSONB reescrito por
-- inteiro a cada "Salvar" corre risco real de sobrescrita: se o app fecha
-- e reabre, ou o colaborador troca de aparelho, o último "Salvar" vence e
-- apontamentos feitos entre uma sessão e outra podem se perder.
--
-- Cada atividade agora é sua própria linha, inserida no momento em que o
-- colaborador confirma o apontamento — não depende de um "Salvar" geral da
-- ficha. Isso também é o histórico diário em si: cada linha já carrega
-- quando foi de fato registrada no sistema (criado_em/registrado_por),
-- distinto de quando a atividade aconteceu (hora_inicio/hora_fim).

CREATE TABLE IF NOT EXISTS public.apontamentos_mao_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  jornada_id UUID NOT NULL REFERENCES public.fichas_mao_obra(id) ON DELETE CASCADE,

  tipo_atividade TEXT NOT NULL,
  produtivo BOOLEAN NOT NULL DEFAULT false,
  placa TEXT,
  descricao TEXT,
  hora_inicio TEXT,
  hora_fim TEXT,
  tempo_gasto_minutos INTEGER DEFAULT 0,

  registrado_por UUID REFERENCES auth.users(id),
  registrado_por_nome TEXT,

  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apontamentos_mao_obra_jornada ON public.apontamentos_mao_obra (jornada_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_mao_obra_criado_em ON public.apontamentos_mao_obra (criado_em DESC);

ALTER TABLE public.apontamentos_mao_obra ENABLE ROW LEVEL SECURITY;

-- Mesmo nível de permissão já usado em fichas_mao_obra (autorização de edição/exclusão fica na camada da aplicação).
DROP POLICY IF EXISTS "Leitura autenticada de apontamentos" ON public.apontamentos_mao_obra;
CREATE POLICY "Leitura autenticada de apontamentos" ON public.apontamentos_mao_obra
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insercao autenticada de apontamentos" ON public.apontamentos_mao_obra;
CREATE POLICY "Insercao autenticada de apontamentos" ON public.apontamentos_mao_obra
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Atualizacao autenticada de apontamentos" ON public.apontamentos_mao_obra;
CREATE POLICY "Atualizacao autenticada de apontamentos" ON public.apontamentos_mao_obra
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Exclusao autenticada de apontamentos" ON public.apontamentos_mao_obra;
CREATE POLICY "Exclusao autenticada de apontamentos" ON public.apontamentos_mao_obra
  FOR DELETE TO authenticated USING (true);
