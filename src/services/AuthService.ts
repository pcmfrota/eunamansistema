import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';
import { getCurrentLocalDatetime } from '../utils/dateUtils';

const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export class AuthService {
  static async signIn(email: string, password: string) {
    const validated = LoginSchema.parse({ email, password });
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (error) {
      throw new Error('Credenciais inválidas ou erro no servidor');
    }

    // Sync profile for extra reliability
    if (data.user) {
      await this.syncProfile(data.user.id, data.user.user_metadata?.full_name, data.user.user_metadata?.role);
    }

    return { success: true, user: data.user };
  }

  static async signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    return { success: true };
  }

  /**
   * Ensure user data is replicated in the public.profiles table
   * for access from non-auth queries and better RLS support.
   */
  private static async syncProfile(id: string, fullName: string, role: string) {
    const supabase = createClient();
    
    // Standardize role if missing
    const standardRole = role || 'visitante';

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id,
        full_name: fullName || 'Usuário',
        role: standardRole,
        updated_at: getCurrentLocalDatetime(),
      });

    if (error) {
      console.error('Falha ao sincronizar perfil do usuário:', error.message);
    }
  }

  static async getCurrentUser() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  static async resetPassword(email: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login/reset-password`,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  }

  static async updatePassword(password: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      throw new Error(error.message);
    }

    // Opcional: Atualizar a senha em texto plano se o usuário logado tiver permissão ou se for para o próprio perfil
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Atualiza na tabela de perfis (Next.js)
      await supabase
        .from('profiles')
        .update({ plain_password: password })
        .eq('id', user.id);
        
      // Atualiza na tabela legado (PCM) se houver o e-mail
      if (user.email) {
        await supabase
          .from('users')
          .update({ senha: password })
          .eq('email', user.email);
      }
    }

    return { success: true };
  }
}
