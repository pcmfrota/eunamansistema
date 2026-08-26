# Exemplo: Criar Módulo de Abastecimento

Este guia exemplifica como a Skill responde à instrução "Crie o módulo de Abastecimento".

---

## Passo 1: Criação da Migration SQL
Primeiro, criamos a estrutura do banco em `supabase/migrations/20260708_create_abastecimento_table.sql`:

```sql
CREATE TABLE public.abastecimento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    data_abastecimento TIMESTAMP WITH TIME ZONE NOT NULL,
    frota_id UUID NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
    combustivel VARCHAR(50) NOT NULL,
    litros NUMERIC(10,2) NOT NULL,
    odometro NUMERIC(10,2) NOT NULL,
    operador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Habilitar RLS
ALTER TABLE public.abastecimento ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Leitura pública para autenticados" ON public.abastecimento
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Modificação apenas para pcm, admin e motorista" ON public.abastecimento
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'pcm', 'motorista')
        )
    );
```

---

## Passo 2: Definição dos Tipos TypeScript
Definimos a interface em `app/abastecimento/types.ts`:

```typescript
export interface Abastecimento {
  id: string;
  created_at: string;
  data_abastecimento: string;
  frota_id: string;
  combustivel: string;
  litros: number;
  odometro: number;
  operador_id: string | null;
  frota?: {
    placa: string;
  };
}
```

---

## Passo 3: Server Actions (`actions.ts`)
Criamos as chamadas de banco seguras em `app/abastecimento/actions.ts`:

```typescript
"use server";
import { createClient } from "@/utils/supabase/server";

export async function getAbastecimentos() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("abastecimento")
    .select("*, frota:equipamentos(placa)")
    .order("data_abastecimento", { ascending: false });
  return { data, error };
}

export async function salvarAbastecimento(record: any) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("abastecimento")
    .upsert(record)
    .select();
  return { data, error };
}
```

---

## Passo 4: Integração do Menu e Layout
Modificamos o arquivo do menu lateral `components/main-layout.tsx` para adicionar o novo link:

```tsx
// Adicionando no array de itens de navegação
{
  label: "ABASTECIMENTO",
  path: "/abastecimento",
  icon: FuelIcon, // Importado de lucide-react
}
```
E inserimos o novo módulo na regra de permissões de rota dos cargos na tabela `role_permissions`.
