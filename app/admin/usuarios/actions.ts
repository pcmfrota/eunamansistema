"use server";

import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

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

  // 1. Atualiza na tabela de perfis (para visualização no app)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId);

  if (profileError) return { error: profileError.message };

  // 2. Atualiza no Auth App Metadata (para permissões de fato no JWT)
  try {
    const adminClient = getAdminClient();
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
    const adminClient = getAdminClient();
    
    // Deleta do Auth (isso cascateia para o profile devido ao ON DELETE CASCADE no SQL)
    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) throw error;

    revalidatePath("/admin/usuarios");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getRolePermissions() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("role_permissions")
    .select("*");

  if (error) return { error: error.message };
  return { permissions: data };
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
