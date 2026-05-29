# Script PowerShell para gerar ícones PNG do EUNAMAN PCM para Android
# Execute no PowerShell: .\gerar_icones.ps1
# Não requer instalação de nada - usa .NET nativo do Windows

Add-Type -AssemblyName System.Drawing

$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResDir = Join-Path $BaseDir "android-apk\app\src\main\res"

# Densidades e tamanhos
$densidades = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}

# Cores EUNAMAN
$corFundo  = [System.Drawing.Color]::FromArgb(255, 9, 9, 11)      # #09090b
$corCyan   = [System.Drawing.Color]::FromArgb(255, 0, 180, 216)   # #00b4d8

function Criar-Icone {
    param($tamanho, $caminhoSaida)
    
    $bmp = New-Object System.Drawing.Bitmap($tamanho, $tamanho)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    
    # Fundo escuro
    $g.Clear($corFundo)
    
    $pad   = [int]($tamanho * 0.16)
    $s     = $tamanho - ($pad * 2)
    $stroke = [Math]::Max(2, [int]($tamanho / 13))
    $half  = [int]($s / 2) - [int]($stroke / 2)
    
    $brush = New-Object System.Drawing.SolidBrush($corCyan)
    
    # === Letra E ===
    $ex = $pad
    $ey = $pad
    $ew = [int]($half * 0.88)
    $eh = $s
    
    # Barra vertical esquerda
    $g.FillRectangle($brush, $ex, $ey, $stroke, $eh)
    # Barra superior
    $g.FillRectangle($brush, $ex, $ey, $ew, $stroke)
    # Barra do meio
    $midY = $ey + [int]($eh * 0.46)
    $g.FillRectangle($brush, $ex, $midY, [int]($ew * 0.82), $stroke)
    # Barra inferior
    $g.FillRectangle($brush, $ex, $ey + $eh - $stroke, $ew, $stroke)
    
    # === Letra U ===
    $ux = $pad + $half + [int]($pad * 0.4)
    $uy = $pad
    $uw = [int]($half * 0.88)
    $uh = $s
    
    # Barra vertical esquerda do U
    $g.FillRectangle($brush, $ux, $uy, $stroke, [int]($uh * 0.80))
    # Barra vertical direita do U
    $g.FillRectangle($brush, $ux + $uw - $stroke, $uy, $stroke, [int]($uh * 0.80))
    # Parte inferior arredondada (simulada)
    $bottomY  = $uy + [int]($uh * 0.78)
    $bottomH  = $uh - [int]($uh * 0.78)
    $g.FillRectangle($brush, $ux, $bottomY, $uw, $bottomH)
    # Arredondamento
    $radius = [int]($stroke * 1.5)
    $g.FillEllipse($brush, $ux, $bottomY + $bottomH - ($radius * 2), $radius * 2, $radius * 2)
    $g.FillEllipse($brush, $ux + $uw - ($radius * 2), $bottomY + $bottomH - ($radius * 2), $radius * 2, $radius * 2)
    
    $brush.Dispose()
    $g.Dispose()
    
    # Salvar
    $bmp.Save($caminhoSaida, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    
    Write-Host "  ✓ $caminhoSaida ($tamanho x $tamanho)" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎨 Gerando ícones EUNAMAN PCM para Android..." -ForegroundColor Cyan
Write-Host ""

foreach ($densidade in $densidades.GetEnumerator()) {
    $pasta = Join-Path $ResDir $densidade.Key
    if (-not (Test-Path $pasta)) {
        New-Item -ItemType Directory -Path $pasta -Force | Out-Null
    }
    
    $tamanho = $densidade.Value
    
    # Ícone normal
    Criar-Icone -tamanho $tamanho -caminhoSaida (Join-Path $pasta "ic_launcher.png")
    # Ícone redondo
    Criar-Icone -tamanho $tamanho -caminhoSaida (Join-Path $pasta "ic_launcher_round.png")
}

Write-Host ""
Write-Host "✅ Todos os ícones foram gerados com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Próximos passos:" -ForegroundColor Yellow
Write-Host "  1. Abra a pasta 'android-apk' no Android Studio"
Write-Host "  2. Aguarde o Gradle sincronizar"
Write-Host "  3. Build > Generate Signed Bundle / APK"
Write-Host "  4. Siga o assistente para criar sua keystore"
Write-Host ""
