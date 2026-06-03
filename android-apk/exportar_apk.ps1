# Script para gerar e exportar o APK
Write-Host "Iniciando build do APK..." -ForegroundColor Cyan

# Define o JAVA_HOME para usar o JDK do Android Studio (necessário para AGP 8.x)
$asJdk = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $asJdk) {
    $env:JAVA_HOME = $asJdk
    $env:PATH = "$asJdk\bin;" + $env:PATH
}

./gradlew assembleDebug

if ($?) {
    $destino = "C:\eunaman-apk"
    if (!(Test-Path $destino)) {
        New-Item -ItemType Directory -Path $destino
    }

    Copy-Item "app/build/outputs/apk/debug/app-debug.apk" "$destino\eunaman-debug.apk" -Force
    Write-Host "APK exportado com sucesso para $destino\eunaman-debug.apk" -ForegroundColor Green
    Start-Process $destino
} else {
    Write-Host "Erro ao gerar o APK. Verifique os logs acima." -ForegroundColor Red
    Write-Host "Dica: Certifique-se de que o Android Studio está instalado em C:\Program Files\Android\Android Studio" -ForegroundColor Yellow
}
