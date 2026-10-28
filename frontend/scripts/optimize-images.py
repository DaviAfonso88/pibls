#!/usr/bin/env python3
"""
Gera os logos, os ícones e as fotos otimizados que o site serve, a partir dos originais em `frontend/assets-src/`
(fora de `public/`, para os 34 MB de fotos cruas não irem para a hospedagem).

    python -I frontend/scripts/optimize-images.py        # precisa só do Pillow; roda na máquina de quem troca as imagens

Saída (commitada, em `frontend/public/`):

  logos/   logo-horizontal.png (painel), logo-slogan-horizontal.png, logo-slogan-vertical.png, simbolo.png e simbolo-96.png
           (cabeçalho e rodapé do site): recortados no conteúdo (os originais são quadrados de 540 px com margem)
  /        favicon.ico, icon-192.png, icon-512.png, apple-touch-icon.png (a partir do símbolo)
  images/  <nome>-{480,800,1200,1600}.webp em 3:2, sem EXIF (o original traz data, aparelho e, às vezes, GPS)

Quem usa as fotos é `~/shared/ui/photo.tsx` (mesmos nomes e larguras); o texto alternativo de cada uma fica em
`~/content/photos.ts`. A imagem de pré-visualização (Open Graph) sai de `scripts/og-default.html`, que usa os logos daqui.
"""

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src"
OUT = ROOT / "public"

WIDTHS = (480, 800, 1200, 1600)
RATIO = (3, 2)
WEBP_QUALITY = 72

# nome publicado -> (arquivo original, recorte opcional em frações do 3:2 já aplicado: centro vertical)
PHOTOS = {
    "congregacao-acolhida": ("MG_0196.jpg", None),
    "louvor": ("MG_0208.jpg", None),
    "adoracao-jovens": ("MG_9566.jpg", None),
    "visitante-acolhido": ("MG_0172.jpg", None),
    "oracao": ("MG_0198.jpg", None),
    # Retrato (4032 × 2268 com a orientação do EXIF): recorta uma faixa 3:2 em volta do copo e do pão
    "ceia": ("20250302_112441.jpg", 0.45),
}

# Retratos redondos (quadrados 1:1): nome publicado -> (arquivo original, centro vertical do recorte, 0 a 1).
# Sem o original, o retrato é pulado: o site mostra as iniciais no lugar (ver `portraits` em `~/content/photos.ts`).
PORTRAITS = {
    "pastor": ("pastor.jpg", 0.4),
}
PORTRAIT_WIDTHS = (160, 320, 480)

LOGOS = {
    # nome publicado: (original, caixa do conteúdo medida no original de 540 × 540)
    "logo-horizontal": ("Logo Principal Horizontal.png", (127, 220, 413, 320)),
    "logo-slogan-horizontal": ("Logo com Slogan Horizontal.png", (80, 220, 460, 320)),
    "logo-slogan-vertical": ("Logo com Slogan Vertical.png", (197, 136, 343, 404)),
    "simbolo": ("Simbolo Principal.png", (83, 83, 457, 457)),
}

def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    print(f"{path.relative_to(ROOT)}  {image.width}x{image.height}  {path.stat().st_size / 1024:.1f} KB")


def make_logos() -> dict[str, Image.Image]:
    cropped: dict[str, Image.Image] = {}
    for name, (original, box) in LOGOS.items():
        image = Image.open(SRC / "logos" / original).convert("RGBA").crop(box)
        cropped[name] = image
        save_png(image, OUT / "logos" / f"{name}.png")

    return cropped


def on_square(symbol: Image.Image, size: int, padding: float, background: tuple[int, int, int, int]) -> Image.Image:
    inner = round(size * (1 - 2 * padding))
    canvas = Image.new("RGBA", (size, size), background)
    scaled = symbol.resize((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(scaled, ((size - inner) // 2, (size - inner) // 2))
    return canvas


def make_icons(symbol: Image.Image) -> None:
    transparent = (255, 255, 255, 0)
    # O símbolo no cabeçalho e no rodapé aparece com 48 px: 96 px cobre a tela de 2x sem baixar os 374 px do original
    save_png(on_square(symbol, 96, 0, transparent), OUT / "logos" / "simbolo-96.png")
    ico = on_square(symbol, 256, 0.02, transparent)
    ico.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"public/favicon.ico  {(OUT / 'favicon.ico').stat().st_size / 1024:.1f} KB")
    save_png(on_square(symbol, 192, 0.04, transparent), OUT / "icon-192.png")
    save_png(on_square(symbol, 512, 0.04, transparent), OUT / "icon-512.png")
    # iOS não aceita transparência: fundo branco e respiro
    save_png(on_square(symbol, 180, 0.1, (255, 255, 255, 255)), OUT / "apple-touch-icon.png")


def crop_3x2(image: Image.Image, center_y: float | None) -> Image.Image:
    width, height = image.size
    target_height = round(width * RATIO[1] / RATIO[0])
    if target_height <= height:
        center = height / 2 if center_y is None else height * center_y
        top = min(max(round(center - target_height / 2), 0), height - target_height)
        return image.crop((0, top, width, top + target_height))
    target_width = round(height * RATIO[0] / RATIO[1])
    left = (width - target_width) // 2
    return image.crop((left, 0, left + target_width, height))


def make_photos() -> None:
    for name, (original, center_y) in PHOTOS.items():
        image = ImageOps.exif_transpose(Image.open(SRC / "images" / original)).convert("RGB")
        image = crop_3x2(image, center_y)
        for width in WIDTHS:
            height = round(width * RATIO[1] / RATIO[0])
            resized = image.resize((width, height), Image.LANCZOS)
            path = OUT / "images" / f"{name}-{width}.webp"
            path.parent.mkdir(parents=True, exist_ok=True)
            # Sem `exif=`: nada de metadados do original no arquivo publicado
            resized.save(path, "WEBP", quality=WEBP_QUALITY, method=6)
            print(f"{path.relative_to(ROOT)}  {width}x{height}  {path.stat().st_size / 1024:.1f} KB")


def crop_square(image: Image.Image, center_y: float) -> Image.Image:
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = min(max(round(height * center_y - side / 2), 0), height - side)
    return image.crop((left, top, left + side, top + side))


def make_portraits(src: Path = SRC, out: Path = OUT) -> None:
    for name, (original, center_y) in PORTRAITS.items():
        source = src / "images" / original
        if not source.exists():
            print(f"retrato {name}: {source.name} não encontrado em assets-src/images/, pulado")
            continue
        image = crop_square(ImageOps.exif_transpose(Image.open(source)).convert("RGB"), center_y)
        for width in PORTRAIT_WIDTHS:
            path = out / "images" / f"{name}-{width}.webp"
            path.parent.mkdir(parents=True, exist_ok=True)
            image.resize((width, width), Image.LANCZOS).save(path, "WEBP", quality=WEBP_QUALITY, method=6)
            print(f"{path.name}  {width}x{width}  {path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    logos = make_logos()
    make_icons(logos["simbolo"])
    make_photos()
    make_portraits()
