--- 1. Sincronizar AUTH.USERS com APP_METADATA 'admin'
-- Substitua pelo ID real se o email não for encontrado ou se houver múltiplos
DO $$
DECLARE
    user_id UUID;
BEGIN
    SELECT id INTO user_id FROM auth.users WHERE email = 'marcos.rocha@eunaman.com.br';
    
    IF user_id IS NOT NULL THEN
        -- Atualiza metadados do Auth (importante para o JWT)
        UPDATE auth.users 
        SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb,
            raw_user_meta_data = raw_user_meta_data || '{"full_name": "Marcos Rocha"}'::jsonb
        WHERE id = user_id;

        -- Sincroniza tabela Profiles (usada na UI principal)
        INSERT INTO public.profiles (id, full_name, role, updated_at)
        VALUES (user_id, 'Marcos Rocha', 'admin', now())
        ON CONFLICT (id) DO UPDATE 
        SET role = 'admin', full_name = 'Marcos Rocha', updated_at = now();

        -- Sincroniza tabela Users (usada no PCM/Triggers legado)
        INSERT INTO public.users (id, nome, perfil, created_at)
        VALUES (user_id, 'Marcos Rocha', 'ADM', now())
        ON CONFLICT (id) DO UPDATE 
        SET perfil = 'ADM', nome = 'Marcos Rocha';

        RAISE NOTICE 'Usuário Marcos Rocha configurado como ADMIN com sucesso!';
    ELSE
        RAISE NOTICE 'ERRO: Usuário não encontrado. Crie o usuário primeiro no dashboard Auth.';
    END IF;
END $$;
