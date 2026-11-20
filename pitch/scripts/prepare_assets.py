"""Prépare les ressources communes du pitch (deck + vidéo) dans pitch/assets/.

- logo NeuroCare sur fond transparent (le PNG officiel a un fond bleu très clair) ;
- police Ionicons et table des glyphes (les mêmes icônes que l'application) ;
- icônes PNG colorées pour le deck ;
- QR code vers le dépôt GitHub.

Usage : python pitch/scripts/prepare_assets.py
"""
import json
import shutil
from pathlib import Path

import numpy as np
import qrcode
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'pitch' / 'assets'
ICONS = ASSETS / 'icons'
LOGO = ROOT / 'mobile' / 'assets' / 'images' / 'neurocare-logo.png'
VECTOR = ROOT / 'mobile' / 'node_modules' / '@expo' / 'vector-icons' / 'build' / 'vendor' / 'react-native-vector-icons'
REPO_URL = 'https://github.com/Ziadelyazidi07/NeuroCare1'

# Icônes du deck : nom Ionicons -> couleur.
DECK_ICONS = {
    'medkit': '#246BFD', 'pulse': '#0EA5E9', 'leaf': '#7C3AED', 'water': '#F59E0B', 'heart': '#EF4444',
    'extension-puzzle': '#10B981', 'mic': '#246BFD', 'checkmark-circle': '#10B981', 'language': '#246BFD',
    'cloud-offline': '#112950', 'shield-checkmark': '#10B981', 'call': '#EF4444', 'people': '#246BFD',
    'document-text': '#112950', 'grid': '#246BFD', 'medical': '#10B981', 'alarm': '#EF4444', 'eye-off': '#F59E0B',
    'storefront': '#10B981', 'business': '#246BFD', 'home': '#10B981', 'school': '#246BFD', 'heart-circle': '#EF4444',
    'play-circle': '#246BFD', 'server': '#112950', 'phone-portrait': '#246BFD', 'flask': '#7C3AED',
    'git-branch': '#112950', 'lock-closed': '#112950', 'sparkles': '#F59E0B', 'hand-left': '#10B981',
}


def transparent_logo() -> None:
    src = np.asarray(Image.open(LOGO).convert('RGB')).astype(float)
    edge = np.concatenate([src[:20].reshape(-1, 3), src[-20:].reshape(-1, 3)])
    bg = np.median(edge, axis=0)
    alpha = np.clip((np.sqrt(((src - bg) ** 2).sum(-1)) - 10) / 25, 0, 1)
    # Défait le mélange avec le fond pour garder des bords nets sur n'importe quel fond.
    a = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip((src - bg * (1 - a)) / a, 0, 255)
    rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    img = img.crop(img.getbbox())
    img.save(ASSETS / 'neurocare-logo-transparent.png', optimize=True)
    # Variante sans le mot « NeuroCare » (pictogramme seul) : partie au-dessus du texte.
    w, h = img.size
    rows = np.asarray(img)[..., 3].max(axis=1)
    gap = next(y for y in range(int(h * 0.55), h) if rows[y] == 0)
    mark = img.crop((0, 0, w, gap))
    mark.crop(mark.getbbox()).save(ASSETS / 'neurocare-mark.png', optimize=True)


def icons() -> None:
    ICONS.mkdir(parents=True, exist_ok=True)
    font_path = VECTOR / 'Fonts' / 'Ionicons.ttf'
    glyphs = json.loads((VECTOR / 'glyphmaps' / 'Ionicons.json').read_text(encoding='utf-8'))
    shutil.copy(font_path, ASSETS / 'Ionicons.ttf')
    (ASSETS / 'ionicons-glyphs.json').write_text(json.dumps(glyphs), encoding='utf-8')
    font = ImageFont.truetype(str(font_path), 400)
    for name, colour in DECK_ICONS.items():
        for variant, fill in (('', colour), ('-white', '#FFFFFF')):
            img = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
            ImageDraw.Draw(img).text((256, 256), chr(glyphs[name]), font=font, fill=fill, anchor='mm')
            img.save(ICONS / f'{name}{variant}.png')


def qr() -> None:
    code = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=20, border=2)
    code.add_data(REPO_URL)
    code.make(fit=True)
    code.make_image(fill_color='#112950', back_color='white').save(ASSETS / 'qr-github.png')


if __name__ == '__main__':
    ASSETS.mkdir(parents=True, exist_ok=True)
    shutil.copy(LOGO, ASSETS / 'neurocare-logo.png')
    transparent_logo()
    icons()
    qr()
    print('ressources prêtes dans', ASSETS)
