$projectPath = "c:\Users\jessi\OneDrive\Área de Trabalho\EUNAMAN SISTEMA\eunamansistema"
Write-Output "=== INICIANDO DIAGNÓSTICO DE CONEXÕES (PowerShell) ==="

# 1. Verificar Git & GitHub
Write-Output ""
Write-Output "--- 1. VERIFICANDO GITHUB / GIT ---"
$gitInstalled = $false
try {
    $gitVer = git --version 2>$null
    if ($gitVer) {
        Write-Output "[OK] Git está instalado: $gitVer"
        $gitInstalled = $true
    } else {
        Write-Output "[ERRO] Git não respondeu."
    }
} catch {
    Write-Output "[ERRO] Git não encontrado no sistema."
}

if ($gitInstalled) {
    try {
        $gitRemote = git -C $projectPath remote -v 2>$null
        if ($gitRemote) {
            Write-Output "[OK] Repositório Remoto (GitHub) configurado:"
            Write-Output $gitRemote
        } else {
            Write-Output "[AVISO] Nenhum repositório remoto (GitHub) configurado localmente."
        }
    } catch {
        Write-Output "[ERRO] Falha ao executar git remote."
    }

    try {
        $gitStatus = git -C $projectPath status -s 2>$null
        Write-Output "[INFO] Status Git (arquivos alterados):"
        if ($gitStatus) {
            Write-Output $gitStatus
        } else {
            Write-Output "Nenhuma alteração pendente (diretório limpo)."
        }
    } catch {
        Write-Output "[ERRO] Falha ao executar git status."
    }
}

# 2. Verificar Supabase
Write-Output ""
Write-Output "--- 2. VERIFICANDO SUPABASE ---"
$envPath = Join-Path $projectPath ".env.local"
if (Test-Path $envPath) {
    Write-Output "[OK] Arquivo .env.local encontrado."
    $envContent = Get-Content $envPath
    $supabaseUrl = ""
    $supabaseAnonKey = ""

    foreach ($line in $envContent) {
        if ($line -match "^NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)") {
            $supabaseUrl = $Matches[1].Trim()
        }
        if ($line -match "^NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)") {
            $supabaseAnonKey = $Matches[1].Trim()
        }
    }

    Write-Output "URL do Supabase encontrada: $supabaseUrl"
    if ($supabaseAnonKey) {
        $shortKey = $supabaseAnonKey.Substring(0, [System.Math]::Min(15, $supabaseAnonKey.Length)) + "..."
        Write-Output "Chave Anon encontrada: $shortKey"
    } else {
        Write-Output "Chave Anon não encontrada!"
    }

    if ($supabaseUrl -and $supabaseAnonKey) {
        Write-Output "Testando conexão HTTP com a API Rest do Supabase..."
        try {
            $headers = @{
                "apikey" = $supabaseAnonKey
                "Authorization" = "Bearer $supabaseAnonKey"
            }
            $response = Invoke-WebRequest -Uri "$supabaseUrl/rest/v1/" -Headers $headers -Method Get -TimeoutSec 10 -UseBasicParsing
            Write-Output "[OK] Conexão bem-sucedida! Código de status: $($response.StatusCode) ($($response.StatusDescription))"
        } catch {
            $err = $_
            Write-Output "[AVISO] Teste de conexão retornou resposta ou erro: $($err.Exception.Message)"
            if ($err.Result) {
                Write-Output "Código retornado: $($err.Result.StatusCode)"
            }
        }
    } else {
        Write-Output "[ERRO] Variáveis NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes no .env.local"
    }
} else {
    Write-Output "[ERRO] Arquivo .env.local não encontrado no projeto!"
}

# 3. Verificar Vercel
Write-Output ""
Write-Output "--- 3. VERIFICANDO VERCEL ---"
$vercelFolder = Join-Path $projectPath ".vercel"
if (Test-Path $vercelFolder) {
    Write-Output "[OK] Pasta de configuração local `.vercel` encontrada. O projeto está linkado localmente."
    $projectJsonPath = Join-Path $vercelFolder "project.json"
    if (Test-Path $projectJsonPath) {
        try {
            $projectJson = Get-Content $projectJsonPath | ConvertFrom-Json
            Write-Output "ID do Projeto no Vercel: $($projectJson.projectId)"
            Write-Output "ID da Organização no Vercel: $($projectJson.orgId)"
        } catch {
            Write-Output "[AVISO] Erro ao ler ou converter project.json da Vercel."
        }
    }
} else {
    Write-Output "[AVISO] Pasta `.vercel` não encontrada na raiz. O projeto local não está vinculado diretamente por CLI (pode estar conectado via integração com o GitHub na Vercel)."
}

Write-Output ""
Write-Output "=== FIM DO DIAGNÓSTICO ==="
