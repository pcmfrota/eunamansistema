import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Script para Redefinição de Senha de Usuários
// Uso: node reset-user.mjs <email> <nova_senha>

const email = process.argv[2]
const newPassword = process.argv[3]

if (!email || !newPassword) {
  console.error('ERRO: Informe o e-mail e a nova senha.')
  console.log('Exemplo: node reset-user.mjs joao@eunaman.com.br senha123')
  process.exit(1)
}

let supabaseUrl = '';
let supabaseServiceKey = '';

try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=([^\s]+)/)?.[1];
  supabaseServiceKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=([^\s]+)/)?.[1];
} catch (e) {
  console.error('ERRO: Não foi possível ler o arquivo .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function resetUser() {
  console.log(`\nIniciando redefinição para: ${email}...`)

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) return console.error('Erro:', listError.message);

  let user = users.find(u => u.email.toLowerCase() === email.toLowerCase())

  if (!user) {
    console.error(`ERRO: Usuário ${email} não encontrado.`);
    process.exit(1);
  }

  // 1. Atualizar no Auth
  const { error: authError } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
    email_confirm: true
  })

  if (authError) {
    console.error('Erro ao atualizar no Auth:', authError.message);
    process.exit(1);
  }

  // 2. Sincronizar campo plain_password na tabela profiles para consulta futura
  await supabase
    .from('profiles')
    .update({ plain_password: newPassword })
    .eq('id', user.id);

  console.log('✅ SENHA ATUALIZADA COM SUCESSO!')
  console.log(`Usuário: ${user.email}`)
  console.log(`Nova Senha: ${newPassword}\n`)
}

resetUser()
