"""Génère pitch/NeuroCare_Finale_3min.pptx (+ .pdf) : pitch de finale NEXUS HealthTech, 3 minutes strictes.

8 slides alignées sur les 7 critères du jury, charte NeuroCare (#0F2342, #246BFD, #10B981), notes présentateur
chronométrées (total 2 min 50 s, 10 s de marge). Le script oral de chaque slide est vérifié : débit ≤ 2,7 mots/s.

- python-pptx pour les formes, images, tableau, vidéo et notes ;
- OpenXML injecté pour les ombres douces, les transitions et les apparitions automatiques (sans clic) ;
- vidéo : NeuroCare_Demo_45s.mp4 (démo « la voix de sa fille », voix et musique incluses : on se tait pendant la lecture) ;
- page de garde : illustration pitch/lmra.jpeg (liseré gris de la capture rogné, fond blanc fondu dans une carte) ;
- PDF : export par Microsoft PowerPoint (COM, via PowerShell). Option --no-pdf pour l'ignorer.

Prérequis : python pitch/scripts/prepare_assets.py (icônes, logo détouré, QR code), puis la vidéo de démo
(render_video.py --scene voix et compose_voix_audio.py).
Usage : python pitch/scripts/build_finale_3min.py [--no-pdf] [--png DOSSIER]
"""
import argparse
import os
import re
import subprocess
from pathlib import Path

import imageio_ffmpeg
from PIL import Image
from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parents[2]
PITCH = ROOT / 'pitch'
A = PITCH / 'assets'
ICONS = A / 'icons'
BUILD = PITCH / 'build'
VIDEO = PITCH / 'NeuroCare_Demo_45s.mp4'
ILLUSTRATION = PITCH / 'lmra.jpeg'
VIDEO_SECONDS = 45
OUT = Path(os.environ.get('NEUROCARE_FINALE_OUT', PITCH / 'NeuroCare_Finale_3min.pptx'))

# Charte NeuroCare
NAVY = '0F2342'; BLUE = '246BFD'; EMERALD = '10B981'
BG = 'F5F8FC'; WHITE = 'FFFFFF'; TEXT = '1C2B45'; MUTED = '55657E'; BORDER = 'E6EEF8'
SOFTBLUE = 'EBF2FF'; SOFTGREEN = 'D1FAE5'; SOFTRED = 'FEE2E2'; SOFTAMBER = 'FEF3C7'; RED = 'DC2626'
NAVY2 = '1B3A66'; ICE = '93C5FD'; MINT = '6EE7B7'; DEEPGREEN = '065F46'
FONT = 'Calibri'
LRM = '‎'  # garde l'ordre « FR · العربية · الدارجة » dans un paragraphe de gauche à droite
AR = f'العربية{LRM}'
DJ = f'الدارجة{LRM}'

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
BLANK = prs.slide_layouts[6]


# ------------------------------------------------------------------ primitives
def rgb(hex_):
    return RGBColor.from_string(hex_)


def background(slide, colour):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = rgb(colour)


def shadow(shape, blur=18, dist=4, alpha=10):
    """Ombre douce bleu marine à faible opacité."""
    sppr = shape._element.spPr
    for old in sppr.findall(qn('a:effectLst')):
        sppr.remove(old)
    eff = etree.SubElement(sppr, qn('a:effectLst'))
    sh = etree.SubElement(eff, qn('a:outerShdw'), blurRad=str(Pt(blur)), dist=str(Pt(dist)), dir='5400000', algn='t', rotWithShape='0')
    clr = etree.SubElement(sh, qn('a:srgbClr'), val='0F3D6E')
    etree.SubElement(clr, qn('a:alpha'), val=str(alpha * 1000))


def drop_style(shape):
    style = shape._element.find(qn('p:style'))
    if style is not None:
        shape._element.remove(style)


def box(slide, x, y, w, h, fill=WHITE, line=None, radius=0.1, soft_shadow=True, name=None):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    if radius:
        shape.adjustments[0] = radius
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(fill)
    if line:
        shape.line.color.rgb = rgb(line)
        shape.line.width = Pt(1)
    else:
        shape.line.fill.background()
    drop_style(shape)
    if soft_shadow:
        shadow(shape)
    if name:
        shape.name = name
    return shape


def circle(slide, x, y, d, fill, soft=False):
    shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(fill)
    shape.line.fill.background()
    drop_style(shape)
    if soft:
        shadow(shape, blur=10, dist=3, alpha=12)
    return shape


def text(slide, x, y, w, h, runs, size=16, colour=TEXT, bold=False, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP,
         spacing=None, name=None, italic=False):
    """runs : str, ou liste de paragraphes ; un paragraphe = str ou liste de (texte, {options})."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    paras = runs if isinstance(runs, list) else [runs]
    for i, para in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        if spacing:
            p.space_after = Pt(spacing)
        for content, opts in ([(para, {})] if isinstance(para, str) else para):
            r = p.add_run()
            r.text = content
            f = r.font
            f.name = FONT
            f.size = Pt(opts.get('size', size))
            f.bold = opts.get('bold', bold)
            f.italic = opts.get('italic', italic)
            f.color.rgb = rgb(opts.get('colour', colour))
            rpr = r._r.get_or_add_rPr()
            for tag, face in (('a:ea', FONT), ('a:cs', 'Segoe UI')):
                el = rpr.find(qn(tag))
                if el is None:
                    el = etree.SubElement(rpr, qn(tag))
                el.set('typeface', face)
    if name:
        tb.name = name
    return tb


def image(slide, path, x, y, w=None, h=None, name=None):
    pic = slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w) if w else None, Inches(h) if h else None)
    if name:
        pic.name = name
    return pic


def group(slide, shapes, name=None):
    grp = slide.shapes.add_group_shape(shapes)
    if name:
        grp.name = name
    return grp


def icon_badge(slide, icon, x, y, d, tint, scale=.6):
    """Icône Ionicons dans un rond pastel : le motif visuel commun au deck (mêmes icônes que l'application)."""
    c = circle(slide, x, y, d, tint, soft=True)
    s = d * scale
    i = image(slide, ICONS / f'{icon}.png', x + (d - s) / 2, y + (d - s) / 2, s, s)
    return [c, i]


def chip(slide, x, y, label, fill=SOFTBLUE, colour=BLUE, size=12, w=None, h=0.38):
    w = w or (0.34 + len(label) * size * 0.0074)
    b = box(slide, x, y, w, h, fill=fill, radius=0.5, soft_shadow=False)
    t = text(slide, x, y, w, h, label, size=size, colour=colour, bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    return [b, t]


def title(slide, label, kicker):
    """Titre des slides de contenu : même position, taille et style partout ; logo NeuroCare en haut à droite."""
    k = text(slide, 0.6, 0.4, 10.5, 0.32, kicker.upper(), size=13, colour=BLUE, bold=True)
    t = text(slide, 0.6, 0.7, 10.8, 0.75, label, size=34, colour=NAVY, bold=True)
    logo = image(slide, A / 'neurocare-logo-transparent.png', 11.78, 0.38, h=0.95)
    return group(slide, [k, t, logo], 'Titre')


# Le script oral est la source de vérité du minutage : chaque slide déclare son créneau et son texte parlé.
TIMELINE = []


def notes(slide, start, end, label, spoken, stage='', media=0.0):
    """Notes présentateur : créneau, script parlé (mots / débit), indications de jeu.
    `media` : durée d'une vidéo pendant laquelle on se tait (le texte doit tenir dans le temps restant)."""
    seconds = end - start
    words = len(re.findall(r"[\wÀ-ÿ’'-]+", spoken))
    rate = words / (seconds - media)
    assert rate <= 2.7, f'{label} : {words} mots en {seconds} s ({rate:.2f} mots/s) — trop rapide pour être dit'
    TIMELINE.append((label, start, end, words))
    fmt = lambda s: f'{s // 60}:{s % 60:02d}'
    body = f'[{fmt(start)} – {fmt(end)}] — {label} ({seconds} s · {words} mots)\n\n« {spoken} »'
    if stage:
        body += f'\n\n{stage}'
    slide.notes_slide.notes_text_frame.text = body


# ------------------------------------------------------------------ transitions et animations (OpenXML)
def transition(slide, kind='fade', speed='fast'):
    sld = slide._element
    for old in sld.findall(qn('p:transition')):
        sld.remove(old)
    tr = etree.Element(qn('p:transition'), spd=speed)
    etree.SubElement(tr, qn('p:fade') if kind == 'fade' else qn('p:push'), **({} if kind == 'fade' else {'dir': 'u'}))
    anchor = sld.find(qn('p:clrMapOvr'))
    if anchor is None:
        anchor = sld.find(qn('p:cSld'))
    anchor.addnext(tr)


def animate(slide, shapes, step_ms=140, dur_ms=400, start_ms=100, extra_nodes=()):
    """Apparition automatique en fondu de chaque bloc, l'un après l'autre, dès l'arrivée de la slide (pas de clic :
    le pitch est trop court pour en perdre). `extra_nodes` : nœuds de minutage déjà écrits (lecture de la vidéo)."""
    ids = iter(range(3, 10_000))
    sld = slide._element

    def ctn(**attrs):
        return etree.Element(qn('p:cTn'), id=str(next(ids)), **attrs)

    group_par = etree.Element(qn('p:par'))
    g = ctn(fill='hold')
    group_par.append(g)
    st = etree.SubElement(g, qn('p:stCondLst'))
    etree.SubElement(st, qn('p:cond'), delay='indefinite')
    on_begin = etree.SubElement(st, qn('p:cond'), evt='onBegin', delay='0')
    etree.SubElement(on_begin, qn('p:tn'), val='2')
    inner_par = etree.SubElement(etree.SubElement(g, qn('p:childTnLst')), qn('p:par'))
    inner = ctn(fill='hold')
    inner_par.append(inner)
    etree.SubElement(etree.SubElement(inner, qn('p:stCondLst')), qn('p:cond'), delay='0')
    effs = etree.SubElement(inner, qn('p:childTnLst'))
    bld = []
    for i, shape in enumerate(shapes):
        spid = str(shape.shape_id)
        par = etree.SubElement(effs, qn('p:par'))
        c = ctn(presetID='10', presetClass='entr', presetSubtype='0', fill='hold', nodeType='withEffect')
        is_sp = shape._element.tag == qn('p:sp')
        if is_sp:
            c.set('grpId', '0')
        par.append(c)
        etree.SubElement(etree.SubElement(c, qn('p:stCondLst')), qn('p:cond'), delay=str(start_ms + i * step_ms))
        kids = etree.SubElement(c, qn('p:childTnLst'))
        st_ = etree.SubElement(kids, qn('p:set'))
        cb = etree.SubElement(st_, qn('p:cBhvr'))
        t1 = ctn(dur='1', fill='hold')
        cb.append(t1)
        etree.SubElement(etree.SubElement(t1, qn('p:stCondLst')), qn('p:cond'), delay='0')
        etree.SubElement(etree.SubElement(cb, qn('p:tgtEl')), qn('p:spTgt'), spid=spid)
        etree.SubElement(etree.SubElement(cb, qn('p:attrNameLst')), qn('p:attrName')).text = 'style.visibility'
        etree.SubElement(etree.SubElement(st_, qn('p:to')), qn('p:strVal'), val='visible')
        ae = etree.SubElement(kids, qn('p:animEffect'), transition='in', filter='fade')
        cb2 = etree.SubElement(ae, qn('p:cBhvr'))
        cb2.append(ctn(dur=str(dur_ms)))
        etree.SubElement(etree.SubElement(cb2, qn('p:tgtEl')), qn('p:spTgt'), spid=spid)
        if is_sp:
            bld.append(spid)

    timing = etree.Element(qn('p:timing'))
    root_par = etree.SubElement(etree.SubElement(timing, qn('p:tnLst')), qn('p:par'))
    root = etree.SubElement(root_par, qn('p:cTn'), id='1', dur='indefinite', restart='never', nodeType='tmRoot')
    root_children = etree.SubElement(root, qn('p:childTnLst'))
    seq = etree.SubElement(root_children, qn('p:seq'), concurrent='1', nextAc='seek')
    main = etree.SubElement(seq, qn('p:cTn'), id='2', dur='indefinite', nodeType='mainSeq')
    etree.SubElement(main, qn('p:childTnLst')).append(group_par)
    prev = etree.SubElement(etree.SubElement(seq, qn('p:prevCondLst')), qn('p:cond'), evt='onPrev', delay='0')
    etree.SubElement(etree.SubElement(prev, qn('p:tgtEl')), qn('p:sldTgt'))
    nxt = etree.SubElement(etree.SubElement(seq, qn('p:nextCondLst')), qn('p:cond'), evt='onNext', delay='0')
    etree.SubElement(etree.SubElement(nxt, qn('p:tgtEl')), qn('p:sldTgt'))
    for node in extra_nodes:
        root_children.append(node)
    if extra_nodes:  # identifiants cTn uniques après la greffe
        for i, c in enumerate(timing.iter(qn('p:cTn')), start=1):
            c.set('id', str(i))
    if bld:
        bl = etree.SubElement(timing, qn('p:bldLst'))
        for spid in bld:
            etree.SubElement(bl, qn('p:bldP'), spid=spid, grpId='0')
    old = sld.find(qn('p:timing'))
    if old is not None:
        sld.remove(old)
    tr = sld.find(qn('p:transition'))
    (tr if tr is not None else sld.find(qn('p:clrMapOvr'))).addnext(timing)


# ------------------------------------------------------------------ illustration de la page de garde
def illustration():
    """lmra.jpeg est une capture : on rogne son liseré gris et on blanchit le fond presque blanc pour qu'il se fonde dans la carte."""
    out = BUILD / 'lmra-illustration.png'
    im = Image.open(ILLUSTRATION).convert('RGB')
    w, h = im.size
    im = im.crop((10, 10, w - 10, h - 10))
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]
            if min(r, g, b) > 236:
                px[x, y] = (255, 255, 255)
    im.save(out)
    return out, im.width / im.height


# ------------------------------------------------------------------ slides
def slide_1_cover():
    """La solution (à gauche) face au problème humain (à droite, l'illustration)."""
    s = prs.slides.add_slide(BLANK)
    background(s, NAVY)
    dot = circle(s, 0.75, 0.66, 0.13, EMERALD)
    kick_t = text(s, 1.02, 0.55, 6.8, 0.36, 'AMPHI 2 · FEG OUJDA', size=14, colour=ICE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    kick = group(s, [dot, kick_t], 'Surtitre')
    tile = box(s, 0.75, 1.3, 1.35, 1.35, fill=WHITE, radius=0.18)
    mark = image(s, A / 'neurocare-logo-transparent.png', 0.83, 1.38 + (1.19 - 1.19 * 818 / 984) / 2, w=1.19)
    name = text(s, 2.35, 1.3, 5.6, 1.35, 'NeuroCare', size=72, colour=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    brand = group(s, [tile, mark, name], 'Logo')
    slogan = text(s, 0.75, 2.95, 7.0, 1.9, [[('« L’alliance de la ', {}), ('voix familiale', {'colour': '7FB0FF'}), (', de l’', {}),
                                             ('IA vocale trilingue', {'colour': ICE}), (' et du ', {}),
                                             ('pré-dépistage autonome', {'colour': MINT}), ('. »', {})]],
                  size=25, colour=WHITE, bold=True, name='Slogan')
    b1 = chip(s, 0.75, 4.95, 'FINALE NEXUS HEALTHTECH  ·  PROTOTYPE OPÉRATIONNEL', fill=EMERALD, colour=WHITE, size=14, w=6.1, h=0.5)
    b2 = chip(s, 0.75, 5.6, '3 Ingénieurs (Info, Gestion & Marketing)  ×  2 Étudiantes en Médecine (6ᵉ année)',
              fill=NAVY2, colour=WHITE, size=13.5, w=7.0, h=0.5)
    badges = group(s, b1 + b2, 'Badges')
    path, ratio = illustration()
    card = box(s, 8.15, 0.6, 4.43, 5.55, fill=WHITE, radius=0.07, name='CarteIllustration')
    shadow(card, blur=30, dist=8, alpha=30)
    ih = 4.25
    pic = image(s, path, 8.15 + (4.43 - ih * ratio) / 2, 0.78, h=ih, name='Illustration')
    cap = text(s, 8.4, 5.12, 3.93, 0.9, '« À domicile, l’oubli et la confusion isolent nos aînés face à leurs traitements. »',
               size=13.5, colour=MUTED, italic=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    illus = group(s, [card, pic, cap], 'Probleme')
    line = box(s, 0.75, 6.44, 11.83, 0.015, fill='1E3A6E', radius=0, soft_shadow=False)
    team = text(s, 0.75, 6.62, 4, 0.45, 'Équipe NeuroCare', size=17, colour=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    langs = text(s, 6.5, 6.62, 6.08, 0.45, [[('FR', {'bold': True, 'colour': WHITE}), ('   ·   ', {'colour': '5B7CB0'}), (AR, {'colour': 'E2E8F0'}),
                                              ('   ·   ', {'colour': '5B7CB0'}), (DJ, {'colour': MINT})]],
                 size=16, align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)
    sig = group(s, [line, team, langs], 'Signature')
    transition(s, 'fade', 'med')
    animate(s, [kick, illus, brand, slogan, badges, sig], step_ms=180)
    notes(s, 0, 13, 'PAGE DE GARDE — accroche',
          'Oujda, vingt heures. Hajja Zahra, 74 ans, seule dans son fauteuil, face à ses boîtes de médicaments. '
          'Elle oublie. Sa fille est loin. Nous sommes NeuroCare.',
          '(Montrer l’illustration en disant « seule dans son fauteuil ». Hajja Zahra est un personnage illustratif.)')


def slide_2_problem():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, 'Une crise silencieuse, à domicile', 'Critère 1 · Problème & besoin terrain')
    stats = [
        ('5 M', 'de seniors (60 ans et +) au Maroc', BLUE, 'people'),
        ('29,3 %', 'des adultes marocains sont hypertendus', 'EF4444', 'heart'),
        ('1 / 10', 'hypertendu seulement est contrôlé', 'D97706', 'alarm'),
        ('≈ 50 %', 'de mauvaise observance des traitements chroniques', EMERALD, 'medkit'),
    ]
    cards = []
    for i, (big, label, col, ic) in enumerate(stats):
        x = 0.6 + i * 3.08
        c = box(s, x, 1.65, 2.84, 2.4)
        b = icon_badge(s, ic, x + 0.28, 1.88, 0.56, 'F0F5FF')
        n = text(s, x + 0.28, 2.5, 2.45, 0.8, big, size=44, colour=col, bold=True)
        l = text(s, x + 0.28, 3.3, 2.4, 0.68, label, size=14, colour=TEXT)
        cards.append(group(s, [c, *b, n, l], f'Chiffre{i + 1}'))
    tgt = box(s, 0.6, 4.3, 3.9, 2.3, fill=NAVY, radius=0.08)
    tgt_i = icon_badge(s, 'people-white', 0.88, 4.55, 0.56, NAVY2)
    tgt_k = text(s, 1.6, 4.55, 2.7, 0.56, 'CIBLE CLAIRE', size=14, colour=MINT, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    tgt_t = text(s, 0.88, 5.25, 3.4, 1.25, [[('Les personnes âgées', {'bold': True, 'colour': WHITE}),
                                              (' et toutes les personnes sujettes aux oublis de traitement ou de suivi au quotidien.', {})]],
                 size=15, colour='C9D6E8')
    target = group(s, [tgt, *tgt_i, tgt_k, tgt_t], 'Cible')
    pains = [
        ('alarm', 'F0F5FF', 'Oublis critiques', 'de médicaments, aidant à distance'),
        ('language', 'F0F5FF', 'Barrière linguistique', f'FR · {AR} · darija'),
        ('phone-portrait', 'F0F5FF', 'Interfaces complexes', 'pensées pour les jeunes'),
        ('eye-off', 'F0F5FF', 'Détection trop tardive', 'des complications (HTA, diabète…)'),
    ]
    rows = []
    for i, (ic, tint, head, body) in enumerate(pains):
        x = 4.75 + (i % 2) * 4.1
        y = 4.3 + (i // 2) * 1.2
        c = box(s, x, y, 3.88, 1.05)
        b = icon_badge(s, ic, x + 0.22, y + 0.24, 0.56, tint)
        h = text(s, x + 0.95, y + 0.17, 2.85, 0.36, head, size=16, colour=NAVY, bold=True)
        d = text(s, x + 0.95, y + 0.53, 2.85, 0.36, body, size=13, colour=MUTED)
        rows.append(group(s, [c, *b, h, d], f'Douleur{i + 1}'))
    src = text(s, 0.6, 6.78, 12.1, 0.3, 'Sources : HCP, RGPH 2024 · Ministère de la Santé / OMS, enquête STEPS 2017-2018 · '
                                       'OMS, hypertendus de 30-79 ans contrôlés · OMS, « Adherence to long-term therapies » (2003).',
               size=10, colour=MUTED, name='Sources')
    transition(s, 'push')
    animate(s, [t, *cards, target, *rows, src])
    notes(s, 13, 32, 'CRITÈRE 1 — PROBLÈME & BESOIN',
          'Notre cible : les personnes âgées, et tous ceux qui oublient leur traitement. '
          '5 millions de seniors au Maroc, 29 % d’adultes hypertendus, un sur dix contrôlé, un traitement sur deux mal suivi. '
          'Résultat : oublis, barrière de la langue, applications trop complexes, complications vues trop tard.',
          'Sources (si question) : HCP RGPH 2024 (5 M, 13,8 %) ; STEPS 2017-2018 (29,3 %) ; OMS (contrôle ≈ 10 % des 30-79 ans) ; OMS 2003 (≈ 50 %).')


def slide_3_value():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, 'Un compagnon de santé, pas une simple app', 'Critères 2 & 3 · Valeur, innovation & différenciation')
    values = [
        ('cloud-offline', SOFTBLUE, 'Autonomie & ergonomie senior',
         [[('100 % hors-ligne', {'bold': True, 'colour': NAVY}), (f', sans scroll, gros boutons, FR ⇄ {AR} + darija vocale.', {})]]),
        ('lock-closed', SOFTGREEN, 'Souveraineté des données',
         [[('« Nous ne contrôlons pas les données des patients »', {'bold': True, 'colour': NAVY}),
           (' : sur le téléphone, zéro revente, partage volontaire.', {})]]),
    ]
    vals = []
    for i, (ic, tint, head, body) in enumerate(values):
        x = 0.6 + i * 3.13
        c = box(s, x, 1.65, 2.98, 1.75)
        b = icon_badge(s, ic, x + 0.2, 1.82, 0.5, tint)
        h = text(s, x + 0.82, 1.82, 2.05, 0.5, head, size=14, colour=NAVY, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        d = text(s, x + 0.2, 2.45, 2.62, 0.9, body, size=12.5, colour=MUTED)
        vals.append(group(s, [c, *b, h, d], f'Valeur{i + 1}'))
    poles = [
        ('mic-white', BLUE, 'Pôle 1 — Observance vocale', 'Voix enregistrée d’un proche · bouton unique « C’est fait » · suivi aidant en temps réel'),
        ('medkit-white', EMERALD, 'Pôle 2 — 5 bilans cliniques validés',
         'Questionnaires : GDS-15, FINDRISC /26 + 7 signes, Alzheimer 4 A · Schémas : HTA 3 j, SpO₂ standard / BPCO → PDF horodaté'),
        ('chatbubble-ellipses-white', NAVY, 'Pôle 3 — Assistant Santé vocal trilingue',
         f'FR · {AR} · {DJ} — écran unique sans scroll, 18 sujets sourcés OMS · HAS · ESC · FID'),
    ]
    ps = []
    for i, (ic, col, head, body) in enumerate(poles):
        y = 3.6 + i * 1.08
        c = box(s, 0.6, y, 6.11, 0.96)
        b = icon_badge(s, ic, 0.8, y + 0.18, 0.6, col)
        h = text(s, 1.6, y + 0.08, 5.0, 0.32, head, size=15, colour=NAVY, bold=True)
        d = text(s, 1.6, y + 0.4, 5.0, 0.54, body, size=12, colour=MUTED)
        ps.append(group(s, [c, *b, h, d], f'Pole{i + 1}'))
    # Benchmark : tableau natif (modifiable dans PowerPoint).
    bench_k = text(s, 6.95, 1.65, 5.78, 0.32, 'BENCHMARK — MAROC & INTERNATIONAL', size=13, colour=BLUE, bold=True, name='BenchTitre')
    rows = [
        ('', 'NeuroCare', 'Medisafe · MyTherapy', 'Chatbots génériques'),
        ('Darija vocale & voix familiale', 'yes', 'no', 'no'),
        ('100 % hors-ligne (bilans + assistant)', 'yes', ('Partiel', 'rappels seuls'), 'no'),
        ('Échelles validées, sans diagnostic hasardeux', 'yes', 'no', 'no'),
        ('Souveraineté locale — Loi 09-08', 'yes', ('Non', 'cloud étranger'), ('Non', 'cloud étranger')),
    ]
    tbl_shape = s.shapes.add_table(len(rows), 4, Inches(6.95), Inches(2.05), Inches(5.78), Inches(4.6))
    tbl_shape.name = 'Benchmark'
    tbl = tbl_shape.table
    tblpr = tbl._tbl.tblPr
    style_id = tblpr.find(qn('a:tableStyleId'))
    if style_id is not None:
        style_id.text = '{5940675A-B579-460E-94D1-54222C63F5DA}'  # « Aucun style, quadrillage » : on colore nous-mêmes
    for j, w in enumerate([2.08, 1.2, 1.25, 1.25]):
        tbl.columns[j].width = Inches(w)
    tbl.rows[0].height = Inches(0.72)
    for r in range(1, len(rows)):
        tbl.rows[r].height = Inches(0.97)
    for r, row in enumerate(rows):
        for j, val in enumerate(row):
            cell = tbl.cell(r, j)
            cell.margin_left = cell.margin_right = Inches(0.08)
            cell.margin_top = cell.margin_bottom = Inches(0.04)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            fill = NAVY if r == 0 else (SOFTBLUE if j == 1 else WHITE)
            if r == 0 and j == 1:
                fill = BLUE
            cell.fill.solid()
            cell.fill.fore_color.rgb = rgb(fill)
            tf = cell.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.LEFT if j == 0 else PP_ALIGN.CENTER

            def run(txt, size, colour, bold=False, para=p):
                rr = para.add_run(); rr.text = txt
                rr.font.size = Pt(size); rr.font.bold = bold; rr.font.name = FONT; rr.font.color.rgb = rgb(colour)

            if r == 0:
                head, *rest = val.split(' · ') if j == 2 else [val]
                run(head, 13, WHITE, True)
                for extra in rest:
                    p2 = tf.add_paragraph(); p2.alignment = PP_ALIGN.CENTER
                    run(extra, 13, WHITE, True, para=p2)
            elif j == 0:
                run(val, 13, NAVY, True)
            elif val == 'yes':
                run('✓ Oui', 15, '047857', True)
            elif val == 'no':
                run('✗ Non', 14, RED, True)
            else:
                run(val[0], 14, 'B45309', True)
                p2 = tf.add_paragraph(); p2.alignment = PP_ALIGN.CENTER
                run(val[1], 11, MUTED, para=p2)
    # Bordures fines de la charte.
    for tc in tbl._tbl.iter(qn('a:tc')):
        tcpr = tc.get_or_add_tcPr()
        for edge in ('a:lnL', 'a:lnR', 'a:lnT', 'a:lnB'):
            ln = etree.SubElement(tcpr, qn(edge), w=str(Pt(1)))
            sf = etree.SubElement(ln, qn('a:solidFill'))
            etree.SubElement(sf, qn('a:srgbClr'), val='D6E2F2')
        # Le schéma impose : lnL, lnR, lnT, lnB, …, puis le remplissage — on remet le remplissage en dernier.
        for f in tcpr.findall(qn('a:solidFill')):
            tcpr.remove(f); tcpr.append(f)
    bench_src = text(s, 6.95, 6.72, 5.78, 0.3, 'D’après les fonctionnalités publiques déclarées par chaque solution.', size=10, colour=MUTED, name='BenchSource')
    transition(s, 'push')
    animate(s, [t, *vals, *ps, bench_k, tbl_shape, bench_src])
    notes(s, 32, 59, 'CRITÈRES 2 & 3 — VALEUR, INNOVATION & DIFFÉRENCIATION',
          'NeuroCare n’est pas une simple application : c’est un compagnon de santé autonome. '
          'Sans réseau, sans défilement, en français, en arabe et en darija, et les données restent sur le téléphone. '
          'Trois pôles : l’observance vocale, avec la voix d’un proche ; cinq bilans cliniques validés, avec PDF horodaté ; '
          'un assistant santé vocal trilingue. Ni Medisafe, ni MyTherapy, ni un chatbot ne réunissent darija, hors-ligne et échelles validées.',
          'Si question : l’interface bascule FR ⇄ arabe (droite-à-gauche) ; la darija est comprise et parlée par l’Assistant Santé. '
          'Les 5 pôles de bilans et l’assistant n’ont besoin ni de compte ni de réseau ; seul le suivi aidant ↔ senior synchronise via le serveur.')


def slide_4_demo():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, 'Ce que nous démontrons aujourd’hui', 'Critère 4 · Faisabilité technique & prototype démontré')
    frame = box(s, 0.6, 1.65, 7.3, 4.18, fill=NAVY, radius=0.04, name='CadreVideo')
    shadow(frame, blur=30, dist=8, alpha=22)
    poster = BUILD / 'poster_finale.png'
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-ss', '6', '-i', str(VIDEO), '-frames:v', '1', str(poster)], check=True)
    movie = s.shapes.add_movie(str(VIDEO), Inches(0.68), Inches(1.73), Inches(7.14), Inches(4.02), poster_frame_image=str(poster), mime_type='video/mp4')
    movie.name = 'VideoDemo'
    steps = [('La voix de sa fille, à 20:00', BLUE), ('Espace senior : « C’est fait »', EMERALD), ('Aidante rassurée, en temps réel', NAVY)]
    marks = []
    for i, (lab, col) in enumerate(steps):
        x = 0.6 + i * 2.47
        c = box(s, x, 6.0, 2.36, 0.8, fill=WHITE, radius=0.2)
        n = circle(s, x + 0.14, 6.19, 0.42, col)
        nt = text(s, x + 0.14, 6.19, 0.42, 0.42, str(i + 1), size=15, colour=WHITE, bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        lt = text(s, x + 0.66, 6.0, 1.62, 0.8, lab, size=12.5, colour=NAVY, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        marks.append(group(s, [c, n, nt, lt], f'Repere{i + 1}'))
    # Architecture
    arch = box(s, 8.2, 1.65, 4.53, 2.7)
    arch_b = icon_badge(s, 'server', 8.4, 1.82, 0.52, SOFTBLUE)
    arch_h = text(s, 9.05, 1.82, 3.55, 0.52, 'Architecture hybride éprouvée', size=16, colour=NAVY, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    layers = [
        ('Mobile React Native / Expo', 'moteur clinique local + PDF embarqué', SOFTGREEN, DEEPGREEN),
        ('Microservices Docker Spring Boot', '8088 Observance · 8089 Assistant médical', SOFTBLUE, '1E40AF'),
        ('PostgreSQL 16 · MinIO', 'données de suivi · voix des proches', 'EEF2F7', NAVY),
    ]
    tiles = []
    for i, (h, d, fill, col) in enumerate(layers):
        y = 2.45 + i * 0.62
        tb = box(s, 8.4, y, 4.13, 0.56, fill=fill, radius=0.18, soft_shadow=False)
        tt = text(s, 8.55, y, 3.9, 0.56, [[(h, {'bold': True, 'size': 12.5})], [(d, {'size': 11})]], colour=col, anchor=MSO_ANCHOR.MIDDLE)
        tiles += [tb, tt]
    archi = group(s, [arch, *arch_b, arch_h, *tiles], 'Architecture')
    qs = []
    for i, (big, lab) in enumerate([('256', 'tests mobile automatisés'), ('255', 'tests backend automatisés')]):
        x = 8.2 + i * 2.32
        c = box(s, x, 4.5, 2.21, 1.3, fill=NAVY, radius=0.12)
        n = text(s, x + 0.2, 4.55, 1.9, 0.7, big, size=34, colour=MINT, bold=True)
        l = text(s, x + 0.2, 5.2, 1.9, 0.5, lab, size=12.5, colour=WHITE)
        qs.append(group(s, [c, n, l], f'Tests{i + 1}'))
    demo = box(s, 8.2, 5.95, 4.53, 0.85, fill=SOFTGREEN, radius=0.18, soft_shadow=False)
    demo_b = icon_badge(s, 'play-circle', 8.35, 6.09, 0.56, WHITE)
    demo_t = text(s, 9.05, 5.95, 3.6, 0.85, [[('Mode Démo hors-ligne intégré', {'bold': True, 'size': 14})],
                                             [('patiente fictive « Hajja Zahra »', {'size': 12})]], colour=DEEPGREEN, anchor=MSO_ANCHOR.MIDDLE)
    demo_g = group(s, [demo, *demo_b, demo_t], 'ModeDemo')
    transition(s, 'fade')
    return s, [t, frame, *marks, archi, *qs, demo_g]


def slide_5_ethics():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, 'Données de santé : la sécurité d’abord', 'Critère 5 · Sécurité, éthique & données de santé (Loi 09-08)')
    items = [
        ('lock-closed', SOFTBLUE, 'Loi 09-08 & chiffrement',
         'Local-First : données de santé sur le téléphone, identifiants dans le coffre chiffré du système, flux JWT / HTTPS. Zéro exploitation commerciale.'),
        ('pulse', SOFTAMBER, 'Contrôle des données absurdes',
         'Bornes physiologiques : TAS 60-260, TAD 30-160 (< TAS), SpO₂ 50-100 %, pouls 30-220. Valeur impossible → refusée, mesure à reprendre.'),
        ('hand-left', SOFTGREEN, 'Reprise en main par le soignant',
         'Aucun diagnostic automatique : rapport PDF horodaté remis au médecin ou au pharmacien, qui garde la décision clinique.'),
        ('call', SOFTRED, 'Secours en cas de panne',
         'Bilans et assistant 100 % hors-ligne, rappels mis en file d’attente ; appels d’urgence 15 / 141 en 1 clic.'),
        ('medical', 'F3E8FF', 'Prévention des biais',
         'Seuils internationaux OMS · HAS · ESC · FID · GDS-15 ; profil BPCO dédié en SpO₂ (88-92 %) ; FR, arabe, darija.'),
    ]
    cards = []
    for i, (ic, tint, head, body) in enumerate(items):
        x = 0.6 + (i % 3) * 4.1
        y = 1.65 + (i // 3) * 2.62
        c = box(s, x, y, 3.88, 2.45)
        n = text(s, x + 0.25, y + 0.2, 1.0, 0.6, f'{i + 1:02d}', size=28, colour=BLUE, bold=True)
        b = icon_badge(s, ic, x + 3.88 - 0.85, y + 0.2, 0.6, tint)
        h = text(s, x + 0.25, y + 0.85, 3.4, 0.4, head, size=17, colour=NAVY, bold=True)
        d = text(s, x + 0.25, y + 1.28, 3.42, 1.1, body, size=12.5, colour=MUTED)
        cards.append(group(s, [c, n, *b, h, d], f'Exigence{i + 1}'))
    x, y = 0.6 + 2 * 4.1, 1.65 + 2.62
    c = box(s, x, y, 3.88, 2.45, fill=NAVY)
    b = icon_badge(s, 'shield-checkmark-white', x + 0.25, y + 0.25, 0.6, EMERALD)
    h = text(s, x + 0.25, y + 0.95, 3.4, 0.45, 'Le médecin garde la décision.', size=19, colour=WHITE, bold=True)
    d = text(s, x + 0.25, y + 1.45, 3.4, 0.9, 'Mention de non-diagnostic sur chaque écran, API et PDF — vérifiée par des tests (FR + AR).',
             size=12.5, colour='C9D6E8')
    summary = group(s, [c, *b, h, d], 'Synthese')
    transition(s, 'push')
    animate(s, [t, *cards, summary])
    notes(s, 107, 127, 'CRITÈRE 5 — SÉCURITÉ, ÉTHIQUE & DONNÉES',
          'Un : Loi 09-08, données sur le téléphone, flux sécurisés. Deux : une mesure impossible est refusée. '
          'Trois : aucun diagnostic, le médecin garde la décision. '
          'Quatre : en cas de panne, tout fonctionne hors-ligne, 15 et 141 à un clic. Cinq : seuils internationaux, profil BPCO dédié.',
          'Idéalement porté par une des deux étudiantes en médecine.\n'
          'Précision si question : les données de santé des bilans restent dans le stockage de l’application sur le téléphone ; '
          'les identifiants (jetons) sont dans le coffre chiffré du système (expo-secure-store). Le serveur recalcule toujours '
          'les scores, il ne reprend jamais celui de l’application.')


def slide_6_business():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, '0 MAD pour les seniors, un modèle solidaire', 'Critère 6 · Modèle économique, coûts & déploiement')

    def offer(x, w, fill, chip_fill, chip_col, chip_lab, chip_w, big, big_col, head, head_col, body, body_col, name):
        c = box(s, x, 1.65, w, 2.95, fill=fill, radius=0.08)
        ch = chip(s, x + 0.25, 1.83, chip_lab, fill=chip_fill, colour=chip_col, size=12, w=chip_w)
        b = text(s, x + 0.25, 2.3, w - 0.5, 0.62, big, size=30, colour=big_col, bold=True)
        h = text(s, x + 0.25, 2.92, w - 0.5, 0.35, head, size=14, colour=head_col, bold=True)
        d = text(s, x + 0.25, 3.3, w - 0.5, 1.25, body, size=12.5, colour=body_col, spacing=3)
        return group(s, [c, *ch, b, h, d], name)

    senior = offer(0.6, 3.95, NAVY, EMERALD, WHITE, 'SENIORS · GRATUIT À VIE', 2.55, '0 MAD', MINT, 'Toutes les fonctions vitales', WHITE,
                   'Rappels vocaux familiaux, 5 bilans cliniques hors-ligne, Assistant Santé FR · AR · darija, export PDF médecin.', 'C9D6E8', 'Seniors')
    family = offer(4.7, 3.95, WHITE, SOFTBLUE, BLUE, 'AIDANTS · OPTIONNEL', 2.15, '5 à 9\u00a0MAD\u00a0/\u00a0mois', BLUE, 'ou 50 MAD / an, contribution symbolique', NAVY, [
        [('Pour : ', {'bold': True, 'colour': NAVY}), ('suivi cloud multi-patients en temps réel.', {})],
        [('0 MAD : ', {'bold': True, 'colour': DEEPGREEN}), ('retraités à faible revenu, bénéficiaires AMO Tadamon.', {})],
    ], TEXT, 'Aidants')
    b2b = offer(8.8, 3.93, WHITE, SOFTGREEN, DEEPGREEN, 'B2B2C · FINANCEMENT PRINCIPAL', 3.1, '250 à 1\u00a0000\u00a0MAD', DEEPGREEN, 'par mois et par structure', NAVY, [
        [('Mutuelles / AMO, cliniques, pharmacies, associations : ', {'bold': True, 'colour': NAVY}),
         ('moins d’hospitalisations évitables, patients chroniques fidélisés.', {})],
    ], TEXT, 'B2B2C')
    cost = box(s, 0.6, 4.8, 8.13, 1.05, fill=WHITE, radius=0.12)
    cost_k = text(s, 0.85, 4.88, 2.0, 0.3, 'LANCEMENT', size=11, colour=BLUE, bold=True)
    stats = []
    for i, (big, lab) in enumerate([('25 $', '≈ 250 MAD, Play Store, à vie'), ('~150 MAD', 'par mois de serveur léger'), ('< 0,50 MAD', 'par patient et par an*')]):
        x = 0.85 + i * 2.62
        stats.append(text(s, x, 5.12, 2.5, 0.4, big, size=20, colour=NAVY, bold=True))
        stats.append(text(s, x, 5.5, 2.5, 0.3, lab, size=11.5, colour=MUTED))
    cost_g = group(s, [cost, cost_k, *stats], 'Couts')
    legal = box(s, 8.88, 4.8, 3.85, 1.05, fill=SOFTGREEN, radius=0.12, soft_shadow=False)
    legal_b = icon_badge(s, 'shield-checkmark', 9.03, 5.04, 0.56, WHITE)
    legal_t = text(s, 9.72, 4.8, 2.9, 1.05, [[('Loi 09-08 · Loi 31-08', {'bold': True, 'size': 14})],
                                             [('zéro publicité, zéro revente des données de santé', {'size': 11.5})]], colour=DEEPGREEN, anchor=MSO_ANCHOR.MIDDLE)
    legal_g = group(s, [legal, *legal_b, legal_t], 'CadreLegal')
    miles = [('M1 – M2', 'Play Store + pilote Oujda, 200 seniors'), ('M3 – M6', 'Validation clinique, mutuelles & cliniques'),
             ('M6 – M12', 'Déploiement Oriental, puis national')]
    ms = []
    for i, (when, what) in enumerate(miles):
        x = 0.6 + i * 4.09
        c = box(s, x, 6.02, 3.85, 0.78, fill=WHITE)
        n = text(s, x + 0.22, 6.02, 1.05, 0.78, when, size=14, colour=BLUE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        d = text(s, x + 1.3, 6.02, 2.45, 0.78, what, size=12, colour=TEXT, anchor=MSO_ANCHOR.MIDDLE)
        parts = [c, n, d]
        if i < 2:
            arrow = s.shapes.add_shape(MSO_SHAPE.CHEVRON, Inches(x + 3.9), Inches(6.27), Inches(0.18), Inches(0.28))
            arrow.fill.solid(); arrow.fill.fore_color.rgb = rgb(BLUE); arrow.line.fill.background(); drop_style(arrow)
            parts.append(arrow)
        ms.append(group(s, parts, f'Jalon{i + 1}'))
    foot = text(s, 0.6, 6.88, 12.1, 0.25, '* 150 MAD × 12 + 250 MAD ≈ 2 050 MAD la 1re année, sur une base d’environ 5 000 utilisateurs (traitement 100 % local).',
                size=10, colour=MUTED, name='NoteCout')
    transition(s, 'fade')
    animate(s, [t, senior, family, b2b, cost_g, legal_g, *ms, foot])
    notes(s, 127, 148, 'CRITÈRE 6 — MODÈLE ÉCONOMIQUE & DÉPLOIEMENT',
          'Pour les seniors, NeuroCare est gratuit, à vie : rappels, bilans, assistant et PDF. '
          'Les familles qui veulent le suivi en temps réel donnent 5 à 9 dirhams par mois, zéro avec l’AMO Tadamon. '
          'Mutuelles, cliniques et pharmacies financent le service. Lancement : 250 dirhams, puis 150 par mois.',
          'Calcul (si question) : 150 MAD × 12 + 250 MAD ≈ 2 050 MAD la 1re année ; / 5 000 utilisateurs ≈ 0,41 MAD par patient. '
          'Pendant le pilote (200 seniors), ≈ 10 MAD par senior et par an, couverts par une première structure partenaire.\n'
          'Cadre : Loi 09-08 (données personnelles ; déclaration à la CNDP avant le déploiement), Loi 31-08 (protection du consommateur : '
          'prix affichés, résiliation libre) ; aucune publicité, aucune revente de données de santé.')


def slide_7_team():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, 'NeuroCare est entre de bonnes mains', 'Critère 7 · Équipe pluridisciplinaire')

    def member(x, y, initials, name, fill, col):
        c = circle(s, x + 0.55, y, 1.05, fill, soft=True)
        i = text(s, x + 0.55, y, 1.05, 1.05, initials, size=26, colour=col, bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        n = text(s, x, y + 1.18, 2.15, 0.7, name, size=15, colour=NAVY, bold=True, align=PP_ALIGN.CENTER)
        return [c, i, n]

    eng = box(s, 0.6, 1.65, 7.35, 3.75)
    eng_b = icon_badge(s, 'school', 0.85, 1.85, 0.56, SOFTBLUE)
    eng_h = text(s, 1.55, 1.82, 6.2, 0.62, [[('Pôle Ingénierie — Informatique, Gestion & Marketing', {'bold': True, 'colour': NAVY, 'size': 17})],
                                             [('5ᵉ année · EHEIM Oujda', {'colour': MUTED, 'size': 13})]])
    em = []
    for i, (ini, nm) in enumerate([('ZE', 'Ziad\nEL YAZIDI'), ('FB', 'Fahd\nBENBALI'), ('ME', 'Mehdi\nEL MAHI')]):
        em += member(0.85 + i * 2.35, 2.65, ini, nm, SOFTBLUE, BLUE)
    eng_d = text(s, 0.85, 4.6, 6.9, 0.65, 'Architecture mobile & microservices, cybersécurité, gestion financière, stratégie marketing & déploiement.',
                 size=13, colour=MUTED)
    eng_g = group(s, [eng, *eng_b, eng_h, *em, eng_d], 'PoleIngenierie')
    med = box(s, 8.15, 1.65, 4.58, 3.75)
    med_b = icon_badge(s, 'medical', 8.4, 1.85, 0.56, SOFTGREEN)
    med_h = text(s, 9.1, 1.82, 3.5, 0.62, [[('Pôle Médical', {'bold': True, 'colour': NAVY, 'size': 17})],
                                            [('6ᵉ année de Médecine Générale', {'colour': MUTED, 'size': 13})]])
    mm = []
    for i, (ini, nm) in enumerate([('LR', 'Loubna\nRAHHAOUI'), ('HQ', 'Hanae\nQANDOUSSI')]):
        mm += member(8.3 + i * 2.2, 2.65, ini, nm, SOFTGREEN, DEEPGREEN)
    med_d = text(s, 8.4, 4.6, 4.15, 0.65, 'Conception clinique, validation des seuils OMS · HAS · ESC · FID, sécurité patient.', size=13, colour=MUTED)
    med_g = group(s, [med, *med_b, med_h, *mm, med_d], 'PoleMedical')
    q = box(s, 0.6, 5.6, 12.13, 1.22, fill=NAVY, radius=0.12)
    qt = text(s, 0.95, 5.6, 11.4, 1.22, '« La rigueur médicale d’un futur médecin, la maîtrise technique et business d’un ingénieur : '
                                        'NeuroCare est entre de bonnes mains. »', size=19, colour=WHITE, italic=True, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    quote = group(s, [q, qt], 'Message')
    transition(s, 'push')
    animate(s, [t, eng_g, med_g, quote], step_ms=220)
    notes(s, 148, 160, 'CRITÈRE 7 — ÉQUIPE',
          'Ziad, Fahd et Mehdi, ingénieurs en informatique, gestion et marketing. '
          'Loubna et Hanae, en sixième année de médecine. NeuroCare est entre de bonnes mains.')


def slide_8_close():
    s = prs.slides.add_slide(BLANK)
    background(s, NAVY)
    dot = circle(s, 0.75, 0.66, 0.13, EMERALD)
    kick_t = text(s, 1.02, 0.55, 8, 0.36, 'EN 10 SECONDES', size=14, colour=ICE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    kick = group(s, [dot, kick_t], 'Surtitre')
    stats = [('0 MAD', 'pour les seniors, à vie'), ('100 %', 'hors-ligne & Loi 09-08'), ('511', 'tests automatisés')]
    cards = []
    for i, (big, lab) in enumerate(stats):
        x = 0.75 + i * 4.0
        c = box(s, x, 1.3, 3.8, 2.0, fill='16305A', radius=0.1, soft_shadow=False)
        n = text(s, x + 0.3, 1.5, 3.2, 1.0, big, size=48, colour=MINT, bold=True)
        l = text(s, x + 0.3, 2.5, 3.2, 0.5, lab, size=17, colour=WHITE)
        cards.append(group(s, [c, n, l], f'Chiffre{i + 1}'))
    closing = text(s, 0.75, 3.75, 8.6, 2.2, [
        [('« Aucun parent ne devrait affronter seul ses médicaments.', {'colour': WHITE, 'bold': True, 'size': 32})],
        [('Avec NeuroCare, la technologie protège nos aînés dès aujourd’hui. »', {'colour': MINT, 'bold': True, 'size': 24})],
    ], spacing=10, name='Cloture')
    qr_card = box(s, 10.05, 3.75, 2.53, 2.95, fill=WHITE, radius=0.08)
    qr = image(s, A / 'qr-github.png', 10.29, 3.92, 2.05, 2.05)
    url = text(s, 10.1, 6.05, 2.43, 0.5, 'Code source & démo', size=12, colour=NAVY, bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    qr_g = group(s, [qr_card, qr, url], 'QRCode')
    line = box(s, 0.75, 6.44, 9.0, 0.015, fill='1E3A6E', radius=0, soft_shadow=False)
    sign = text(s, 0.75, 6.62, 9.0, 0.45, [[('Merci  ·  ', {'bold': True, 'colour': WHITE}), ('Équipe NeuroCare — Finale NEXUS HealthTech', {'colour': ICE})]],
                size=17, anchor=MSO_ANCHOR.MIDDLE)
    sig = group(s, [line, sign], 'Signature')
    transition(s, 'fade', 'med')
    animate(s, [kick, *cards, closing, qr_g, sig], step_ms=200)
    notes(s, 160, 170, 'CLÔTURE',
          'Aucun parent ne devrait affronter seul ses médicaments. '
          'Avec NeuroCare, la technologie protège nos aînés dès aujourd’hui. Merci.',
          '(Ne pas relire les 3 chiffres : ils parlent seuls. Pause, sourire. Marge restante : 10 s.)')


# ------------------------------------------------------------------ assemblage
def build():
    BUILD.mkdir(exist_ok=True)
    slide_1_cover()
    slide_2_problem()
    slide_3_value()
    demo_slide, demo_shapes = slide_4_demo()
    slide_5_ethics()
    slide_6_business()
    slide_7_team()
    slide_8_close()

    # Slide 4 : python-pptx a écrit la lecture de la vidéo (au clic) ; on la greffe sous nos apparitions automatiques.
    sld = demo_slide._element
    media = sld.find(qn('p:timing'))
    video_nodes = []
    if media is not None:
        video_nodes = [n for n in media.find('.//' + qn('p:cTn')).find(qn('p:childTnLst')) if n.tag == qn('p:video')]
    animate(demo_slide, demo_shapes, extra_nodes=video_nodes)
    notes(demo_slide, 59, 107, 'CRITÈRE 4 — FAISABILITÉ & DÉMO LIVE',
          'Pas une maquette : notre prototype. Écoutez.',
          'Dire la phrase (≈ 2 s), cliquer sur la vidéo, puis SE TAIRE pendant 45 s : la vidéo porte sa propre voix '
          '(Salma, la fille) et sa musique. Vérifier le son de la salle avant le passage.\n'
          ' 0-12 s   20:00, notification sur le téléphone de Mama : la voix de Salma (repère 1)\n'
          ' 12-26 s  Espace senior : « Réécouter », puis « C’est fait » (repère 2)\n'
          ' 26-36 s  Téléphone de Salma : « Confirmé à 20:02 », mot doux de Salma (repère 3)\n'
          ' 36-45 s  Assistant Santé en darija, PDF horodaté, logo\n'
          'Voix de synthèse (edge-tts) : dans l’application, c’est la vraie voix enregistrée par le proche.\n'
          'Plan B (vidéo bloquée) : montrer l’application sur le téléphone en mode démo hors-ligne, même ordre.',
          media=float(VIDEO_SECONDS))
    TIMELINE.sort(key=lambda r: r[1])

    prs.save(OUT)
    print('deck :', OUT, f'({OUT.stat().st_size / 1e6:.1f} Mo)')
    previous = 0
    for label, start, end, words in TIMELINE:
        assert start == previous, f'trou ou chevauchement avant « {label} »'
        previous = end
        print(f'  {start // 60}:{start % 60:02d}–{end // 60}:{end % 60:02d}  {end - start:>3} s  {words:>3} mots  {label}')
    assert previous == 170, f'durée totale {previous} s (attendu 170 s = 2 min 50 s)'
    print(f'  total : {previous // 60} min {previous % 60:02d} s (marge 10 s)')


def export(pdf=True, png_dir=None):
    """Export par PowerPoint (COM) : PDF fidèle au rendu réel, et PNG optionnels pour la relecture visuelle."""
    pdf_path = OUT.with_suffix('.pdf')
    ps = [f"$app = New-Object -ComObject PowerPoint.Application",
          f"$p = $app.Presentations.Open('{OUT}', $true, $false, $false)"]
    if pdf:
        ps.append(f"$p.SaveAs('{pdf_path}', 32)")
    if png_dir:
        Path(png_dir).mkdir(parents=True, exist_ok=True)
        ps.append(f"foreach ($s in $p.Slides) {{ $s.Export((Join-Path '{png_dir}' ('s' + $s.SlideIndex + '.png')), 'PNG', 1600, 900) }}")
    ps += ['$p.Close()', 'if ($app.Presentations.Count -eq 0) { $app.Quit() }']
    subprocess.run(['powershell', '-NoProfile', '-Command', '; '.join(ps)], check=True)
    if pdf:
        print('pdf  :', pdf_path, f'({pdf_path.stat().st_size / 1e6:.1f} Mo)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--no-pdf', action='store_true')
    ap.add_argument('--png', help='dossier où exporter chaque slide en PNG (relecture)')
    args = ap.parse_args()
    build()
    if not args.no_pdf or args.png:
        export(pdf=not args.no_pdf, png_dir=args.png)
