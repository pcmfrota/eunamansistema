import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const projectPath = 'c:\\Users\\jessi\\OneDrive\\Área de Trabalho\\EUNAMAN SISTEMA\\eunamansistema';

console.log('=== INICIANDO DIAGNÓSTICO DE CONEXÕES ===\n');

// 1. Verificar Git & GitHub
console.log('--- 1. VERIFICANDO GITHUB / GIT ---');
try {
  const gitVersion = execSync('git --version', { cwd: projectPath }).toString().trim();
  console.log(`[OK] Git instalado: ${gitVersion}`);
  
  try {
    const gitRemote = execSync('git remote -v', { cwd: projectPath }).toString().trim();
    if (gitRemote) {
      console.log(`[OK] Repositório Remoto (GitHub) configurado:\n${gitRemote}`);
    } else {
      console.log('[AVISO] Nenhum repositório remoto (GitHub) configurado neste repositório local.');
    }
  } catch (err) {
    console.log('[ERRO] Falha ao ler remotos do Git:', err.message);
  }

  try {
    const gitStatus = execSync('git status -s', { cwd: projectPath }).toString().trim();
    console.log('[INFO] Status do repositório local:');
    console.log(gitStatus || 'Nenhuma alteração pendente (Diretório limpo)');
  } catch (err) {
    console.log('[ERRO] Falha ao rodar git status:', err.message);
  }
} catch (err) {
  console.log('[ERRO] Git não está instalado ou não está no PATH:', err.message);
}

console.log('\n--- 2. VERIFICANDO SUPABASE ---');
// Ler .env.local
const envPath = path.join(projectPath, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim();
  const supabaseAnonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)/)?.[1]?.trim();
  
  console.log(`URL do Supabase encontrada: ${supabaseUrl}`);
  console.log(`Chave Anon encontrada: ${supabaseAnonKey ? supabaseAnonKey.substring(0, 15) + '...' : 'Não encontrada'}`);

  if (supabaseUrl && supabaseAnonKey) {
    console.log('Testando conexão HTTP com o Supabase...');
    // Vamos fazer um request usando fetch (nativo no Node 18+)
    fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    })
    .then(async (res) => {
      console.log(`Status de resposta do Supabase: ${res.status} (${res.statusText})`);
      if (res.status === 200 || res.status === 400 || res.status === 401 || res.status === 404) {
        // Se respondeu, está online e a URL é válida
        console.log('[OK] Conexão com o servidor do Supabase estabelecida com sucesso!');
      } else {
        console.log('[AVISO] O Supabase retornou um status inesperado, mas respondeu.');
      }
      checkVercel();
    })
    .catch((err) => {
      console.log(`[ERRO] Não foi possível conectar ao Supabase: ${err.message}`);
      checkVercel();
    });
  } else {
    console.log('[ERRO] URL ou Chave Anon do Supabase não encontradas no arquivo .env.local.');
    checkVercel();
  }
} else {
  console.log('[ERRO] Arquivo .env.local não encontrado no projeto!');
  checkVercel();
}

function checkVercel() {
  console.log('\n--- 3. VERIFICANDO VERCEL ---');
  // Verificar se há pasta .vercel ou configuração de projeto linkado
  const vercelDotFolder = path.join(projectPath, '.vercel');
  if (fs.existsSync(vercelDotFolder)) {
    console.log('[OK] Pasta de configuração local `.vercel` encontrada. O projeto está vinculado localmente.');
    try {
      const projectJson = JSON.parse(fs.readFileSync(path.join(vercelDotFolder, 'project.json'), 'utf-8'));
      console.log(`ID do Projeto no Vercel: ${projectJson.projectId}`);
      console.log(`ID da Organização no Vercel: ${projectJson.orgId}`);
    } catch (e) {
      console.log('[AVISO] Encontrada pasta .vercel, mas erro ao ler project.json.');
    }
  } else {
    console.log('[AVISO] Pasta de vinculação `.vercel` não encontrada na raiz. O projeto local pode não estar linkado diretamente via Vercel CLI.');
  }

  // Tentar rodar vercel CLI se estiver disponível globalmente ou localmente
  try {
    const vercelWho = execSync('npx vercel whoami', { cwd: projectPath, stdio: 'pipe' }).toString().trim();
    console.log(`[OK] Vercel CLI autenticado como: ${vercelWho}`);
  } catch (err) {
    console.log('[INFO] Vercel CLI não autenticado ou não instalado globalmente (npx vercel whoami falhou).');
  }

  console.log('\n=== FIM DO DIAGNÓSTICO ===');
}
