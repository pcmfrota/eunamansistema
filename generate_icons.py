"""
Script para gerar ícones PNG do EUNAMAN PCM para Android
Execute com: python generate_icons.py
Requer: pip install Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ANDROID_RES = os.path.join(BASE_DIR, 'android-apk', 'app', 'src', 'main', 'res')

# Densidades e tamanhos de ícone Android
DENSITIES = {
    'mipmap-mdpi':    48,
    'mipmap-hdpi':    72,
    'mipmap-xhdpi':   96,
    'mipmap-xxhdpi':  144,
    'mipmap-xxxhdpi': 192,
}

# Cores EUNAMAN
COLOR_BG     = (9, 9, 11)       # #09090b
COLOR_CYAN   = (0, 180, 216)    # #00b4d8
COLOR_WHITE  = (255, 255, 255)

def draw_eu_logo(draw, size):
    """Desenha o logo EU na imagem"""
    pad = size * 0.18
    h = size - pad * 2
    w_half = (size / 2) - pad * 0.5
    stroke = max(2, size // 15)

    # === Letra E ===
    ex = pad
    ey = pad
    ew = w_half * 0.85
    eh = h

    # Barra vertical esquerda do E
    draw.rectangle([ex, ey, ex + stroke, ey + eh], fill=COLOR_CYAN)
    # Barra superior do E
    draw.rectangle([ex, ey, ex + ew, ey + stroke], fill=COLOR_CYAN)
    # Barra do meio do E
    mid_y = ey + eh * 0.48
    draw.rectangle([ex, mid_y, ex + ew * 0.85, mid_y + stroke], fill=COLOR_CYAN)
    # Barra inferior do E
    draw.rectangle([ex, ey + eh - stroke, ex + ew, ey + eh], fill=COLOR_CYAN)

    # === Letra U ===
    ux = size / 2 + pad * 0.3
    uy = pad
    uw = w_half * 0.85
    uh = h

    # Barra vertical esquerda do U
    draw.rectangle([ux, uy, ux + stroke, uy + uh * 0.82], fill=COLOR_CYAN)
    # Barra vertical direita do U
    draw.rectangle([ux + uw - stroke, uy, ux + uw, uy + uh * 0.82], fill=COLOR_CYAN)
    # Curva inferior do U (simulada com retângulo arredondado)
    bottom_y = uy + uh * 0.80
    draw.rounded_rectangle(
        [ux, bottom_y, ux + uw, uy + uh],
        radius=stroke * 2,
        fill=COLOR_CYAN
    )

def create_icon(size, output_path):
    """Cria um ícone PNG no tamanho especificado"""
    img = Image.new('RGBA', (size, size), COLOR_BG + (255,))
    draw = ImageDraw.Draw(img)
    draw_eu_logo(draw, size)
    img.save(output_path, 'PNG')
    print(f"  ✓ Criado: {output_path} ({size}x{size})")

def main():
    print("🎨 Gerando ícones EUNAMAN PCM para Android...\n")

    for density, size in DENSITIES.items():
        folder = os.path.join(ANDROID_RES, density)
        os.makedirs(folder, exist_ok=True)

        # Ícone normal
        create_icon(size, os.path.join(folder, 'ic_launcher.png'))
        # Ícone redondo (mesmo design)
        create_icon(size, os.path.join(folder, 'ic_launcher_round.png'))

    print("\n✅ Todos os ícones foram gerados com sucesso!")
    print("\n📱 Próximos passos:")
    print("  1. Abra o projeto android-apk no Android Studio")
    print("  2. Clique em Build > Generate Signed Bundle / APK")
    print("  3. Siga o assistente para criar/usar sua keystore")

if __name__ == '__main__':
    main()
