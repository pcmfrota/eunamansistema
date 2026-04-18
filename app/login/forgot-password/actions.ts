'use server'

import { redirect } from 'next/navigation'
import { AuthService } from '@/src/services/AuthService'

export async function forgotPassword(formData: FormData) {
  const email = formData.get('email') as string

  try {
    await AuthService.resetPassword(email);
  } catch (error: any) {
    redirect(`/login/forgot-password?error=${encodeURIComponent(error.message || 'Erro ao enviar e-mail')}`)
  }

  redirect('/login/forgot-password?success=true')
}

export async function resetPassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (password !== confirmPassword) {
    redirect(`/login/reset-password?error=${encodeURIComponent('As senhas não coincidem')}`)
  }

  try {
    await AuthService.updatePassword(password);
  } catch (error: any) {
    redirect(`/login/reset-password?error=${encodeURIComponent(error.message || 'Erro ao atualizar senha')}`)
  }

  redirect('/login?message=Senha atualizada com sucesso')
}
