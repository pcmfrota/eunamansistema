import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Script de Emergência para Reset de Senha Administrativa
// EUNAMAN PCM

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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERRO: Variáveis de ambiente faltando no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const email = 'marcos.rocha@eunaman.com.br'
const newPassword = 'eunaman@2026'

async function resetAdmin() {
  console.log(`\n[REDEFINIÇÃO DE EMERGÊNCIA]`)
  console.log(`Localizando usuário: ${email}...\n`)

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) return console.error('Erro ao listar usuários:', listError.message);

  let user = users.find(u => u.email === email)

  if (!user) {
    console.error(`ERRO: Usuário ${email} não encontrado no sistema.`);
    console.log('DICA: Rode o script "create-admin.mjs" para criar o usuário primeiro.');
    process.exit(1);
  }

  console.log(`Usuário encontrado (ID: ${user.id}). Redefinindo senha...`)

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
    email_confirm: true
  })

  if (updateError) {
    console.error('Erro ao atualizar senha:', updateError.message);
    process.exit(1);
  }

  console.log('\n✅ SENHA ATUALIZADA COM SUCESSO!')
  console.log('-----------------------------------')
  console.log(`E-mail: ${email}`)
  console.log(`Nova Senha: ${newPassword}`)
  console.log('-----------------------------------\n')
}

resetAdmin()
