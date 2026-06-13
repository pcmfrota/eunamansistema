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
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[AuthService] Erro ao deslogar no cliente Supabase:', e);
    }

    try {
      const { cookies } = require('next/headers');
      const cookieStore = cookies();
      const allCookies = cookieStore.getAll();
      allCookies.forEach((cookie: any) => {
        if (
          cookie.name.startsWith('sb-') || 
          cookie.name.includes('supabase') || 
          cookie.name === 'x-user-role'
        ) {
          cookieStore.set(cookie.name, '', { maxAge: 0, path: '/' });
        }
      });
    } catch (cookieErr) {
      console.error('[AuthService] Erro ao limpar cookies no servidor:', cookieErr);
    }

    return { success: true };
  }

  /**
   * Ensure user data is replicated in the public.profiles table
   * for access from non-auth queries and better RLS support.
   */
  private static async syncProfile(id: string, fullName: string, role: string) {
    const supabase = createClient();
    
    // NÃO sobrescrever se o cargo já estiver definido ou for nulo na metadata
    if (!role) {
      console.log('[AuthService] Pulando sincronização de cargo pois role está ausente na metadata.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id,
        full_name: fullName || 'Usuário',
        role: role,
        updated_at: getCurrentLocalDatetime(),
      }, { onConflict: 'id' });

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
