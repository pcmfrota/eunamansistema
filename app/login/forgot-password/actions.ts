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
