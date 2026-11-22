# Génère les icônes de l'application : python tools/icones.py
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

DOSSIER = Path(__file__).resolve().parent.parent / "icons"
BLEU, NOIR, CLAIR = (31, 95, 168), (29, 39, 51), (219, 232, 247)


def police(taille):
    for nom in ("arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(nom, taille)
        except OSError:
            pass
    return ImageFont.load_default()


def icone(taille, marge):
    img = Image.new("RGB", (taille, taille), BLEU)
    d = ImageDraw.Draw(img)
    zone = taille - 2 * marge
    c = zone // 2
    f = police(int(c * 0.62))
    for i, lettre in enumerate("JEUX"):
        x = marge + (i % 2) * c
        y = marge + (i // 2) * c
        fond = CLAIR if i in (1, 2) else (255, 255, 255)
        d.rectangle([x, y, x + c, y + c], fill=fond, outline=NOIR, width=max(2, taille // 64))
        d.text((x + c / 2, y + c / 2), lettre, fill=NOIR, font=f, anchor="mm")
    return img


DOSSIER.mkdir(exist_ok=True)
icone(192, 24).save(DOSSIER / "icon-192.png")
icone(512, 64).save(DOSSIER / "icon-512.png")
icone(512, 110).save(DOSSIER / "icon-512-maskable.png")
print("icônes écrites dans", DOSSIER)
