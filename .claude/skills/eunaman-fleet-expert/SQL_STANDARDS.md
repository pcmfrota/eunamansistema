# Padrões de SQL e Migrations - EUNAMAN Fleet ERP

Este guia define as convenções para a criação de scripts SQL de migração para o banco de dados PostgreSQL do Supabase.

---

## 1. Estrutura do Arquivo de Migration

Toda migration criada em `supabase/migrations/` deve ser organizada de forma clara utilizando comentários para cada etapa:

```sql
-- 1. CRIAR TABELA
CREATE TABLE public.minha_tabela (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- ... outros campos
);

-- 2. CRIAR CHAVES ESTRANGEIRAS E ÍNDICES
ALTER TABLE public.minha_tabela 
    ADD CONSTRAINT minha_tabela_equipamento_id_fkey 
    FOREIGN KEY (equipamento_id) REFERENCES public.equipamentos(id) ON DELETE CASCADE;

CREATE INDEX idx_minha_tabela_equipamento_id ON public.minha_tabela(equipamento_id);

-- 3. HABILITAR RLS
ALTER TABLE public.minha_tabela ENABLE ROW LEVEL SECURITY;

-- 4. CRIAR POLICIES
CREATE POLICY "Permitir leitura de registros para usuários autenticados" 
    ON public.minha_tabela FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Permitir inserção apenas para PCM e Admin" 
    ON public.minha_tabela FOR INSERT 
    TO authenticated 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'pcm')
        )
    );
```

---

## 2. Regra de Data e Hora CRÍTICA (EUNAMAN)

No sistema EUNAMAN, é de vital importância lidar corretamente com a persistência de datas e fusos horários.
* **Datas de Lançamentos/Eventos**: Sempre armazene datas e horários de registros operacionais com o fuso horário exato sem conversões automáticas inesperadas que possam deslocar o dia do evento.
* **Campos `created_at` / `updated_at`**: Use o padrão `TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())` apenas para auditoria de criação do registro no banco.

---

## 3. Gestão de RLS e Policies

* **Privacidade e Segurança**: Nenhuma tabela deve ficar sem RLS. Apenas tabelas de leitura pública (como tabelas estáticas de consulta geral de frota) podem ter políticas irrestritas de SELECT (`USING (true)`).
* **Políticas Granulares**: Crie políticas distintas para cada ação (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) em vez de usar `ALL`.
* **Políticas baseadas no Perfil**: Sempre que um cargo tiver regras específicas (ex: afiadores só podem modificar a tabela de afiação), a política correspondente deve verificar a tabela `public.profiles` comparando `auth.uid()` e a role atribuída ao perfil do usuário.
