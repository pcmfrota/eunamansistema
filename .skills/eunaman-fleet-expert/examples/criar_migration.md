# Exemplo: Criar Migration SQL no Supabase

Este documento exemplifica como implementar uma nova migration para o banco de dados Supabase seguindo as melhores práticas e regras do EUNAMAN Fleet ERP.

---

## Estrutura Recomendada do Arquivo `.sql`

Local: `supabase/migrations/[TIMESTAMP]_adicionar_tabela_exemplo.sql`

```sql
-- 1. Criação da Tabela com UUID e Auditoria
CREATE TABLE public.revisoes_equipamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    equipamento_id UUID NOT NULL,
    data_revisao TIMESTAMP WITH TIME ZONE NOT NULL,
    descricao TEXT NOT NULL,
    custo NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
    status VARCHAR(30) DEFAULT 'pendente' NOT NULL,
    
    -- CHECK constraint para status aceitáveis
    CONSTRAINT revisoes_status_check CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'cancelado'))
);

-- 2. Criação da Chave Estrangeira com Cascade
ALTER TABLE public.revisoes_equipamentos
    ADD CONSTRAINT revisoes_equipamentos_equipamento_id_fkey
    FOREIGN KEY (equipamento_id) REFERENCES public.equipamentos(id) ON DELETE CASCADE;

-- 3. Criação de Índice de Performance
CREATE INDEX idx_revisoes_equipamentos_equipamento_id ON public.revisoes_equipamentos(equipamento_id);
CREATE INDEX idx_revisoes_equipamentos_status ON public.revisoes_equipamentos(status);

-- 4. Habilitação de RLS (Row Level Security)
ALTER TABLE public.revisoes_equipamentos ENABLE ROW LEVEL SECURITY;

-- 5. Criação de Políticas de Acesso baseadas em Roles (Cargos)
-- 5.1 Permissão de Leitura para Usuários Autenticados
CREATE POLICY "Permitir leitura para todos autenticados"
    ON public.revisoes_equipamentos FOR SELECT
    TO authenticated
    USING (true);

-- 5.2 Permissão de Gravação apenas para PCM e Administradores
CREATE POLICY "Permitir modificação apenas para PCM e Admin"
    ON public.revisoes_equipamentos FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'pcm')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'pcm')
        )
    );
```

---

## Boas Práticas ao Gerar Migrations:
1. **Sempre adicione RLS**: Nunca deixe uma tabela sem RLS habilitada.
2. **Defina Índices**: Sempre crie índices para chaves estrangeiras e colunas usadas frequentemente para busca ou filtros (como `equipamento_id` e `status`).
3. **Restrições Robustas**: Sempre use restrições de verificação (`CHECK constraints`) para manter a consistência de valores de enums e status no banco de dados.
