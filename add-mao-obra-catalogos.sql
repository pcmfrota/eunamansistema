-- Catálogos de listas suspensas do Apontamento de Mão de Obra: tipo de manutenção,
-- equipe/turno, supervisor, módulo e frente de trabalho — tudo numa tabela genérica
-- de categoria+valor pra dar pra adicionar mais itens depois sem alterar código.

CREATE TABLE IF NOT EXISTS public.mao_obra_catalogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL, -- 'tipo_manutencao' | 'equipe_turno' | 'supervisor' | 'modulo' | 'frente_trabalho'
  valor TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (categoria, valor)
);

CREATE INDEX IF NOT EXISTS idx_mao_obra_catalogos_categoria ON public.mao_obra_catalogos (categoria, ordem);

ALTER TABLE public.mao_obra_catalogos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura autenticada catalogos" ON public.mao_obra_catalogos;
CREATE POLICY "Leitura autenticada catalogos" ON public.mao_obra_catalogos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Escrita autenticada catalogos" ON public.mao_obra_catalogos;
CREATE POLICY "Escrita autenticada catalogos" ON public.mao_obra_catalogos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.mao_obra_catalogos (categoria, valor, ordem) VALUES
  ('tipo_manutencao', 'CORRETIVA EMERGENCIAL', 1),
  ('tipo_manutencao', 'CORRETIVA PROGRAMADA', 2),
  ('tipo_manutencao', 'PREVENTIVA', 3),
  ('tipo_manutencao', 'PREDITIVA', 4),

  ('equipe_turno', '1° TURNO', 1),
  ('equipe_turno', '2° TURNO', 2),
  ('equipe_turno', '3° TURNO', 3),

  ('supervisor', 'GUILHERME NASCIMENTO SAMPAIO', 1),

  ('modulo', 'MÓDULO 05', 1),
  ('modulo', 'MÓDULO 07', 2),
  ('modulo', 'MÓDULO 02', 3),
  ('modulo', 'CARREGAMENTO I', 4),
  ('modulo', 'CARREGAMENTO II', 5),
  ('modulo', 'CARREGAMENTO III', 6),

  ('frente_trabalho', 'HV', 1),
  ('frente_trabalho', 'FW', 2),
  ('frente_trabalho', 'CARREGAMENTO', 3)
ON CONFLICT (categoria, valor) DO NOTHING;


-- Catálogo de apontamentos (o que o colaborador está fazendo), com código — substitui a
-- lista fixa que existia só no código (TIPOS_ATIVIDADE) por uma tabela de verdade,
-- separada em Produtivo/Improdutivo, igual à planilha de referência já usada.

CREATE TABLE IF NOT EXISTS public.mao_obra_apontamentos_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  produtivo BOOLEAN NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mao_obra_apontamentos_catalogo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura autenticada apontamentos catalogo" ON public.mao_obra_apontamentos_catalogo;
CREATE POLICY "Leitura autenticada apontamentos catalogo" ON public.mao_obra_apontamentos_catalogo
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Escrita autenticada apontamentos catalogo" ON public.mao_obra_apontamentos_catalogo;
CREATE POLICY "Escrita autenticada apontamentos catalogo" ON public.mao_obra_apontamentos_catalogo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.mao_obra_apontamentos_catalogo (codigo, descricao, produtivo) VALUES
  ('101', 'ABONADO', false),
  ('102', 'AGUARDANDO EQUIPAMENTO', false),
  ('103', 'ATESTADO MÉDICO', false),
  ('104', 'BANCO DE HORA', false),
  ('105', 'CHUVA', false),
  ('106', 'DESLOCAMENTO P/ SERVIÇO', false),
  ('107', 'FALTA', false),
  ('108', 'FÉRIAS', false),
  ('109', 'FOLGA', false),
  ('110', 'HORARIO DE FOLGA', false),
  ('111', 'HORÁRIO DE REFEIÇÃO', false),
  ('112', 'LAVANDO PEÇAS', false),
  ('113', 'LEVANTAMENTO DE PEÇA', false),
  ('114', 'ORGANIZAÇÃO E LIMPEZA', false),
  ('115', 'REALIZANDO DDS', false),
  ('116', 'TREINAMENTO', false),

  ('201', 'CALIBRAR', true),
  ('202', 'COLETAR', true),
  ('203', 'DESINSTALAR', true),
  ('204', 'FABRICAR', true),
  ('205', 'INSTALAR', true),
  ('206', 'LUBRIFICAR', true),
  ('207', 'MARCAR', true),
  ('208', 'PINTAR', true),
  ('209', 'REAPERTAR', true),
  ('210', 'REGULAR', true),
  ('211', 'REPARAR', true),
  ('212', 'REVISAR', true),
  ('213', 'SOLDAR', true),
  ('214', 'TESTAR', true),
  ('215', 'TROCAR', true),
  ('216', 'VERIFICAR', true)
ON CONFLICT (codigo) DO NOTHING;


-- Cada atividade passa a guardar também o tipo de manutenção e o código do apontamento
-- (referência ao catálogo acima, pra relatório/auditoria).
ALTER TABLE public.apontamentos_mao_obra ADD COLUMN IF NOT EXISTS tipo_manutencao TEXT;
ALTER TABLE public.apontamentos_mao_obra ADD COLUMN IF NOT EXISTS apontamento_codigo TEXT;


-- Garante os colaboradores/mecânicos citados na tabela já existente e usada em outros
-- módulos (Backlog, etc.) — nada é sobrescrito, só insere quem ainda não existe pelo nome.
INSERT INTO public.colaboradores (nome, tipo, status) VALUES
  ('ALDY DE JESUS AGUIAR JUNIOR', 'MECÂNICO', 'Ativo'),
  ('CLEIDSON LUCAS DE SOUZA OLIVEIRA', 'MECÂNICO', 'Ativo'),
  ('DAVIT MENEZES DA SILVA', 'MECÂNICO', 'Ativo'),
  ('GEARLISON LOPES BOGEA', 'MECÂNICO', 'Ativo'),
  ('GUILHERME NASCIMENTO SAMPAIO', 'MECÂNICO', 'Ativo'),
  ('IGOR SANTIAGO DE SOUSA', 'MECÂNICO', 'Ativo'),
  ('JOAO VICTOR FERNANDES BRITO', 'MECÂNICO', 'Ativo'),
  ('ROBESON GOMES DA SILVA', 'MECÂNICO', 'Ativo'),
  ('RODRIGO DA SILVA PANTOJA', 'MECÂNICO', 'Ativo'),
  ('RODRIGO DA SILVA PEREIRA', 'MECÂNICO', 'Ativo'),
  ('RONALD GONÇALVES DE SOUZA', 'MECÂNICO', 'Ativo'),
  ('GENIVAL DA COSTA SILVA', 'MECÂNICO', 'Ativo'),
  ('LUMA BARBOSA DE SOUSA', 'MECÂNICO', 'Ativo'),
  ('BARBARA CRISTINA ARAUJO DA SILVA', 'MECÂNICO', 'Ativo'),
  ('MANOEL ANTONIO PEREIRA NETO', 'MECÂNICO', 'Ativo'),
  ('THIAGO DA SILVA SOUSA', 'MECÂNICO', 'Ativo'),
  ('FRANCISCO SOARES DE ARAÚJO SILVA', 'MECÂNICO', 'Ativo'),
  ('EDUARDO DOS REIS SOUSA', 'MECÂNICO', 'Ativo')
ON CONFLICT (nome) DO NOTHING;
