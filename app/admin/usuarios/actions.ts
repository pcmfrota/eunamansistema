"use server";

import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { registrarExclusao } from "@/lib/audit-log";

// Helper para operações administrativas (requer SERVICE_ROLE_KEY)
const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export async function getUsers() {
  const supabase = createServerClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");

  if (error) return { error: error.message };
  return { profiles };
}

export async function updateUserRole(userId: string, newRole: string) {
  const supabase = createServerClient();
  
  // Verifica se quem está tentando atualizar é admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== 'admin') {
    return { error: "Apenas administradores podem alterar cargos." };
  }

  // Usa o client de service role para a gravação: a política de RLS de "admin edita
  // qualquer perfil" depende de estado que pode ficar dessincronizado, e nesse caso o
  // update() roda sem erro mas afeta 0 linhas silenciosamente. A autorização acima
  // (checar se quem está chamando é admin) já garante que só um admin chega até aqui.
  const adminClient = getAdminClient();

  // 1. Atualiza na tabela de perfis (para visualização no app)
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId);

  if (profileError) return { error: profileError.message };

  // 2. Atualiza no Auth App Metadata (para permissões de fato no JWT)
  try {
    const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { role: newRole }
    });
    if (authError) throw authError;
  } catch (err: any) {
    console.error("Erro ao sincronizar Auth Metadata:", err.message);
    // Não paramos aqui pois o perfil já foi atualizado, mas avisamos o admin
  }

  revalidatePath("/admin/usuarios");
  return { success: true };
}

export async function createNewUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("full_name") as string;
  const role = formData.get("role") as string;
  const filialId = (formData.get("filial_id") as string) || "MATRIZ";

  try {
    const adminClient = getAdminClient();

    // 1. Cria o usuário no Auth (com auto-confirmação se possível)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmação
      user_metadata: { full_name: fullName },
      app_metadata: { role } // Define o cargo de imediato no token
    });

    if (authError) throw authError;

    // 2. Atualiza o perfil (o trigger handle_new_user já deve ter criado, mas garantimos o role e salvamos a senha em texto plano)
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ 
        role, 
        full_name: fullName,
        filial_id: filialId,
        plain_password: password // Adicionado para gestão administrativa
      })
      .eq("id", authData.user.id);

    if (profileError) throw profileError;

    // 3. Sincroniza com a tabela legado (PCM)
    const { error: legacyError } = await adminClient
      .from("users")
      .upsert({
        email: email,
        senha: password,
        nome: fullName,
        nivel: role === 'admin' ? 1 : 2 // Exemplo de mapeamento de nível
      }, { onConflict: 'email' });

    if (legacyError) {
      console.warn("Aviso: Falha ao sincronizar com tabela legado:", legacyError.message);
    }

    revalidatePath("/admin/usuarios");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Erro ao criar usuário administrador." };
  }
}

export async function deleteUser(userId: string) {
  try {
    const supabase = createServerClient();

    // Captura o snapshot do perfil ANTES de excluir, pois o registro em `profiles`
    // cascateia (e desaparece) assim que o usuário é apagado do Auth.
    let profileSnapshot: any = null;
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, filial_id")
        .eq("id", userId)
        .maybeSingle();
      profileSnapshot = profileData;
    } catch (snapshotErr) {
      console.warn("Falha ao capturar snapshot do perfil antes da exclusão do usuário:", snapshotErr);
    }

    const adminClient = getAdminClient();

    // Deleta do Auth (isso cascateia para o profile devido ao ON DELETE CASCADE no SQL)
    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) throw error;

    await registrarExclusao({
      supabase,
      modulo: "Usuário do Sistema",
      tabelaOrigem: "profiles",
      registroId: userId,
      descricao: `${profileSnapshot?.full_name || profileSnapshot?.email || userId} (${profileSnapshot?.role || ''})`,
      dados: profileSnapshot,
    });

    revalidatePath("/admin/usuarios");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Define diretamente a senha de qualquer usuário (apenas admins)
export async function adminSetUserPassword(userId: string, newPassword: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== 'admin') {
    return { error: "Apenas administradores podem alterar a senha de outros usuários." };
  }

  if (!newPassword || newPassword.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  const adminClient = getAdminClient();

  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
    email_confirm: true,
  });
  if (authError) return { error: authError.message };

  // Sincroniza campos de conveniência administrativa (mesmo padrão de createNewUser)
  await adminClient.from("profiles").update({ plain_password: newPassword }).eq("id", userId);
  if (targetProfile?.email) {
    await adminClient.from("users").update({ senha: newPassword }).eq("email", targetProfile.email);
  }

  revalidatePath("/admin/usuarios");
  return { success: true };
}

// Atualiza a filial de um usuário (apenas admins)
export async function updateUserFilial(userId: string, newFilialId: string) {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== 'admin') {
    return { error: "Apenas administradores podem alterar filiais." };
  }

  // Mesma observação de updateUserRole: usa service role para garantir a gravação.
  const adminClient = getAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({ filial_id: newFilialId })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin/usuarios");
  return { success: true };
}

export async function getRolePermissions() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("role_permissions")
    .select("*");

  if (error) return { error: error.message };
  return { permissions: data };
}

// Lista todas as filiais ativas do banco
export async function getFiliais() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('filiais')
    .select('id, nome, ativo')
    .order('id');

  if (error) return { filiais: [] as { id: string; nome: string; ativo: boolean }[] };
  return { filiais: data as { id: string; nome: string; ativo: boolean }[] };
}

// Cria uma nova filial (apenas admin)
export async function createFilial(formData: FormData) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (adminProfile?.role !== 'admin') {
    return { error: "Apenas administradores podem criar filiais." };
  }

  const nome = (formData.get('nome') as string || '').trim();
  if (!nome) return { error: "Nome da filial é obrigatório." };

  // Gera ID a partir do nome: remove acentos, espaços e caracteres especiais
  const id = nome
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^A-Z0-9]/g, '_')                         // substitui especiais por _
    .replace(/_+/g, '_')                                 // colapsa underscores duplicados
    .replace(/^_|_$/g, '');                              // remove _ inicial/final

  const { error } = await supabase
    .from('filiais')
    .insert({ id, nome, ativo: true });

  if (error) {
    if (error.code === '23505') return { error: `Já existe uma filial com o ID "${id}". Use um nome diferente.` };
    return { error: error.message };
  }

  revalidatePath('/admin/usuarios');
  return { success: true, id, nome };
}


export async function updateRolePermissions(role: string, allowedTabs: string[]) {
  const supabase = createServerClient();
  
  // Verifica se quem está tentando atualizar é admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== 'admin') {
    return { error: "Apenas administradores podem alterar permissões." };
  }

  const { error } = await supabase
    .from("role_permissions")
    .upsert({ 
      role, 
      allowed_tabs: allowedTabs,
      updated_at: new Date().toISOString()
    });

  if (error) return { error: error.message };
  
  revalidatePath("/"); // Revalida para atualizar a sidebar
  return { success: true };
}
