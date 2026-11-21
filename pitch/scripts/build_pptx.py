"""Génère pitch/NeuroCare_Pitch_Hackathon.pptx : pitch de 5 minutes, 10 slides chronométrées.

- python-pptx pour les formes, images, vidéo et notes présentateur ;
- XML OpenXML injecté pour les ombres douces, les transitions (fondu / poussée) et les animations
  d'apparition (fondu enchaîné automatique des blocs, sans clic).

Prérequis : python pitch/scripts/prepare_assets.py, puis python pitch/scripts/render_video.py (vidéo + --stills).
Usage : python pitch/scripts/build_pptx.py
"""
import copy
import os
import subprocess
from pathlib import Path

import imageio_ffmpeg
from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parents[2]
PITCH = ROOT / 'pitch'
A = PITCH / 'assets'
SCREENS = A / 'screens'
ICONS = A / 'icons'
VIDEO = PITCH / 'NeuroCare_Demo_Modules_45s.mp4'
OUT = Path(os.environ.get('NEUROCARE_PPTX_OUT', PITCH / 'NeuroCare_Pitch_Hackathon.pptx'))  # autre sortie : utile si le deck est ouvert

BG = 'F5F8FC'; WHITE = 'FFFFFF'; BLUE = '246BFD'; NAVY = '112950'; EMERALD = '10B981'
TEXT = '1C2B45'; MUTED = '55657E'; BORDER = 'E6EEF8'; SOFTBLUE = 'EBF2FF'; SOFTGREEN = 'D1FAE5'; RED = 'EF4444'
FONT = 'Calibri'

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
    """Ombre douce (bleu marine à faible opacité) injectée dans spPr."""
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


def box(slide, x, y, w, h, fill=WHITE, line=None, radius=0.12, soft_shadow=True, name=None):
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
    shape.text_frame.text = ''
    if name:
        shape.name = name
    return shape


def circle(slide, x, y, d, fill, name=None, soft=False):
    shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(fill)
    shape.line.fill.background()
    drop_style(shape)
    if soft:
        shadow(shape, blur=10, dist=3, alpha=12)
    if name:
        shape.name = name
    return shape


def text(slide, x, y, w, h, runs, size=16, colour=TEXT, bold=False, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, spacing=None, name=None, italic=False):
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
            f.name = opts.get('font', FONT)
            f.size = Pt(opts.get('size', size))
            f.bold = opts.get('bold', bold)
            f.italic = opts.get('italic', italic)
            f.color.rgb = rgb(opts.get('colour', colour))
            rpr = r._r.get_or_add_rPr()
            for tag in ('a:cs', 'a:ea'):
                el = rpr.find(qn(tag))
                if el is None:
                    el = etree.SubElement(rpr, qn(tag))
                el.set('typeface', 'Segoe UI' if tag == 'a:cs' else FONT)
    if name:
        tb.name = name
    return tb


def image(slide, path, x, y, w=None, h=None, name=None):
    pic = slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w) if w else None, Inches(h) if h else None)
    if name:
        pic.name = name
    return pic


def icon_badge(slide, icon, x, y, d, tint, name=None, scale=.62):
    """Icône Ionicons dans un rond pastel (motif visuel commun au deck)."""
    c = circle(slide, x, y, d, tint, soft=True)
    s = d * scale
    i = image(slide, ICONS / f'{icon}.png', x + (d - s) / 2, y + (d - s) / 2, s, s)
    return group(slide, [c, i], name)


def group(slide, shapes, name=None):
    grp = slide.shapes.add_group_shape(shapes)
    if name:
        grp.name = name
    return grp


def chip(slide, x, y, label, fill=SOFTBLUE, colour=BLUE, size=13, w=None, name=None):
    w = w or (0.32 + len(label) * size * 0.0072)
    b = box(slide, x, y, w, 0.42, fill=fill, radius=0.5, soft_shadow=False)
    t = text(slide, x, y, w, 0.42, label, size=size, colour=colour, bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    return group(slide, [b, t], name)


def title(slide, label, kicker=None, colour=NAVY):
    """Titre de slide de contenu : même position, taille et style partout."""
    shapes = []
    if kicker:
        shapes.append(text(slide, 0.6, 0.42, 9, 0.35, kicker.upper(), size=13, colour=BLUE, bold=True))
    shapes.append(text(slide, 0.6, 0.72, 12.1, 0.8, label, size=36, colour=colour, bold=True))
    return group(slide, shapes, 'Titre')


def footer_logo(slide):
    return image(slide, A / 'neurocare-logo-transparent.png', 12.05, 6.86, h=0.42, name='Logo')


def notes(slide, body):
    slide.notes_slide.notes_text_frame.text = body


# ------------------------------------------------------------------ transitions et animations (OpenXML)
P = 'http://schemas.openxmlformats.org/presentationml/2006/main'


def transition(slide, kind='fade', speed='med'):
    sld = slide._element
    for old in sld.findall(qn('p:transition')):
        sld.remove(old)
    tr = etree.Element(qn('p:transition'), spd=speed)
    if kind == 'fade':
        etree.SubElement(tr, qn('p:fade'))
    elif kind == 'push':
        etree.SubElement(tr, qn('p:push'), dir='u')
    elif kind == 'wipe':
        etree.SubElement(tr, qn('p:wipe'), dir='r')
    # Ordre imposé par le schéma : cSld, clrMapOvr, transition, timing, extLst.
    anchor = sld.find(qn('p:clrMapOvr'))
    if anchor is None:
        anchor = sld.find(qn('p:cSld'))
    anchor.addnext(tr)


def animate(slide, shapes, step_ms=280, dur_ms=550, start_ms=150, effects=None):
    """Apparition automatique en fondu (ou balayage) de chaque bloc, l'un après l'autre, dès l'arrivée de la slide."""
    effects = effects or {}
    ids = iter(range(3, 10_000))
    sld = slide._element
    timing = sld.find(qn('p:timing'))
    if timing is not None:
        sld.remove(timing)

    def ctn(**attrs):
        return etree.Element(qn('p:cTn'), id=str(next(ids)), **attrs)

    group_par = etree.Element(qn('p:par'))
    g = ctn(fill='hold')
    group_par.append(g)
    st = etree.SubElement(g, qn('p:stCondLst'))
    etree.SubElement(st, qn('p:cond'), delay='indefinite')
    on_begin = etree.SubElement(st, qn('p:cond'), evt='onBegin', delay='0')
    etree.SubElement(on_begin, qn('p:tn'), val='2')
    children = etree.SubElement(g, qn('p:childTnLst'))
    inner_par = etree.SubElement(children, qn('p:par'))
    inner = ctn(fill='hold')
    inner_par.append(inner)
    etree.SubElement(etree.SubElement(inner, qn('p:stCondLst')), qn('p:cond'), delay='0')
    effs = etree.SubElement(inner, qn('p:childTnLst'))
    bld = []
    for i, shape in enumerate(shapes):
        spid = str(shape.shape_id)
        kind = effects.get(shape.name, 'fade')
        preset = {'fade': ('10', '0', 'fade'), 'wipe': ('22', '8', 'wipe(left)'), 'wipeUp': ('22', '4', 'wipe(down)')}[kind]
        par = etree.SubElement(effs, qn('p:par'))
        c = ctn(presetID=preset[0], presetClass='entr', presetSubtype=preset[1], fill='hold', nodeType='withEffect')
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
        ae = etree.SubElement(kids, qn('p:animEffect'), transition='in', filter=preset[2])
        cb2 = etree.SubElement(ae, qn('p:cBhvr'))
        cb2.append(ctn(dur=str(dur_ms)))
        etree.SubElement(etree.SubElement(cb2, qn('p:tgtEl')), qn('p:spTgt'), spid=spid)
        if is_sp:
            bld.append(spid)

    timing = etree.Element(qn('p:timing'))
    tn = etree.SubElement(timing, qn('p:tnLst'))
    root_par = etree.SubElement(tn, qn('p:par'))
    root = etree.SubElement(root_par, qn('p:cTn'), id='1', dur='indefinite', restart='never', nodeType='tmRoot')
    seq = etree.SubElement(etree.SubElement(root, qn('p:childTnLst')), qn('p:seq'), concurrent='1', nextAc='seek')
    main = etree.SubElement(seq, qn('p:cTn'), id='2', dur='indefinite', nodeType='mainSeq')
    etree.SubElement(main, qn('p:childTnLst')).append(group_par)
    prev = etree.SubElement(etree.SubElement(seq, qn('p:prevCondLst')), qn('p:cond'), evt='onPrev', delay='0')
    etree.SubElement(etree.SubElement(prev, qn('p:tgtEl')), qn('p:sldTgt'))
    nxt = etree.SubElement(etree.SubElement(seq, qn('p:nextCondLst')), qn('p:cond'), evt='onNext', delay='0')
    etree.SubElement(etree.SubElement(nxt, qn('p:tgtEl')), qn('p:sldTgt'))
    if bld:
        bl = etree.SubElement(timing, qn('p:bldLst'))
        for spid in bld:
            etree.SubElement(bl, qn('p:bldP'), spid=spid, grpId='0')
    tr = sld.find(qn('p:transition'))
    (tr if tr is not None else sld.find(qn('p:clrMapOvr'))).addnext(timing)


# ------------------------------------------------------------------ slides
LRM = '‎'  # garde l'ordre « FR · العربية · الدارجة » dans un paragraphe de gauche à droite


def slide_1_hook():
    """Page de garde moderne : slogan, sous-titre, 2 atouts, logo officiel, signature de l'équipe."""
    s = prs.slides.add_slide(BLANK)
    background(s, NAVY)
    dot = circle(s, 0.75, 0.66, 0.13, EMERALD)
    kick_t = text(s, 1.02, 0.55, 7.5, 0.36, 'SANTÉ SENIOR  •  PRÉ-DÉPISTAGE  •  OBSERVANCE', size=14, colour='93C5FD', bold=True, anchor=MSO_ANCHOR.MIDDLE)
    kick = group(s, [dot, kick_t], 'Surtitre')
    lang = text(s, 10.3, 0.55, 2.28, 0.36, [[('FR', {'bold': True, 'colour': WHITE}), ('   |   ', {'colour': '5B7CB0'}), ('العربية', {'colour': 'E2E8F0'})]],
                size=15, align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE, name='Langues')
    bar = box(s, 0.75, 1.83, 0.67, 0.06, fill=BLUE, radius=0.5, soft_shadow=False, name='Trait')
    slogan = text(s, 0.75, 2.08, 7.3, 2.45, [[('L’alliance de la ', {}), ('voix familiale', {'colour': '7FB0FF'})],
                                             [('et du ', {}), ('pré-dépistage intelligent', {'colour': '6EE7B7'})]], size=40, colour=WHITE, bold=True, name='Slogan')
    sub = text(s, 0.75, 4.55, 7.0, 0.85, 'Une plateforme complète et bilingue pour sécuriser le quotidien des seniors à domicile.',
               size=20, colour='C9D6E8', name='SousTitre')
    feats = []
    for i, (ic, label, tint) in enumerate([('mic-white', 'Rappels vocaux proches', '1F4A86'), ('chatbubble-ellipses-white', '5 bilans + Assistant vocal', '0F6E56')]):
        x = 0.75 + i * 3.35
        b = icon_badge(s, ic, x, 5.52, 0.5, tint, scale=.58)
        t = text(s, x + 0.65, 5.52, 2.65, 0.5, label, size=16, colour=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        feats.append(group(s, [b, t], f'Atout{i + 1}'))
    card = box(s, 8.1, 1.45, 4.48, 4.35, fill='F5F8FC', radius=0.08, name='CarteLogo')
    shadow(card, blur=30, dist=8, alpha=30)
    logo_w = 3.5
    logo = image(s, A / 'neurocare-logo-transparent.png', 8.1 + (4.48 - logo_w) / 2, 1.45 + (4.35 - logo_w * 818 / 984) / 2, w=logo_w, name='LogoNeuroCare')
    line = box(s, 0.75, 6.44, 11.83, 0.015, fill='1E3A6E', radius=0, soft_shadow=False)
    team = text(s, 0.75, 6.62, 3.5, 0.45, 'Équipe NeuroCare', size=17, colour=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    who = text(s, 4.3, 6.62, 8.28, 0.45, '3 élèves-ingénieurs (5ᵉ année, EHEIM Oujda)  ×  2 étudiantes en Médecine Générale (6ᵉ année)',
               size=14, colour='93C5FD', align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)
    sig = group(s, [line, team, who], 'Signature')
    transition(s, 'fade', 'slow')
    animate(s, [kick, lang, bar, slogan, sub, *feats, card, logo, sig], step_ms=260)
    notes(s, """[0:00 – 0:25] — HOOK ÉMOTIONNEL (25 s)

(Silence d'une seconde, regarder le jury.)
« Oujda, 8 heures du matin. Hajja Zahra a 74 ans. Elle vit seule, face à six boîtes de médicaments.
Sa tension ? Personne ne l'a mesurée depuis des mois.
À Casablanca, sa fille l'appelle… pas de réponse. Elle ne sait pas si sa mère a pris son traitement, ni si elle va bien.

Nous sommes l'Équipe NeuroCare : trois élèves-ingénieurs en 5e année Informatique et Gestion à l'EHEIM Oujda,
et deux étudiantes en 6e année de Médecine Générale.
Et voici NeuroCare : l'alliance de la voix familiale et du pré-dépistage intelligent — une plateforme complète
et bilingue, avec des rappels vocaux par la voix d'un proche, cinq bilans et un assistant de santé vocal. »

Timing : histoire 0:00-0:14 · présentation équipe 0:14-0:19 · slogan 0:19-0:25.
(Hajja Zahra est un personnage illustratif.)""")


PLAN = [
    ('alarm', 'Le Problème', 'Une crise silencieuse, à domicile'),
    ('grid', 'La Solution NeuroCare', 'Une seule app — Socle + 5 pôles + Assistant vocal'),
    ('play-circle', 'Démo Live (45 s)', 'Parcours complet sur smartphone'),
    ('heart-circle', 'Notre Différence', 'Pensé pour un senior, pas pour un ingénieur'),
    ('server', 'Architecture Technique', 'Mobile hors-ligne + Microservices Spring Boot'),
    ('shield-checkmark', 'Rigueur Clinique & Éthique', 'La rigueur d’un médecin, la précision d’un ingénieur'),
    ('storefront', 'Impact Social & Modèle', 'Déployable dès demain (B2C & B2B2C)'),
    ('people', 'L’Équipe NeuroCare', 'Ingénierie EHEIM Oujda × Médecine Générale'),
]


def slide_plan():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, 'Ce que nous allons vous présenter', 'Plan de la présentation')
    cards = []
    for i, (ic, head, sub) in enumerate(PLAN):
        x = 0.6 + (i % 4) * 3.09
        y = 1.75 + (i // 4) * 2.55
        c = box(s, x, y, 2.9, 2.3)
        n = text(s, x + 0.28, y + 0.22, 1.4, 0.7, f'{i + 1:02d}', size=34, colour=BLUE, bold=True)
        b = icon_badge(s, ic, x + 2.9 - 0.9, y + 0.27, 0.62, SOFTBLUE)
        h = text(s, x + 0.28, y + 0.9, 2.45, 0.66, head, size=17, colour=NAVY, bold=True, anchor=MSO_ANCHOR.BOTTOM)
        d = text(s, x + 0.28, y + 1.62, 2.45, 0.62, sub, size=13, colour=MUTED)
        cards.append(group(s, [c, n, b, h, d], f'Etape{i + 1:02d}'))
    footer_logo(s)
    transition(s, 'push')
    animate(s, [t, *cards], step_ms=160)
    notes(s, """[0:25 – 0:35] — PLAN (10 s)

« En cinq minutes : le problème, notre solution, une démo de 45 secondes, ce qui nous rend différents,
l'architecture, la rigueur clinique, l'impact, et l'équipe. »

(Ne pas lire les 8 cartes : les laisser apparaître, une phrase suffit.)""")


def slide_2_problem():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, 'Une crise silencieuse, à domicile', 'Le problème')
    stats = [
        ('5 M', 'Marocains de 60 ans et plus (13,8 %)', BLUE, 'people'),
        ('29,3 %', 'des adultes vivent avec une HTA', RED, 'heart'),
        ('1 / 10', 'hypertendus réellement contrôlés', 'F59E0B', 'alarm'),
        ('≈ 50 %', 'des traitements chroniques mal suivis', EMERALD, 'medkit'),
    ]
    cards = []
    for i, (big, label, col, ic) in enumerate(stats):
        x = 0.6 + i * 3.08
        c = box(s, x, 1.85, 2.84, 2.45)
        b = icon_badge(s, ic, x + 0.28, 2.1, 0.62, 'F0F5FF')
        n = text(s, x + 0.28, 2.82, 2.4, 0.9, big, size=46, colour=col, bold=True)
        l = text(s, x + 0.28, 3.62, 2.4, 0.6, label, size=15, colour=TEXT)
        cards.append(group(s, [c, b, n, l], f'Chiffre{i + 1}'))
    pains = [
        ('medkit', 'Polymédication & oublis', 'Plusieurs prises par jour, des oublis critiques, un aidant à distance qui ne sait pas.'),
        ('language', 'Barrière techno & langue', 'Applications complexes, en anglais ou en français, pensées pour les jeunes.'),
        ('eye-off', 'Pathologies silencieuses', 'HTA, diabète, hypoxie, déclin cognitif : détectés trop tard.'),
    ]
    rows = []
    for i, (ic, head, body) in enumerate(pains):
        x = 0.6 + i * 4.1
        c = box(s, x, 4.6, 3.86, 1.72, fill=WHITE)
        b = icon_badge(s, ic, x + 0.25, 4.85, 0.56, SOFTBLUE)
        h = text(s, x + 0.95, 4.85, 2.8, 0.45, head, size=18, colour=NAVY, bold=True)
        d = text(s, x + 0.95, 5.3, 2.75, 0.95, body, size=14, colour=MUTED)
        rows.append(group(s, [c, b, h, d], f'Douleur{i + 1}'))
    src = text(s, 0.6, 6.55, 11.2, 0.6, 'Sources : HCP, RGPH 2024 (60 ans et plus) · Ministère de la Santé / OMS, enquête STEPS 2017-2018 (HTA, adultes 18 ans et +) · '
                                       'OMS, hypertendus de 30-79 ans contrôlés · OMS, « Adherence to long-term therapies » (2003).', size=10, colour=MUTED, name='Sources')
    footer_logo(s)
    transition(s, 'push')
    animate(s, [t, *cards, *rows, src], step_ms=230)
    notes(s, """[0:35 – 1:10] — LE PROBLÈME (35 s)

« Hajja Zahra n'est pas un cas isolé.
Le Maroc compte aujourd'hui 5 millions de personnes de 60 ans et plus — 13,8 % de la population (recensement 2024).
Près d'un adulte sur trois vit avec une hypertension, et seulement un hypertendu sur dix est réellement contrôlé.
Dans le monde, l'OMS estime qu'environ la moitié des traitements chroniques ne sont pas suivis correctement.

Sur le terrain, trois douleurs :
1. la polymédication et les oublis, avec un aidant loin qui ne sait pas ;
2. une barrière technologique et linguistique : les applications de santé sont complexes, en anglais ou en français ;
3. des pathologies silencieuses — HTA, diabète, hypoxie, déclin cognitif — repérées beaucoup trop tard. »

Timing : chiffres 0:35-0:52 · trois douleurs 0:52-1:10.
Sources (en cas de question) : HCP RGPH 2024 ; enquête STEPS 2017-2018 (Ministère de la Santé / OMS) ;
OMS (diagnostic 43 %, traitement 29 %, contrôle 10 % des hypertendus 30-79 ans) ; OMS 2003, observance ≈ 50 %.""")


MODULES = [
    ('pulse', 'Saturation SpO₂', 'Seuils standard / BPCO', '0EA5E9', 'E0F2FE'),
    ('leaf', 'Santé mentale', 'Mini-GDS → GDS-15', '7C3AED', 'F3E8FF'),
    ('water', 'Diabète', 'FINDRISC /26 + 7 signes d’alerte.', 'F59E0B', 'FEF3C7'),
    ('heart', 'Tension (HTA)', '3 j × 18 mesures', 'EF4444', 'FEE2E2'),
    ('extension-puzzle', 'Alzheimer & Mémoire', 'Repérage direct des 4 A & prévention.', '10B981', 'D1FAE5'),
]


def slide_3_solution():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, 'Une seule app. Socle + 5 pôles + Assistant vocal', 'La solution NeuroCare')
    phone = image(s, SCREENS / 'home-fr.png', 0.75, 1.65, h=5.45, name='TelephoneAccueil')
    socle_bg = box(s, 4.0, 1.65, 8.7, 1.4, fill=BLUE)
    socle_ic = icon_badge(s, 'mic-white', 4.28, 1.9, 0.9, '3D7EFF')
    socle_h = text(s, 5.45, 1.8, 7.0, 0.45, 'Socle — Rappels & Suivi vocal', size=22, colour=WHITE, bold=True)
    socle_d = text(s, 5.45, 2.27, 7.05, 0.75, 'Aidant ↔ Senior : rappel lu avec la voix d’un proche, un seul bouton « C’est fait », tableau de bord en temps réel.',
                   size=14, colour='E3EDFF')
    socle = group(s, [socle_bg, socle_ic, socle_h, socle_d], 'Socle')
    mods = []
    for i, (ic, name, sub, col, tint) in enumerate(MODULES):
        x = 4.0 + i * 1.77
        c = box(s, x, 3.22, 1.6, 1.98)
        b = icon_badge(s, ic, x + 0.5, 3.36, 0.6, tint)
        n = text(s, x + 0.08, 4.02, 1.44, 0.5, name, size=13, colour=NAVY, bold=True, align=PP_ALIGN.CENTER)
        d = text(s, x + 0.08, 4.5, 1.44, 0.65, sub, size=11, colour=MUTED, align=PP_ALIGN.CENTER)
        mods.append(group(s, [c, b, n, d], f'Pole{i + 1}'))
    # Nouveauté : l'Assistant Santé vocal trilingue, accessible dès l'accueil.
    as_bg = box(s, 4.0, 5.38, 8.7, 1.62, fill=NAVY)
    as_ic = icon_badge(s, 'chatbubble-ellipses-white', 4.28, 5.62, 0.9, BLUE)
    as_tag = chip(s, 5.45, 5.52, 'NOUVEAU', fill='0F6E56', colour='D1FAE5', size=11, w=1.05)
    as_h = text(s, 6.62, 5.5, 5.95, 0.45, [[('Assistant Santé vocal trilingue  ', {}), (f'FR · العربية{LRM} · الدارجة{LRM}', {'colour': '7FB0FF'})]],
                size=18, colour=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    as_d = text(s, 5.45, 6.02, 7.1, 0.4, 'Accessible dès l’accueil (bouton flottant) : on parle, il répond et lit sa réponse à voix haute.', size=13.5, colour='C9D6E8')
    pills, x = [], 5.45
    for lab, w in [('100 % hors ligne', 1.7), ('Écran unique, sans scroll', 2.35), ('Sources OMS · HAS · ESC · FID', 2.75)]:
        pills.append(chip(s, x, 6.47, lab, fill='1F4A86', colour='6EE7B7', size=12, w=w))
        x += w + 0.12
    assistant = group(s, [as_bg, as_ic, as_tag, as_h, as_d, *pills], 'Assistant')
    transition(s, 'fade')
    animate(s, [t, phone, socle, *mods, assistant], step_ms=200)
    notes(s, """[1:10 – 1:55] — LA SOLUTION (45 s)

« NeuroCare, c'est une seule application, pensée pour l'ergonomie d'un senior marocain.

Au centre, un socle d'observance vocale qui relie l'aidant et le senior : à l'heure du médicament, le téléphone
lit le rappel avec la VOIX d'un proche — sa fille, son fils. Le senior n'a qu'un seul gros bouton : « C'est fait ».
Et l'aidant le voit en temps réel sur son téléphone.

Autour de ce socle, cinq pôles cliniques de pré-dépistage : saturation en oxygène, santé mentale, diabète —
le FINDRISC sur 26 plus 7 signes d'alerte —, tension artérielle, et mémoire avec un repérage direct des 4 A.
Ces pôles sont 100 % autonomes : pas de compte, pas de réseau, les données restent sur le téléphone.

Et c'est nouveau : un Assistant Santé vocal, accessible dès l'accueil, en français, en arabe et en darija.
On lui parle, il répond sur un seul écran sans défilement, avec ses sources — OMS, HAS, ESC, FID —
et il lit sa réponse à voix haute. Lui aussi fonctionne sans réseau. Il informe et oriente, il ne diagnostique jamais. »

Timing : socle 1:10-1:28 · 5 pôles 1:28-1:40 · assistant 1:40-1:55.""")


def slide_4_demo():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, 'Démonstration — 45 secondes', 'Démo live')
    frame = box(s, 0.6, 1.65, 8.25, 4.64 + 0.0, fill=NAVY, radius=0.04, name='CadreVideo')
    shadow(frame, blur=30, dist=8, alpha=22)
    poster = PITCH / 'build' / 'poster.png'
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-ss', '13.9', '-i', str(VIDEO), '-frames:v', '1', str(poster)], check=True)
    movie = s.shapes.add_movie(str(VIDEO), Inches(0.68), Inches(1.73), Inches(8.09), Inches(4.48), poster_frame_image=str(poster), mime_type='video/mp4')
    movie.name = 'VideoDemo'
    hint = text(s, 0.6, 6.42, 8.25, 0.4, 'Cliquer sur la vidéo pour la lancer · NeuroCare_Demo_45s.mp4 (1080p, 60 i/s, musique originale)', size=12, colour=MUTED,
                align=PP_ALIGN.CENTER, name='Consigne')
    points = [
        ('language', f'FR ⇄ العربية{LRM} ⇄ الدارجة{LRM}', 'bascule instantanée, RTL'),
        ('chatbubble-ellipses', 'Assistant Santé vocal', 'sans scroll, 18 sujets OMS/HAS'),
        ('mic', 'Rappel vocal familial', '« C’est fait », aidant prévenu'),
        ('water', 'Bilans guidés', 'FINDRISC + 7 signes, 4 A directs'),
        ('document-text', 'PDF horodaté', 'rapport nominatif au médecin'),
    ]
    items = []
    head = text(s, 9.25, 1.65, 3.6, 0.4, 'À OBSERVER', size=13, colour=BLUE, bold=True, name='AObserver')
    for i, (ic, h, d) in enumerate(points):
        y = 2.1 + i * 0.86
        b = icon_badge(s, ic, 9.25, y, 0.62, SOFTBLUE)
        a = text(s, 10.0, y - 0.02, 3.0, 0.38, h, size=17, colour=NAVY, bold=True)
        c = text(s, 10.0, y + 0.33, 3.0, 0.34, d, size=13, colour=MUTED)
        items.append(group(s, [b, a, c], f'Point{i + 1}'))
    footer_logo(s)
    transition(s, 'fade')
    return s, [t, frame, hint, head, *items]


def slide_5_different():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, 'Pensé pour un senior, pas pour un ingénieur', 'Pourquoi NeuroCare est différent')
    cols = [
        ('home-fr.png', 'grid', 'Zéro surcharge cognitive', 'Une grille d’icônes façon lanceur d’apps, gros textes, gros boutons.'),
        ('cardio-guide.png', 'medical', 'L’appareil dessiné', 'Tensiomètre, oxymètre, glucomètre : quel chiffre recopier, conseil pharmacie, à jeun / au repos.'),
        ('assistant-dj.png', 'language', 'Trilingue FR | AR | Darija', 'Reconnaissance et lecture vocales adaptées aux seniors (débit ralenti), écran sans scroll, droite-à-gauche.'),
    ]
    cards = []
    for i, (img, ic, head, body) in enumerate(cols):
        x = 0.6 + i * 4.1
        c = box(s, x, 1.65, 3.86, 4.85)
        pane = box(s, x + 0.2, 1.85, 3.46, 3.0, fill='EEF4FC', radius=0.08, soft_shadow=False)
        ph = image(s, SCREENS / img, x + 1.93 - 0.72, 1.98, h=2.75)
        b = icon_badge(s, ic, x + 0.25, 5.05, 0.56, SOFTBLUE)
        h = text(s, x + 0.95, 5.06, 2.8, 0.5, head, size=18, colour=NAVY, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        d = text(s, x + 0.25, 5.72, 3.4, 1.05, body, size=14, colour=MUTED)
        cards.append(group(s, [c, pane, ph, b, h, d], f'Atout{i + 1}'))
    footer_logo(s)
    transition(s, 'push')
    animate(s, [t, *cards], step_ms=330)
    notes(s, """[2:40 – 3:15] — POURQUOI C'EST DIFFÉRENT (35 s)

« Ce qui nous différencie, c'est l'ergonomie.
Un : zéro surcharge cognitive. L'accueil est une grille d'icônes, comme le lanceur d'applications du téléphone :
gros textes, gros boutons, aucun menu caché.
Deux : l'appareil est dessiné. Le senior voit son tensiomètre, son oxymètre, son lecteur de glycémie, et le code couleur
lui dit quel chiffre recopier dans quel champ. Pas d'appareil ? L'application l'oriente vers la pharmacie de proximité,
avec les bonnes conditions : au repos, à jeun.
Trois : le trilingue. Français, arabe et darija : l'application passe de droite à gauche en un toucher, et l'Assistant Santé
comprend la darija parlée — « nsit dwa » — et répond à voix haute, lentement, sur un seul écran sans défilement. »

Timing : 3 atouts × ~11 s.""")


def slide_6_architecture():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, 'Robuste par conception', 'Architecture technique')
    # Mobile
    mob = box(s, 0.6, 1.7, 5.2, 4.1)
    mob_b = icon_badge(s, 'phone-portrait', 0.85, 1.92, 0.62, SOFTBLUE)
    mob_h = text(s, 1.6, 1.9, 4.0, 0.7, [[('Application mobile', {'bold': True, 'colour': NAVY, 'size': 20})], [('React Native · Expo SDK 58 · TypeScript', {'colour': MUTED, 'size': 13})]])
    m1 = box(s, 0.85, 2.85, 4.7, 1.25, fill=SOFTGREEN, radius=0.1, soft_shadow=False)
    m1t = text(s, 1.05, 2.95, 4.35, 1.1, [[('5 pôles + Assistant Santé autonomes', {'bold': True, 'colour': '065F46', 'size': 16})],
                                          [('Règles cliniques pures + AsyncStorage : 100 % hors ligne, PDF générés sur le téléphone', {'colour': '065F46', 'size': 13})]])
    m2 = box(s, 0.85, 4.3, 4.7, 1.25, fill=SOFTBLUE, radius=0.1, soft_shadow=False)
    m2t = text(s, 1.05, 4.4, 4.35, 1.1, [[('Module 1 — Rappels & Suivi', {'bold': True, 'colour': '1E40AF', 'size': 16})],
                                         [('Notifications locales, voix préchargées, file d’attente hors ligne', {'colour': '1E40AF', 'size': 13})]])
    mobile = group(s, [mob, mob_b, mob_h, m1, m1t, m2, m2t], 'Mobile')
    # Flèche
    arrow = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(5.95), Inches(4.55), Inches(1.15), Inches(0.75))
    arrow.fill.solid(); arrow.fill.fore_color.rgb = rgb(BLUE); arrow.line.fill.background(); arrow.name = 'Fleche'; drop_style(arrow)
    arrow_t = text(s, 5.85, 3.75, 1.35, 0.75, 'REST + WebSocket STOMP', size=11, colour=BLUE, bold=True, align=PP_ALIGN.CENTER, name='Protocole')
    # Backend
    back = box(s, 7.25, 1.7, 5.45, 4.1)
    back_b = icon_badge(s, 'server', 7.5, 1.92, 0.62, 'E8EDF5')
    back_h = text(s, 8.25, 1.9, 4.3, 0.7, [[('Backend Docker', {'bold': True, 'colour': NAVY, 'size': 20})], [('Microservices Spring Boot 3.5 · Java 21', {'colour': MUTED, 'size': 13})]])
    techs = [('PostgreSQL 16', 'Flyway V1 → V10'), ('Spring Security', 'JWT aidant + jeton senior'), ('WebSocket STOMP', 'tableau de bord live'),
             ('MinIO', 'voix des proches'), ('FastAPI', 'service audio'), ('OpenPDF', 'rapport hebdomadaire')]
    tiles = []
    for i, (h, d) in enumerate(techs):
        x = 7.5 + (i % 2) * 2.55
        y = 2.72 + (i // 2) * 0.74
        tb = box(s, x, y, 2.4, 0.66, fill='F5F8FC', radius=0.12, soft_shadow=False, line=BORDER)
        tt = text(s, x + 0.15, y + 0.06, 2.15, 0.58, [[(h, {'bold': True, 'colour': NAVY, 'size': 13})], [(d, {'colour': MUTED, 'size': 11})]])
        tiles.extend([tb, tt])
    # Nouveau microservice indépendant de l'Assistant Santé.
    asv = box(s, 7.5, 4.97, 4.95, 0.72, fill=SOFTGREEN, radius=0.12, soft_shadow=False, line='A7F3D0')
    asv_t = text(s, 7.65, 5.0, 4.7, 0.66, [[('assistant-service', {'bold': True, 'colour': '065F46', 'size': 13, 'font': 'Consolas'}), ('  ·  port 8089', {'bold': True, 'colour': '065F46', 'size': 13})],
                                         [('Base médicale versionnée (OMS · HAS · ESC · FID), sync hors-ligne', {'colour': '065F46', 'size': 11})]], anchor=MSO_ANCHOR.MIDDLE)
    backend = group(s, [back, back_b, back_h, *tiles, asv, asv_t], 'Backend')
    # Qualité
    stats = [('256', 'tests mobile automatisés'), ('255', 'tests backend (245 + 10 assistant-service)'), ('0', 'diagnostic : mentions vérifiées par EthicsTest')]
    qs = []
    for i, (big, lab) in enumerate(stats):
        x = 0.6 + i * 4.1
        c = box(s, x, 6.0, 3.86, 0.95, fill=NAVY, radius=0.18)
        n = text(s, x + 0.25, 6.0, 1.1, 0.95, big, size=32, colour='6EE7B7', bold=True, anchor=MSO_ANCHOR.MIDDLE)
        l = text(s, x + 1.35, 6.0, 2.4, 0.95, lab, size=13, colour=WHITE, anchor=MSO_ANCHOR.MIDDLE)
        qs.append(group(s, [c, n, l], f'Qualite{i + 1}'))
    transition(s, 'fade')
    animate(s, [t, mobile, arrow_t, arrow, backend, *qs], step_ms=280, effects={'Fleche': 'wipe'})
    notes(s, """[3:15 – 3:50] — ARCHITECTURE & ROBUSTESSE (35 s)

« Côté technique, deux mondes qui ne se gênent pas.
À gauche, l'application mobile en React Native et Expo SDK 58. Les cinq pôles cliniques sont des règles pures,
stockées localement avec AsyncStorage : ils marchent sans réseau et génèrent leur PDF sur le téléphone.
À droite, les microservices Spring Boot en Java 21, déployés avec Docker : le backend du socle aidant–senior
(PostgreSQL versionné avec Flyway, tableau de bord en temps réel par WebSocket), et un nouveau microservice indépendant,
assistant-service, sur le port 8089 : il sert la base médicale versionnée de l'Assistant Santé (OMS, HAS, ESC, FID),
que le téléphone synchronise puis garde pour fonctionner hors ligne.

Et la qualité est mesurée : 256 tests automatisés côté mobile, 255 côté serveur (245 pour le backend, 10 pour
assistant-service), dont un test d'éthique qui vérifie que chaque écran, chaque API et chaque PDF rappelle que ce n'est
pas un diagnostic. »

Timing : mobile 3:15-3:28 · backend 3:28-3:40 · tests 3:40-3:50.""")


def slide_7_clinical():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, 'La rigueur d’un médecin, la précision d’un ingénieur', 'Rigueur clinique & éthique')
    duo = box(s, 0.6, 1.7, 4.0, 5.2, fill=NAVY, radius=0.08)
    duo_items = []
    for i, (ic, big, lab) in enumerate([('medical', '2', 'futures médecins\n6ᵉ année de Médecine Générale'), ('school', '3', 'élèves-ingénieurs\nInformatique & Gestion — EHEIM')]):
        y = 2.05 + i * 1.75
        b = icon_badge(s, f'{ic}-white', 0.95, y + 0.1, 0.8, '1F4A86')
        n = text(s, 1.95, y - 0.05, 0.9, 0.95, big, size=50, colour='6EE7B7', bold=True)
        l = text(s, 2.6, y + 0.1, 1.9, 1.1, lab, size=14, colour=WHITE)
        duo_items += [b, n, l]
    plus = text(s, 0.95, 5.55, 3.4, 1.1, 'Chaque seuil validé par le binôme, chaque règle couverte par un test.', size=15, colour='C9D6E8', italic=True)
    duo_g = group(s, [duo, *duo_items, plus], 'Binome')
    # Trois piliers seulement, lisibles en 3 secondes ; les détails techniques sont dans les notes.
    pillars = [
        ('medkit', SOFTBLUE, 'Échelles médicales validées', 'FINDRISC + 7 signes · GDS-15 · HTA 3 j · SpO₂ · 4 A · 18 fiches OMS/HAS'),
        ('shield-checkmark', SOFTGREEN, 'Aide à la décision, jamais de diagnostic', 'Oriente vers le médecin, zéro verdict'),
        ('call', 'FEE2E2', 'Sécurité & urgences intégrées', 'Appel 15 / 141 en un geste, consentement'),
    ]
    cards = []
    for i, (ic, tint, head, sub) in enumerate(pillars):
        y = 1.7 + i * 1.85
        c = box(s, 4.9, y, 7.8, 1.5)
        b = icon_badge(s, ic, 5.2, y + 0.3, 0.9, tint)
        h = text(s, 6.4, y + 0.27, 6.1, 0.55, head, size=24, colour=NAVY, bold=True)
        d = text(s, 6.4, y + 0.85, 6.2, 0.45, sub, size=15, colour=MUTED)
        cards.append(group(s, [c, b, h, d], f'Pilier{i + 1}'))
    transition(s, 'push')
    animate(s, [t, duo_g, *cards], step_ms=350)
    notes(s, """[3:50 – 4:20] — RIGUEUR CLINIQUE & ÉTHIQUE (30 s)
(Idéalement porté par une des deux étudiantes en médecine.)

« Notre force, c'est le binôme médecine–ingénierie. Trois piliers :

1. Des échelles médicales validées. Nous n'avons rien inventé côté clinique : FINDRISC et ses 7 signes d'alerte, GDS-15,
   automesure HTA, SpO₂, les 4 A, et 18 fiches de l'Assistant Santé tirées de l'OMS et de la HAS.
2. De l'aide à la décision, jamais de diagnostic : NeuroCare oriente vers le médecin, il ne rend aucun verdict.
3. La sécurité d'abord : en cas d'alerte rouge, l'appel au 15 ou au 141 est à un geste, et rien ne se fait sans consentement. »

Timing : binôme 3:50-3:58 · pilier 1 3:58-4:06 · pilier 2 4:06-4:13 · pilier 3 4:13-4:20.

DÉTAILS TECHNIQUES (pour les questions du jury, pas à lire) :
- Santé mentale : Mini-GDS (4 questions) ; si une réponse le justifie, GDS-15 complète (16 questions au total), score /15.
- Diabète : FINDRISC, 8 critères, score /26, IMC calculé, risque estimé de diabète de type 2 à 10 ans ; partie 2 hors score :
  7 signes cardinaux d'hyperglycémie (urines fréquentes, soif intense, fatigue, bouche sèche, vision floue, faim, amaigrissement)
  → alerte dès 1 signe, prioritaire dès 2 signes ou pour la triade urines + soif + amaigrissement.
- Assistant Santé : 18 fiches sourcées (OMS, HAS, ESC, FID), français / arabe / darija, jamais de diagnostic ;
  signes de gravité → appel 15 / 141.
- Tension : automesure 3 jours × 18 mesures (3 le matin, 3 le soir), moyenne ; urgence ≥ 180/110, vigilance 135-179 / 85-109,
  normale < 135/85, hypotension TAS < 100.
- SpO₂ : profil standard 95-100 % ; profil BPCO / insuffisance respiratoire 88-92 % ; alertes orange et rouge.
- Alzheimer & Mémoire : 8 questions directes à la 2e personne sur les 4 A (amnésie, aphasie, apraxie, agnosie) + jeu des 4 mots ; aucun score Alzheimer,
  seulement un indice de vigilance à 2 issues (rassurant / signes à signaler au médecin).
- Barème recalculé : le serveur recalcule toujours le score, il ne reprend jamais celui envoyé par l'application.
- Formulations « indicateurs compatibles avec… » ; chaque écran, réponse d'API et PDF porte la mention de non-diagnostic
  (vérifiée par EthicsTest et les tests mobile, en français et en arabe).
- Consentement : 4 consentements séparés (rappels, exercices, partage familial, voix), révocables à tout moment.
- Mention : outils de pré-dépistage et d'aide à la décision médicale ; ils orientent vers le médecin, ils ne le remplacent pas.""")


def slide_8_impact():
    s = prs.slides.add_slide(BLANK)
    background(s, BG)
    t = title(s, 'Déployable dès demain', 'Impact social & modèle')
    chans = [('home', 'Familles', 'aidants à distance'), ('people', 'Associations', 'seniors et aidants'),
             ('storefront', 'Pharmacies', 'de proximité : la mesure + le relevé'), ('business', 'Cliniques', 'et centres de soins')]
    cs = []
    for i, (ic, h, d) in enumerate(chans):
        x = 0.6 + i * 3.08
        c = box(s, x, 1.7, 2.84, 1.9)
        b = icon_badge(s, ic, x + 1.07, 1.88, 0.7, SOFTGREEN)
        a = text(s, x + 0.15, 2.65, 2.54, 0.4, h, size=18, colour=NAVY, bold=True, align=PP_ALIGN.CENTER)
        e = text(s, x + 0.15, 3.05, 2.54, 0.45, d, size=13, colour=MUTED, align=PP_ALIGN.CENTER)
        cs.append(group(s, [c, b, a, e], f'Canal{i + 1}'))
    b2c = box(s, 0.6, 3.95, 6.0, 2.75, fill=WHITE)
    b2c_chip = chip(s, 0.9, 4.2, 'B2C · FREEMIUM', fill=SOFTBLUE, colour=BLUE, size=13, w=2.0)
    b2c_h = text(s, 0.9, 4.8, 5.5, 0.5, 'Pour les familles', size=22, colour=NAVY, bold=True)
    b2c_d = text(s, 0.9, 5.3, 5.5, 1.5, [
        [('Gratuit : ', {'bold': True, 'colour': NAVY}), ('les 5 pôles de pré-dépistage, hors ligne.', {})],
        [('Premium : ', {'bold': True, 'colour': NAVY}), ('suivi aidant en temps réel, voix familiale, rapports pour le médecin.', {})],
    ], size=15, colour=TEXT, spacing=6)
    b2b = box(s, 6.75, 3.95, 5.95, 2.75, fill=NAVY)
    b2b_chip = chip(s, 7.05, 4.2, 'B2B2C', fill='1F4A86', colour='6EE7B7', size=13, w=1.3)
    b2b_h = text(s, 7.05, 4.8, 5.4, 0.5, 'Mutuelles, pharmacies, centres de soins', size=22, colour=WHITE, bold=True)
    b2b_d = text(s, 7.05, 5.3, 5.4, 1.5, [
        [('Licence par structure : ', {'bold': True, 'colour': WHITE}), ('NeuroCare offert à leurs adhérents et patients.', {})],
        [('Valeur : ', {'bold': True, 'colour': WHITE}), ('prévention, observance, relevés datés prêts pour la consultation.', {})],
    ], size=15, colour='C9D6E8', spacing=6)
    b2c_g = group(s, [b2c, b2c_chip, b2c_h, b2c_d], 'B2C')
    b2b_g = group(s, [b2b, b2b_chip, b2b_h, b2b_d], 'B2B2C')
    footer_logo(s)
    transition(s, 'fade')
    animate(s, [t, *cs, b2c_g, b2b_g], step_ms=250)
    notes(s, """[4:20 – 4:45] — IMPACT & DÉPLOIEMENT (25 s)

« NeuroCare est déployable dès demain : l'application Android est déjà construite et se met à jour à distance.
Quatre portes d'entrée : les familles, les associations de seniors, les pharmacies de proximité — qui font la mesure
et repartent avec un relevé propre — et les cliniques et centres de soins.

Notre modèle : un freemium pour les familles — les cinq pôles de pré-dépistage restent gratuits et hors ligne,
le suivi aidant, la voix et les rapports sont premium — et un modèle B2B2C où mutuelles, pharmacies et centres
de soins offrent NeuroCare à leurs adhérents. »

Timing : canaux 4:20-4:32 · modèle 4:32-4:45.""")


def slide_9_team():
    s = prs.slides.add_slide(BLANK)
    background(s, NAVY)
    card = box(s, 0.75, 0.8, 7.3, 4.2, fill=WHITE, radius=0.08)
    team_t = text(s, 1.15, 1.1, 6.6, 0.5, 'Équipe NeuroCare', size=28, colour=NAVY, bold=True)
    members = []
    for i in range(5):
        med = i >= 3
        x = 1.15 + i * 1.3
        c = circle(s, x, 1.95, 1.05, SOFTGREEN if med else SOFTBLUE, soft=True)
        ic = image(s, ICONS / ('medical.png' if med else 'school.png'), x + 0.25, 2.2, 0.55, 0.55)
        members += [c, ic]
    lab1 = text(s, 1.15, 3.2, 3.8, 1.2, [[('3 élèves-ingénieurs', {'bold': True, 'colour': NAVY, 'size': 17})],
                                          [('5ᵉ année Informatique & Gestion — EHEIM Oujda', {'colour': MUTED, 'size': 13})]])
    lab2 = text(s, 5.05, 3.2, 2.8, 1.2, [[('2 étudiantes', {'bold': True, 'colour': '065F46', 'size': 17})],
                                          [('6ᵉ année de Médecine Générale', {'colour': MUTED, 'size': 13})]])
    names = text(s, 1.15, 4.08, 6.6, 0.75, ['Loubna RAHHAOUI  ·  Hanae QANDOUSSI  ·  Ziad EL YAZIDI', 'Fahd BENBALI  ·  Mehdi EL MAHI'],
                 size=13.5, colour=NAVY, bold=True)
    team = group(s, [card, team_t, *members, lab1, lab2, names], 'Equipe')
    closing = text(s, 0.75, 5.25, 7.6, 1.6, [
        [('Aucun parent ne devrait affronter seul ses médicaments.', {'colour': WHITE, 'bold': True, 'size': 26})],
        [('Équipe NeuroCare — laissez NeuroCare veiller sur ceux que vous aimez.', {'colour': '6EE7B7', 'size': 18, 'italic': True})],
    ], spacing=8, name='Cloture')
    qr_card = box(s, 8.85, 0.8, 3.75, 5.9, fill=WHITE, radius=0.08, name=None)
    qr = image(s, A / 'qr-github.png', 9.17, 1.05, 3.1, 3.1)
    url = text(s, 8.95, 4.25, 3.55, 0.9, [[('Code source & démo', {'bold': True, 'colour': NAVY, 'size': 15})],
                                          [('github.com/Ziadelyazidi07/NeuroCare1', {'colour': BLUE, 'size': 12})]], align=PP_ALIGN.CENTER)
    logo = image(s, A / 'neurocare-logo-transparent.png', 9.95, 5.2, h=1.3)
    qr_g = group(s, [qr_card, qr, url, logo], 'QRCode')
    logo_bg = None
    transition(s, 'fade', 'slow')
    animate(s, [team, qr_g, closing], step_ms=550)
    notes(s, """[4:45 – 5:00] — ÉQUIPE & CLOSING (15 s)

« Nous sommes l'Équipe NeuroCare — Loubna Rahhaoui, Hanae Qandoussi, Ziad El Yazidi, Fahd Benbali et Mehdi El Mahi :
trois élèves-ingénieurs en 5e année Informatique et Gestion à l'EHEIM Oujda, et deux étudiantes en 6e année de Médecine Générale.
Nous croyons qu'aucun parent ne devrait affronter seul ses médicaments.
Laissez NeuroCare veiller sur ceux que vous aimez.
Merci. Le code et la démo sont derrière ce QR code. »

(Pause, sourire, laisser le QR code affiché pour les questions.)""")
    return logo_bg


# ------------------------------------------------------------------ assemblage
slide_1_hook()
slide_plan()
slide_2_problem()
slide_3_solution()
demo_slide, demo_shapes = slide_4_demo()
slide_5_different()
slide_6_architecture()
slide_7_clinical()
slide_8_impact()
slide_9_team()

# Slide 4 : python-pptx a déjà écrit le minutage de lecture de la vidéo ; on ajoute nos apparitions avant.
sld = demo_slide._element
media_timing = sld.find(qn('p:timing'))
media_timing = copy.deepcopy(media_timing) if media_timing is not None else None
animate(demo_slide, demo_shapes, step_ms=220)
if media_timing is not None:
    # Réinsère le nœud média (lecture au clic) dans la nouvelle séquence principale.
    timing = sld.find(qn('p:timing'))
    root_ctn = timing.find('.//' + qn('p:cTn'))
    for node in media_timing.find('.//' + qn('p:cTn')).find(qn('p:childTnLst')):
        if node.tag == qn('p:video'):
            root_ctn.find(qn('p:childTnLst')).append(node)
    # Renumérote les identifiants cTn pour qu'ils restent uniques.
    for i, c in enumerate(timing.iter(qn('p:cTn')), start=1):
        c.set('id', str(i))
    # Les références <p:tn val="2"/> pointent vers la séquence principale (id 2).
notes(demo_slide, """[1:55 – 2:40] — DÉMONSTRATION (45 s)

Cliquer sur la vidéo pour la lancer (45 s). Elle a une musique instrumentale originale (« NeuroCare Launch Theme ») :
vérifier le son de la salle avant le passage ; parler par-dessus pendant la vidéo, la musique est mixée à un niveau standard (-14 LUFS).
Repères pour commenter :
 0-6 s   « L'accueil : six modules en grille d'icônes, et le bouton bleu Assistant Santé. Un toucher : tout passe en arabe, de droite à gauche. »
 6-15 s  « L'Assistant Santé : on choisit la darija, on appuie sur le micro… "nsit dwa". Une seule carte, sans défilement, la source OMS · HAS, et il lit sa réponse à voix haute. Même chose en français. »
 15-24 s « Diabète : l'IMC se calcule tout seul, score FINDRISC sur 26. Soif intense et urines fréquentes : deux signes cardinaux, donc alerte clinique prioritaire vers le médecin. »
 24-33 s « Alzheimer : des questions directes — "Oubliez-vous… ?" — puis le jeu des 4 mots. Et dans Tension, le tensiomètre est dessiné : quel chiffre recopier. »
 33-41 s « Module 1, en mode démo : 8 h, Hajja Zahra entend la voix de Salma, sa fille — Metformine 850 mg. Un seul bouton : C'est fait. Chez Salma, la pastille passe au vert, en temps réel. »
 41-45 s « Et pour le médecin : un rapport PDF nominatif, horodaté, nommé automatiquement. »

Plan B (pas de vidéo) : montrer l'application en direct sur le téléphone, même ordre.""")

prs.save(OUT)
print('deck :', OUT, f'({OUT.stat().st_size / 1e6:.1f} Mo)')
