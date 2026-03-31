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

  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId);

  if (error) return { error: error.message };
  
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
      user_metadata: { full_name: fullName }
    });

    if (authError) throw authError;

    // 2. Atualiza o perfil (o trigger handle_new_user já deve ter criado, mas garantimos o role)
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ role, full_name: fullName })
      .eq("id", authData.user.id);

    if (profileError) throw profileError;

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
