'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { AuthService } from '@/src/services/AuthService'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    await AuthService.signIn(email, password);
  } catch (error: any) {
    redirect(`/login?error=${encodeURIComponent(error.message || 'Erro ao entrar')}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  await AuthService.signOut();
  revalidatePath('/', 'layout')
  redirect('/login')
}
