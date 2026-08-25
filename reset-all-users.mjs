import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Script para Redefinição Global de Senhas
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
const newPassword = '123456789'

async function resetAll() {
  console.log(`\n[RESET GLOBAL DE SENHAS]`)
  console.log(`Buscando todos os usuários...\n`)

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) return console.error('Erro ao listar usuários:', listError.message);

  console.log(`Encontrados ${users.length} usuários. Iniciando atualização...\n`)

  for (const user of users) {
    console.log(`Atualizando: ${user.email}...`)

    // 1. Atualizar no Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
      email_confirm: true
    })

    if (authError) {
      console.error(`  - Falha no Auth: ${authError.message}`);
      continue;
    }

    console.log(`  - ✅ Sucesso`);
  }

  console.log('\n-----------------------------------')
  console.log('REDEFINIÇÃO GLOBAL CONCLUÍDA!')
  console.log(`Senha padrão definida: ${newPassword}`)
  console.log('-----------------------------------\n')
}

resetAll()
