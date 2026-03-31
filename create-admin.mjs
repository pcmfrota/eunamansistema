import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Manual .env.local parsing to avoid 'dotenv' dependency
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
  console.error('ERRO: Variáveis de ambiente faltando no .env.local (URL ou Service Role Key)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const email = 'marcos.rocha@eunaman.com.br'
const password = 'eunaman@2026'
const fullName = 'Marcos Rocha'

async function setupAdmin() {
  console.log(`Configurando usuário: ${email}...`)

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) return console.error('Erro:', listError.message);

  let user = users.find(u => u.email === email)

  if (!user) {
    const { data: newData, error: createError } = await supabase.auth.admin.createUser({
      email, 
      password, 
      email_confirm: true, 
      user_metadata: { full_name: fullName },
      app_metadata: { role: 'admin' }
    })
    if (createError) return console.error('Erro ao criar usuário:', createError.message);
    user = newData.user;
    console.log('✅ Usuário criado no Auth com metadados.');
  } else {
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password, 
      email_confirm: true,
      app_metadata: { role: 'admin' }
    })
    if (updateError) return console.error('Erro ao atualizar usuário no Auth:', updateError.message);
    console.log('✅ Usuário atualizado no Auth (senha e cargo).');
  }

  // 2. Garantir que o Perfil exista e tenha o cargo de admin
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id, 
    full_name: fullName, 
    role: 'admin', 
    updated_at: new Date().toISOString()
  });

  if (profileError) return console.error('Erro ao atualizar tabela Profiles:', profileError.message);
  console.log('✅ Tabela Profiles sincronizada com cargo Admin.');

  console.log('\n-----------------------------------')
  console.log('CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!')
  console.log(`E-mail: ${email}`)
  console.log(`Senha: ${password}`)
  console.log('Cargo: Administrador')
  console.log('-----------------------------------\n')
}

setupAdmin()
