#!/usr/bin/env pwsh
# =============================================================================
# build-apk.ps1 - Script para compilar o APK do EUNAMAN PCM
# =============================================================================
# Este script:
# 1. Verifica se o JDK e Android SDK estão instalados
# 2. Gera o keystore de assinatura (se não existir)
# 3. Extrai o SHA-256 do certificado para o assetlinks.json
# 4. Compila o APK de release e assina
# =============================================================================

param(
    [string]$KeystorePassword = "eunaman2024",
    [string]$KeyAlias = "eunaman",
    [string]$KeyPassword = "eunaman2024"
)

$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot
$AndroidDir = Join-Path $ProjectDir "android-apk"
$KeystorePath = Join-Path $AndroidDir "eunaman.keystore"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  EUNAMAN PCM - Build APK Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# --- 1. Verificar JAVA_HOME ---
Write-Host "`n[1/5] Verificando Java..." -ForegroundColor Yellow

if (!$env:JAVA_HOME) {
    # Tentar encontrar o JDK do Android Studio (JBR)
    $asJdk = "C:\Program Files\Android\Android Studio\jbr"
    if (Test-Path $asJdk) {
        $env:JAVA_HOME = $asJdk
        $env:PATH = "$asJdk\bin;" + $env:PATH
    } else {
        # Tentar encontrar em C:\Program Files\Eclipse Adoptium\
        $adoptiumPath = Get-ChildItem "C:\Program Files\Eclipse Adoptium\jdk-*" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($adoptiumPath) {
            $env:JAVA_HOME = $adoptiumPath.FullName
            $env:PATH = "$($adoptiumPath.FullName)\bin;" + $env:PATH
        } else {
            # Tentar encontrar em C:\Program Files\Java\
            $javaPath = Get-ChildItem "C:\Program Files\Java\jdk-*" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($javaPath) {
                $env:JAVA_HOME = $javaPath.FullName
                $env:PATH = "$($javaPath.FullName)\bin;" + $env:PATH
            }
        }
    }
}

if ($env:JAVA_HOME) {
    $keytoolPath = Join-Path $env:JAVA_HOME "bin\keytool.exe"
    Write-Host "  Java encontrado: $env:JAVA_HOME" -ForegroundColor Green
} else {
    # Tentar encontrar java no PATH
    $javaCmd = Get-Command java -ErrorAction SilentlyContinue
    if ($javaCmd) {
        Write-Host "  Java encontrado no PATH: $($javaCmd.Source)" -ForegroundColor Green
        # Tentar ver se keytool está no mesmo diretório do java.exe
        $javaDir = Split-Path $javaCmd.Source
        $localKeytool = Join-Path $javaDir "keytool.exe"
        if (Test-Path $localKeytool) {
            $keytoolPath = $localKeytool
        } else {
            $keytoolPath = "keytool"
        }
    } else {
        Write-Host "  ERRO: Java não encontrado!" -ForegroundColor Red
        Write-Host "  Instale o JDK 17+ de: https://adoptium.net/ ou configure a variável de ambiente JAVA_HOME." -ForegroundColor Red
        exit 1
    }
}

# --- 2. Gerar Keystore ---
Write-Host "`n[2/5] Gerando keystore de assinatura..." -ForegroundColor Yellow
if (!(Test-Path $KeystorePath)) {
    Write-Host "  Criando novo keystore..." -ForegroundColor White
    & $keytoolPath -genkey -v `
        -keystore $KeystorePath `
        -alias $KeyAlias `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -storepass $KeystorePassword `
        -keypass $KeyPassword `
        -dname "CN=EUNAMAN PCM, OU=TI, O=EUNAMAN, L=Brasil, S=SP, C=BR"
    Write-Host "  Keystore criado: $KeystorePath" -ForegroundColor Green
} else {
    Write-Host "  Keystore já existe: $KeystorePath" -ForegroundColor Green
}

# --- 3. Extrair SHA-256 para assetlinks.json ---
Write-Host "`n[3/5] Extraindo SHA-256 do certificado..." -ForegroundColor Yellow
$keytoolOutput = & $keytoolPath -list -v `
    -keystore $KeystorePath `
    -alias $KeyAlias `
    -storepass $KeystorePassword 2>&1

$sha256Line = $keytoolOutput | Select-String "SHA256:"
if ($sha256Line) {
    $sha256 = ($sha256Line -split "SHA256:")[1].Trim()
    Write-Host "  SHA-256: $sha256" -ForegroundColor Green
    
    # Atualizar assetlinks.json com o SHA-256 real
    $assetlinksPath = Join-Path $ProjectDir "public\.well-known\assetlinks.json"
    $assetlinks = @(
        @{
            relation = @("delegate_permission/common.handle_all_urls")
            target = @{
                namespace = "android_app"
                package_name = "com.eunaman.pcm"
                sha256_cert_fingerprints = @($sha256)
            }
        }
    )
    $assetlinks | ConvertTo-Json -Depth 10 | Set-Content $assetlinksPath -Encoding UTF8
    Write-Host "  assetlinks.json atualizado com SHA-256 real!" -ForegroundColor Green
    Write-Host "  Arquivo: $assetlinksPath" -ForegroundColor White
} else {
    Write-Host "  AVISO: Não foi possível extrair SHA-256 automaticamente" -ForegroundColor Yellow
    Write-Host "  Execute manualmente: keytool -list -v -keystore android-apk\eunaman.keystore -alias eunaman" -ForegroundColor Yellow
}

# --- 4. Atualizar signing config no build.gradle ---
Write-Host "`n[4/5] Configurando assinatura no build.gradle..." -ForegroundColor Yellow
$buildGradlePath = Join-Path $AndroidDir "app\build.gradle"
$buildGradleContent = Get-Content $buildGradlePath -Raw

# Adicionar signingConfigs se não existir
if ($buildGradleContent -notmatch "signingConfigs") {
    $signingConfig = @"

    signingConfigs {
        release {
            storeFile file('../eunaman.keystore')
            storePassword '$KeystorePassword'
            keyAlias '$KeyAlias'
            keyPassword '$KeyPassword'
        }
    }
"@
    $buildGradleContent = $buildGradleContent -replace "(android \{)", "`$1$signingConfig"
    $buildGradleContent = $buildGradleContent -replace "(release \{)", "`$1`n            signingConfig signingConfigs.release"
    Set-Content $buildGradlePath -Value $buildGradleContent -Encoding UTF8
    Write-Host "  Signing config adicionado ao build.gradle" -ForegroundColor Green
} else {
    Write-Host "  Signing config já existe no build.gradle" -ForegroundColor Green
}

# --- 5. Compilar APK ---
Write-Host "`n[5/5] Compilando APK..." -ForegroundColor Yellow
Set-Location $AndroidDir

# Verificar se gradlew existe
if (!(Test-Path "gradlew.bat")) {
    Write-Host "  AVISO: gradlew.bat não encontrado" -ForegroundColor Yellow
    Write-Host "  Tentando compilar com gradle do sistema..." -ForegroundColor Yellow
    $gradleCmd = "gradle"
} else {
    $gradleCmd = ".\gradlew.bat"
}

try {
    & $gradleCmd assembleRelease
    
    $apkPath = "app\build\outputs\apk\release\app-release.apk"
    if (Test-Path $apkPath) {
        $destPath = Join-Path $ProjectDir "EUNAMAN-PCM-v1.0.0.apk"
        Copy-Item $apkPath $destPath
        Write-Host "`n============================================" -ForegroundColor Green
        Write-Host "  APK GERADO COM SUCESSO!" -ForegroundColor Green
        Write-Host "  Arquivo: $destPath" -ForegroundColor Green
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "`nPróximos passos:" -ForegroundColor Cyan
        Write-Host "  1. Publique o assetlinks.json no servidor (já está em public/.well-known/)" -ForegroundColor White
        Write-Host "  2. Faça o deploy da sua aplicação web" -ForegroundColor White
        Write-Host "  3. Instale o APK no celular ou publique na Play Store" -ForegroundColor White
    } else {
        Write-Host "  Build concluído mas APK não encontrado no caminho esperado" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Erro ao compilar: $_" -ForegroundColor Red
    Write-Host "`n  Para compilar manualmente:" -ForegroundColor Yellow
    Write-Host "  1. Abra a pasta android-apk no Android Studio" -ForegroundColor White
    Write-Host "  2. Build > Generate Signed Bundle / APK" -ForegroundColor White
    Write-Host "  3. Use o keystore em: $KeystorePath" -ForegroundColor White
}

Set-Location $ProjectDir
