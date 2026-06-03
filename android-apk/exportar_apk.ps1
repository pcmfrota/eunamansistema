# Script para gerar e exportar o APK
Write-Host "Iniciando build do APK..." -ForegroundColor Cyan

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
}
