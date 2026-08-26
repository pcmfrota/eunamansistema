-- Histórico de atualizações de horímetro/km do Controle de Horímetros
-- (Preventivas — veículos Pesados, Leves e Implemento Zocar).
-- Toda vez que o horímetro/km de um equipamento é atualizado — seja pelo
-- formulário "Novo Apontamento" ou pela edição manual direto na tabela —
-- um registro é gravado aqui com: quando, placa, valor anterior, valor novo,
-- origem da atualização e quem atualizou.

CREATE TABLE IF NOT EXISTS public.historico_horimetros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  equipamento_id UUID REFERENCES public.equipamentos(id),
  placa TEXT NOT NULL,            -- snapshot da placa no momento da atualização
  tipo TEXT,                      -- snapshot do tipo do equipamento (ex: 'MUNCK', 'CARRO')
  categoria TEXT,                 -- snapshot da categoria ('PESADA' | 'LEVE')

  unidade TEXT NOT NULL DEFAULT 'h', -- 'h' (horímetro) ou 'km'
  valor_anterior NUMERIC,
  valor_novo NUMERIC NOT NULL,

  origem TEXT NOT NULL DEFAULT 'EDICAO_MANUAL', -- NOVO_APONTAMENTO | EDICAO_MANUAL
  observacoes TEXT,

  atualizado_por UUID REFERENCES auth.users(id),
  atualizado_por_nome TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_horimetros_equipamento ON public.historico_horimetros(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_historico_horimetros_atualizado_em ON public.historico_horimetros(atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_historico_horimetros_placa ON public.historico_horimetros(placa);

ALTER TABLE public.historico_horimetros ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode inserir (é o próprio backend registrando a atualização que ele fez).
DROP POLICY IF EXISTS "Permitir insercao autenticada" ON public.historico_horimetros;
CREATE POLICY "Permitir insercao autenticada" ON public.historico_horimetros
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura autenticada" ON public.historico_horimetros;
CREATE POLICY "Permitir leitura autenticada" ON public.historico_horimetros
  FOR SELECT TO authenticated USING (true);

-- Sem policy de UPDATE/DELETE: com RLS habilitado e nenhuma policy para essas
-- operações, ninguém (fora o service_role) altera ou apaga um registro de
-- histórico pela chave anon/authenticated. É um histórico, não deve ser editável.
