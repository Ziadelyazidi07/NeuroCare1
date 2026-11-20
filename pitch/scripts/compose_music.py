"""Compose « NeuroCare Launch Theme » : une musique instrumentale originale de 45 s, style « corporate launch »,
synthétisée entièrement en Python (numpy). Aucun échantillon externe : pas de question de droits d'auteur.
Le morceau est calé sur les scènes de la démo, puis mixé dans pitch/NeuroCare_Demo_45s.mp4 (vidéo copiée telle quelle).

Forme (120 BPM, do majeur, 1 mesure = 2 s) :
  0-3 s    intro : nappe qui monte, arpège de cloches sur le logo
  3-8 s    couplet : piano en arpèges, basse, grosse caisse légère          (grille des 6 modules)
  8-15 s   montée : claps et charleston                                       (bascule FR -> العربية)
  15-25 s  pont émotionnel : la mineur, nappe et piano, batterie retenue     (voix du proche, « C'est fait »)
  25-37 s  refrain : grosse caisse 4 temps, basse pulsée, mélodie lead        (modules, alertes, 4 A)
  37-42 s  montée finale : roulement de caisse claire et riser               (rapport PDF)
  42-45 s  impact final sur le logo, accord tenu qui s'éteint                (écran de fin)

Usage :
  python pitch/scripts/compose_music.py                     # compose la musique originale et la mixe (après render_video.py)
  python pitch/scripts/compose_music.py --track musique.mp3 # utilise plutôt une musique sous licence (coupée à 45 s,
                                                            # fondu de sortie, même normalisation -14 LUFS)
"""
import argparse
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
PITCH = ROOT / 'pitch'
VIDEO = PITCH / 'NeuroCare_Demo_45s.mp4'
MUSIC_DIR = PITCH / 'assets' / 'music'
WAV = PITCH / 'build' / 'neurocare-launch-theme.wav'
M4A = MUSIC_DIR / 'neurocare-launch-theme.m4a'

SR = 48_000
DUR = 45.0
BPM = 120
BEAT = 60 / BPM
N = int(SR * DUR)
rng = np.random.default_rng(2026)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def stereo():
    return np.zeros((2, N))


def place(bus, sig, t, pan=0.0, gain=1.0):
    """Ajoute un son mono (ou stéréo) au bus à l'instant t, avec panoramique à puissance constante."""
    i = int(t * SR)
    if i >= N:
        return
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(a), sig * np.sin(a)])
    n = min(sig.shape[1], N - i)
    bus[:, i:i + n] += gain * sig[:, :n]


def env(n, attack, release, sustain_end=None):
    e = np.ones(n)
    a = max(1, int(attack * SR))
    e[:a] = np.linspace(0, 1, a)
    r = max(1, int(release * SR))
    e[-r:] *= np.linspace(1, 0, r)
    return e


def fft_filter(x, lo=None, hi=None, slope=1.0):
    """Filtre passe-bas / passe-haut doux dans le domaine fréquentiel (sans scipy)."""
    X = np.fft.rfft(x, axis=-1)
    f = np.fft.rfftfreq(x.shape[-1], 1 / SR)
    h = np.ones_like(f)
    if hi:
        h *= 1 / np.sqrt(1 + (f / hi) ** (4 * slope))
    if lo:
        h *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (4 * slope))
    return np.fft.irfft(X * h, n=x.shape[-1], axis=-1)


def reverb(bus, seconds=2.2, mix=0.25, predelay=0.02):
    """Réverbération par convolution avec une réponse impulsionnelle synthétique (bruit décroissant, stéréo)."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-t / (seconds / 6.9))
    ir = fft_filter(ir, lo=180, hi=7000)
    ir[:, :int(predelay * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    size = 1 << int(np.ceil(np.log2(N + n)))
    wet = np.fft.irfft(np.fft.rfft(bus, size, axis=-1) * np.fft.rfft(ir, size, axis=-1), size, axis=-1)[:, :N]
    return bus * (1 - mix) + wet * mix * 2.2


# ------------------------------------------------------------------ instruments
def piano(note, dur, vel=1.0):
    f = midi(note)
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for k, (amp, dec) in enumerate([(1, 1.4), (.55, .9), (.32, .6), (.18, .4), (.10, .3), (.06, .2)], start=1):
        detune = 1 + 0.0007 * k * k
        s += amp * np.sin(2 * np.pi * f * k * detune * t) * np.exp(-t / dec)
    s *= env(n, .004, .08)
    hammer = rng.standard_normal(n) * np.exp(-t / .004) * .15
    return (s + hammer) * vel * 0.22


def bell(note, vel=1.0):
    f = midi(note)
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 1.1) + .45 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / .5)
    s += .25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / .25)
    return s * env(n, .002, .3) * vel * 0.12


def pad(notes, dur, vel=1.0, attack=1.2, release=1.5, bright=2600):
    """Nappe « supersaw » : 3 dents de scie désaccordées par note, gauche/droite différentes, filtrées."""
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for note in notes:
        f = midi(note)
        for ch, dets in enumerate(([-11, 0, 7], [-6, 3, 12])):
            for c in dets:
                fr = f * 2 ** (c / 1200)
                phase = rng.uniform(0, 1)
                out[ch] += 2 * ((fr * t + phase) % 1) - 1
    out = fft_filter(out, lo=120, hi=bright)
    e = np.ones(n)
    a = int(attack * SR)
    e[:a] = (np.linspace(0, 1, a)) ** 2
    r = int(release * SR)
    e[-r:] *= np.linspace(1, 0, r) ** 2
    return out * e * vel * 0.018 / max(1, len(notes) / 3)


def bass(note, dur, vel=1.0):
    f = midi(note)
    n = int((dur + .05) * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * 2 * f * t)
    s = np.tanh(1.8 * s) * env(n, .005, .04) * np.exp(-t / (dur * 2.5))
    return s * vel * 0.30


def kick(vel=1.0):
    n = int(.45 * SR)
    t = np.arange(n) / SR
    freq = 45 + 110 * np.exp(-t / .035)
    s = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / .16)
    s += rng.standard_normal(n) * np.exp(-t / .003) * .25
    return np.tanh(2.2 * s) * vel * 0.55


def clap(vel=1.0):
    n = int(.35 * SR)
    t = np.arange(n) / SR
    noise = fft_filter(rng.standard_normal(n), lo=900, hi=6000)
    e = np.zeros(n)
    for d in (0, .011, .022):
        i = int(d * SR)
        e[i:] += np.exp(-(t[i:] - d) / (.012 if d < .02 else .11))
    return noise * e * vel * 0.22


def hat(vel=1.0, open_=False):
    n = int((.3 if open_ else .07) * SR)
    t = np.arange(n) / SR
    s = fft_filter(rng.standard_normal(n), lo=7500) * np.exp(-t / (.09 if open_ else .018))
    return s * vel * 0.09


def snare(vel=1.0):
    n = int(.25 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / .05)
    noise = fft_filter(rng.standard_normal(n), lo=1500, hi=9000) * np.exp(-t / .09)
    return (body * .5 + noise) * vel * 0.18


def riser(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = t / dur
    noise = rng.standard_normal((2, n))
    lo = fft_filter(noise, lo=300, hi=2500)
    hi = fft_filter(noise, lo=2500, hi=12000)
    s = lo * (1 - x) + hi * x
    sweep = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (2 * x)) / SR) * .25
    return (s + sweep) * (x ** 2.2) * 0.16


def impact():
    n = int(3.2 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / .08)) / SR) * np.exp(-t / .9)
    crash = fft_filter(rng.standard_normal((2, n)), lo=3000) * np.exp(-t / 1.1) * .35
    return np.vstack([boom, boom]) * .7 + crash


def whoosh(dur=.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = t / dur
    s = fft_filter(rng.standard_normal((2, n)), lo=600, hi=5000) * np.sin(np.pi * x) ** 2
    return s * 0.10


# ------------------------------------------------------------------ harmonie (une mesure = 2 s)
C, G, Am, F, Em, Dm = 60, 55, 57, 53, 52, 50
TRIADS = {C: [0, 4, 7], G: [0, 4, 7], F: [0, 4, 7], Am: [0, 3, 7], Em: [0, 3, 7], Dm: [0, 3, 7]}
MAIN = [C, G, Am, F]          # I – V – vi – IV : le ton « uplifting »
BRIDGE = [Am, F, C, G]        # vi – IV – I – V : plus émotionnel

piano_bus, pad_bus, bass_bus, drum_bus, fx_bus, lead_bus = (stereo() for _ in range(6))


def chord_at(bar):
    t = bar * 2.0
    if 7.5 <= bar < 12.5:
        return BRIDGE[int(bar - 7.5) % 4]
    return MAIN[int(bar) % 4]


def arpeggio(t0, root, pattern=(0, 1, 2, 3, 2, 1, 2, 3), octave=12, vel=.8, step=BEAT / 2):
    iv = TRIADS[root]
    notes = [root + octave + iv[0], root + octave + iv[1], root + octave + iv[2], root + octave + 12]
    for k, p in enumerate(pattern):
        place(piano_bus, piano(notes[p], step * 1.5, vel * (1 if k % 4 == 0 else .78)), t0 + k * step, pan=(-.35 if k % 2 else .35))


# Intro (0-3 s) : nappe et cloches sur le logo, souffle d'entrée du téléphone.
place(pad_bus, pad([C - 12 + i for i in TRIADS[C]] + [C + 7, C + 14], 3.0, vel=1.0, attack=1.6, release=1.2, bright=1800), 0.0)
for k, n in enumerate([C + 24, C + 28, C + 31, C + 36]):
    place(fx_bus, bell(n, .9), 0.25 + k * .18, pan=(-.4 + .27 * k))
place(fx_bus, whoosh(.7), 2.25)

# Corps du morceau, mesure par mesure (demi-mesures pour suivre les scènes à 15 et 25 s).
t = 3.0
while t < 42.0:
    bar = t / 2.0
    root = chord_at(bar)
    seg = min(2.0, 42.0 - t)
    section = 'verse' if t < 8 else 'lift' if t < 15 else 'bridge' if t < 25 else 'chorus' if t < 37 else 'build'
    triad = [root - 12 + i for i in TRIADS[root]]
    # Nappe sur chaque accord (plus large au refrain).
    place(pad_bus, pad(triad + [root + 12 + TRIADS[root][1]], seg, vel=1.3 if section in ('chorus', 'build') else .9,
                       attack=.25 if section == 'chorus' else .6, release=.6, bright=4200 if section == 'chorus' else 2400), t)
    # Piano en arpèges (pont : plus doux et aéré).
    if section == 'bridge':
        arpeggio(t, root, pattern=(0, 2, 3, 2), step=BEAT, vel=.7)
    else:
        arpeggio(t, root, vel=.85 if section != 'build' else .7)
    # Basse.
    if section in ('chorus', 'build'):
        for k in range(int(seg / (BEAT / 2))):
            place(bass_bus, bass(root - 24, BEAT / 2 * .9, .9 if k % 2 == 0 else .7), t + k * BEAT / 2)
    elif section == 'bridge':
        place(bass_bus, bass(root - 24, seg * .95, .8), t)
    else:
        for k in range(int(seg / BEAT)):
            place(bass_bus, bass(root - 24, BEAT * .9, .8), t + k * BEAT)
    # Batterie.
    for k in range(int(round(seg / BEAT))):
        tb = t + k * BEAT
        beat_in_bar = int(round((tb - 3.0) / BEAT)) % 4
        if section == 'verse':
            if beat_in_bar in (0, 2):
                place(drum_bus, kick(.75), tb)
        elif section == 'lift':
            if beat_in_bar in (0, 2):
                place(drum_bus, kick(.85), tb)
            if beat_in_bar in (1, 3):
                place(drum_bus, clap(.9), tb, pan=.05)
            for h in (0, .5):
                place(drum_bus, hat(.8), tb + h * BEAT, pan=.3)
        elif section == 'bridge':
            if beat_in_bar == 0:
                place(drum_bus, kick(.6), tb)
            if beat_in_bar == 2:
                place(drum_bus, clap(.5), tb)
        else:  # refrain et montée : 4 temps
            place(drum_bus, kick(1.0), tb)
            if beat_in_bar in (1, 3):
                place(drum_bus, clap(1.0), tb, pan=.05)
            for h in (0, .25, .5, .75):
                place(drum_bus, hat(.9 if h == .5 else .55, open_=(h == .5)), tb + h * BEAT, pan=.3)
    t += seg

# Mélodie lead du refrain (25-37 s) : motif en do, joué en cloche + piano une octave au-dessus.
MOTIF = [(0, 76, 1), (1, 79, 1), (2, 81, 1.5), (3.5, 79, .5), (4, 79, 1), (5, 76, 1), (6, 74, 2),
         (8, 72, 1), (9, 74, 1), (10, 76, 1.5), (11.5, 74, .5), (12, 72, 1), (13, 74, 1), (14, 71, 2)]
for start in (25.0, 25.0 + 16 * BEAT * .5 * 2):
    for beat, note, length in MOTIF:
        tt = start + beat * BEAT
        if tt < 37.0:
            place(lead_bus, piano(note, length * BEAT, 1.0) * 1.25, tt, pan=-.1)
            place(lead_bus, bell(note + 12, .55), tt, pan=.25)

# Transitions : souffles sur les changements de scène, riser + roulement vers l'impact final.
for tt in (7.6, 14.6, 24.6, 36.6):
    place(fx_bus, whoosh(.5), tt)
place(fx_bus, riser(5.0), 37.0)
roll_t = 39.0
while roll_t < 42.0:
    x = (roll_t - 39.0) / 3.0
    place(drum_bus, snare(.35 + .65 * x), roll_t, pan=-.05)
    roll_t += BEAT / (2 if x < .34 else 4 if x < .67 else 8)

# Impact final sur le logo (42 s) : accord de do add9 tenu + crash, extinction jusqu'à 45 s.
place(fx_bus, impact(), 42.0)
place(pad_bus, pad([48, 55, 60, 64, 67, 74], 1.6, vel=1.8, attack=.03, release=1.4, bright=5000), 42.0)
for n in (60, 64, 67, 72, 74):
    place(piano_bus, piano(n, 2.5, 1.0), 42.0, pan=(n - 67) / 20)
for k, n in enumerate([84, 88, 91, 96]):
    place(fx_bus, bell(n, .6), 42.25 + k * .12, pan=(-.3 + .2 * k))

# ------------------------------------------------------------------ mixage et mastering
piano_bus = reverb(piano_bus, 1.8, .22)
pad_bus = reverb(pad_bus, 2.8, .35)
lead_bus = reverb(lead_bus, 2.0, .28)
fx_bus = reverb(fx_bus, 2.5, .30)

# Sidechain léger : la nappe et la basse « respirent » avec la grosse caisse du refrain.
duck = np.ones(N)
for k in range(int((42.0 - 25.0) / BEAT)):
    i = int((25.0 + k * BEAT) * SR)
    n = int(.22 * SR)
    duck[i:i + n] = np.minimum(duck[i:i + n], 1 - .35 * np.exp(-np.arange(n) / SR / .07))
mix = (piano_bus * 1.0 + pad_bus * duck + bass_bus * duck * 1.0 + drum_bus * 1.0 + fx_bus * .9 + lead_bus * .9)
mix = fft_filter(mix, lo=28)  # nettoie l'infra-grave

# Fondu de sortie sur les 2,2 dernières secondes, fondu d'entrée très court.
fade = np.ones(N)
fo = int(2.2 * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
fade[:int(.02 * SR)] = np.linspace(0, 1, int(.02 * SR))
mix *= fade

mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(1.6 * mix) / np.tanh(1.6)  # saturation douce : densité « radio »
mix *= 10 ** (-1.0 / 20)

WAV.parent.mkdir(parents=True, exist_ok=True)
MUSIC_DIR.mkdir(parents=True, exist_ok=True)
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(str(WAV), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

ff = imageio_ffmpeg.get_ffmpeg_exe()
ap = argparse.ArgumentParser()
ap.add_argument('--track', type=Path, help='musique externe sous licence à utiliser à la place de la composition')
args = ap.parse_args()
source, extra = str(WAV), []
if args.track:
    source = str(args.track)
    extra = ['-t', str(DUR)]
    print('musique externe :', args.track)
fades = 'afade=t=in:d=0.02,afade=t=out:st=42.8:d=2.2,' if args.track else ''
# Normalisation de sonie (-14 LUFS, crête vraie -1,5 dBTP : standard des plateformes vidéo) et encodage AAC.
subprocess.run([ff, '-y', '-loglevel', 'error', '-i', source, *extra, '-af', fades + 'loudnorm=I=-14:TP=-1.5:LRA=9',
                '-ar', '48000', '-c:a', 'aac', '-b:a', '256k', str(M4A)], check=True)
# Mixage dans la vidéo : la piste vidéo est copiée sans réencodage ; une ancienne piste audio est remplacée.
tmp = VIDEO.with_name('NeuroCare_Demo_45s.tmp.mp4')
subprocess.run([ff, '-y', '-loglevel', 'error', '-i', str(VIDEO), '-i', str(M4A), '-map', '0:v:0', '-map', '1:a:0',
                '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart',
                '-metadata:s:a:0', 'title=NeuroCare Launch Theme (original)', str(tmp)], check=True)
tmp.replace(VIDEO)
print('musique :', M4A, '· vidéo :', VIDEO, f'({VIDEO.stat().st_size / 1e6:.1f} Mo)')
