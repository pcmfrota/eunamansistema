# Script para gerar e exportar o APK
Write-Host "Iniciando build do APK..." -ForegroundColor Cyan

# Define o JAVA_HOME para usar o JDK do Android Studio (necessário para AGP 8.x)
$asJdk = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $asJdk) {
    $env:JAVA_HOME = $asJdk
    $env:PATH = "$asJdk\bin;" + $env:PATH
}

# Rebuilda o field-app e sincroniza o bundle pros assets do Android ANTES de empacotar o
# APK. Sem isso, o Gradle empacota silenciosamente o que já estiver em
# app/src/main/assets/field-app (podendo ficar dias/semanas desatualizado em relação ao
# código-fonte de field-app/, já que nada mais faz essa cópia automaticamente).
Write-Host "Buildando field-app (Vite)..." -ForegroundColor Cyan
Push-Location ../field-app
npm run build
$fieldAppBuildOk = $?
Pop-Location

if (-not $fieldAppBuildOk) {
    Write-Host "Erro ao buildar o field-app. Abortando (APK NAO foi gerado com bundle desatualizado)." -ForegroundColor Red
    exit 1
}

$assetsDest = "app/src/main/assets/field-app"
if (Test-Path $assetsDest) {
    Remove-Item "$assetsDest/*" -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $assetsDest | Out-Null
}
Copy-Item "../field-app/dist/*" $assetsDest -Recurse -Force
Write-Host "Assets do field-app sincronizados em $assetsDest" -ForegroundColor Cyan

./gradlew assembleRelease

if ($?) {
    $destino = "C:\eunaman-apk"
    if (!(Test-Path $destino)) {
        New-Item -ItemType Directory -Path $destino
    }

    Copy-Item "app/build/outputs/apk/release/app-release.apk" "$destino\eunaman.apk" -Force
    Write-Host "APK de produção (Release) exportado com sucesso para $destino\eunaman.apk" -ForegroundColor Green
    Start-Process $destino
} else {
    Write-Host "Erro ao gerar o APK. Verifique os logs acima." -ForegroundColor Red
    Write-Host "Dica: Certifique-se de que o Android Studio está instalado em C:\Program Files\Android\Android Studio" -ForegroundColor Yellow
}
