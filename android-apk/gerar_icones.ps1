# Script para gerar ícones Android a partir de uma imagem base
$sourceFile = "logo_novo.png"
$resDir = "app/src/main/res"

if (!(Test-Path $sourceFile)) {
    Write-Host "Arquivo $sourceFile nao encontrado!" -ForegroundColor Red
    exit
}

# Define o caminho do Magick (se disponível) ou usa o PowerShell para redimensionar
# Como não temos garantia de Magick, vamos usar o .NET para redimensionar via GDI+
Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param($path, $width, $height, $output)
    $img = [System.Drawing.Image]::FromFile($path)
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $graph = [System.Drawing.Graphics]::FromImage($bmp)
    $graph.DrawImage($img, 0, 0, $width, $height)
    $bmp.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
    $graph.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($folder in $sizes.Keys) {
    $targetDir = Join-Path $resDir $folder
    if (!(Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir }
    $size = $sizes[$folder]
    Write-Host "Gerando icone para $folder ($size x $size)..."
    Resize-Image -path $sourceFile -width $size -height $size -output (Join-Path $targetDir "ic_launcher.png")
    Resize-Image -path $sourceFile -width $size -height $size -output (Join-Path $targetDir "ic_launcher_round.png")
}

Write-Host "Icones gerados com sucesso!" -ForegroundColor Green
