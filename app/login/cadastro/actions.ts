'use server';

import { createClient } from '@supabase/supabase-js';

// Mesmo helper de app/admin/usuarios/actions.ts — precisa da service role pra criar
// o usuário no Auth (isso é uma rota pública, sem sessão de admin nenhuma por trás).
const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const CARGOS_VALIDOS = ['motorista', 'mecanico', 'pcm', 'admin', 'gestao', 'afiador', 'visitante'];

export async function solicitarCadastro(formData: FormData) {
  try {
    const nome = ((formData.get('nome') as string) || '').trim();
    const sobrenome = ((formData.get('sobrenome') as string) || '').trim();
    const email = ((formData.get('email') as string) || '').trim().toLowerCase();
    const password = (formData.get('password') as string) || '';
    const cargoSolicitado = (formData.get('cargo') as string) || '';

    if (!nome) throw new Error('Informe o nome.');
    if (!email) throw new Error('Informe o e-mail.');
    if (!password || password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
    if (!CARGOS_VALIDOS.includes(cargoSolicitado)) throw new Error('Selecione um cargo válido.');

    const fullName = `${nome} ${sobrenome}`.trim();
    const adminClient = getAdminClient();

    // Cria a conta de verdade no Auth (a senha já fica segura lá), mas SEM app_metadata.role —
    // o gatilho handle_new_user cria o perfil com o padrão seguro 'visitante'. O cargo pedido
    // só vira o role de verdade quando um admin aprovar (ver aprovarUsuario em
    // app/admin/usuarios/actions.ts); até lá o login fica bloqueado por status='pendente'.
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      const msg = (authError.message || '').toLowerCase();
      if (msg.includes('already') && msg.includes('registered')) {
        throw new Error('Já existe uma conta cadastrada com esse e-mail.');
      }
      throw authError;
    }

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        full_name: fullName,
        email,
        status: 'pendente',
        cargo_solicitado: cargoSolicitado,
      })
      .eq('id', authData.user.id);

    if (profileError) throw profileError;

    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Erro ao enviar solicitação de cadastro.' };
  }
}
