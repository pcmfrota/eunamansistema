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
      email, password, email_confirm: true, user_metadata: { full_name: fullName }
    })
    if (createError) return console.error('Erro:', createError.message);
    user = newData.user;
    console.log('✅ Usuário criado no Auth.');
  } else {
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password, email_confirm: true
    })
    if (updateError) return console.error('Erro:', updateError.message);
    console.log('✅ Usuário atualizado no Auth.');
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id, full_name: fullName, role: 'admin', updated_at: new Date().toISOString()
  });

  if (profileError) return console.error('Erro no Perfil:', profileError.message);

  console.log('\n-----------------------------------')
  console.log('USUÁRIO CONFIGURADO COM SUCESSO!')
  console.log(`E-mail: ${email}`)
  console.log(`Senha: ${password}`)
  console.log('Pode logar agora no localhost:3000')
  console.log('-----------------------------------\n')
}

setupAdmin()
