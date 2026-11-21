"""Bande son de pitch/NeuroCare_Notification_Vocale_30s.mp4 : voix de Salma, sons d'interface, ambiance très douce.

- Voix : edge-tts, fr-FR-VivienneMultilingualNeural, débit -6 %. edge-tts n'accepte pas de SSML personnalisé
  (les balises <break> seraient lues ou ignorées) : chaque réplique est donc générée phrase par phrase, puis
  assemblée avec de vraies pauses respiratoires (350 ms par défaut) et de courts fondus pour éviter les clics.
- Sons : carillon de notification (deux notes de cloche douces), clic tactile (transitoire bref et filtré),
  confirmation discrète sur le téléphone de l'aidante — tous synthétisés (numpy), aucun échantillon externe.
- Ambiance : nappe en do majeur très basse (≈ -24 dB sous la voix), atténuée davantage pendant les répliques.
- Sortie : pitch/build/notif30/mix.wav puis multiplexage AAC 48 kHz (loudnorm -16 LUFS, crête -1,5 dBTP).

Usage :
  python pitch/scripts/compose_notif30_audio.py --tts   # voix -> build/notif30/*.wav + timeline.json (instants pour la scène)
  python pitch/scripts/compose_notif30_audio.py         # mixage + multiplexage dans la vidéo
"""
import argparse
import asyncio
import json
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
PITCH = ROOT / 'pitch'
OUT_DIR = PITCH / 'build' / 'notif30'
VIDEO = PITCH / 'NeuroCare_Notification_Vocale_30s.mp4'
SR, DURATION = 48000, 30.0
FF = imageio_ffmpeg.get_ffmpeg_exe()
VOICE = 'fr-FR-VivienneMultilingualNeural'
RATE = '-6%'

# Répliques de Salma : (nom, instant de départ, [(phrase, hauteur, pause après en s), …]).
LINES = [
    ('rappel', 1.0, [("Coucou Mama h'biba…", '+2Hz', .35),
                     ("Il est vingt heures, c'est l'heure de ton comprimé du soir.", '+0Hz', .35),
                     ("Prends-le tranquillement, avec un grand verre d'eau.", '+0Hz', .3),
                     ("Je t'embrasse fort.", '+2Hz', 0)]),
    ('bravo', 14.35, [("Bravo Mama, c'est bien noté !", '+3Hz', .3),
                      ('Passe une belle soirée.', '+1Hz', 0)]),
]
# Sons d'interface (instants repris par la scène pitch/video/demo_notif30.html).
SFX = {'chime': .4, 'tap': 13.75, 'confirm': 22.0}


def read_wav(path):
    with wave.open(str(path)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768


def write_wav(path, x, channels=1):
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(channels); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def trim(x, thr=.006):
    idx = np.where(np.abs(x) > thr)[0]
    x = x[max(0, idx[0] - 480): idx[-1] + 960] if len(idx) else x
    f = min(len(x) // 4, int(.012 * SR))
    x = x.copy(); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    return x


def tts():
    import edge_tts

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    async def one(text, pitch, path):
        await edge_tts.Communicate(text, VOICE, rate=RATE, pitch=pitch).save(str(path))

    timeline = {'sfx': SFX, 'lines': {}}
    for name, start, phrases in LINES:
        parts = []
        for i, (text, pitch, pause) in enumerate(phrases):
            mp3 = OUT_DIR / f'{name}_{i}.mp3'
            asyncio.run(one(text, pitch, mp3))
            raw = OUT_DIR / f'{name}_{i}.wav'
            subprocess.run([FF, '-y', '-loglevel', 'error', '-i', str(mp3), '-ar', str(SR), '-ac', '1', str(raw)], check=True)
            parts.append(trim(read_wav(raw)))
            parts.append(np.zeros(int(pause * SR), dtype=np.float32))
        x = np.concatenate(parts)
        write_wav(OUT_DIR / f'{name}.wav', x)
        timeline['lines'][name] = [start, round(start + len(x) / SR, 2)]
        print(f'{name:7s} {start:5.2f} s -> {start + len(x) / SR:5.2f} s')
    (OUT_DIR / 'timeline.json').write_text(json.dumps(timeline, indent=2), encoding='utf-8')


# ---------------------------------------------------------------- sons synthétisés
def bell(freq, dur, amp):
    t = np.arange(int(dur * SR)) / SR
    x = sum(a * np.sin(2 * np.pi * freq * k * t) * np.exp(-t * d) for k, a, d in ((1, 1, 4.5), (2.0, .25, 7), (2.76, .12, 9), (5.4, .04, 14)))
    att = int(.004 * SR); x[:att] *= np.linspace(0, 1, att)
    return (amp * x).astype(np.float32)


def chime():
    a = bell(1318.5, 1.2, .22)             # mi 6
    b = bell(1760.0, 1.4, .2)              # la 6
    out = np.zeros(int(1.6 * SR), dtype=np.float32)
    out[:len(a)] += a
    d = int(.13 * SR); out[d:d + len(b)] += b
    return out


def tap():
    """Clic tactile : transitoire très bref (bruit filtré + petit « tock » à 1,9 kHz)."""
    n = int(.045 * SR); t = np.arange(n) / SR
    rng = np.random.default_rng(3)
    noise = np.convolve(rng.standard_normal(n), np.ones(6) / 6, mode='same') * np.exp(-t * 260)
    tock = np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 180) + .5 * np.sin(2 * np.pi * 950 * t) * np.exp(-t * 120)
    return (.16 * noise + .2 * tock).astype(np.float32)


def confirm():
    """Confirmation côté aidante : deux notes montantes, plus discrètes que le carillon."""
    out = np.zeros(int(1.2 * SR), dtype=np.float32)
    a, b = bell(1046.5, .9, .12), bell(1568.0, 1.0, .12)
    out[:len(a)] += a
    d = int(.1 * SR); out[d:d + len(b)] += b
    return out


def ambience():
    """Nappe chaleureuse très douce : do – la m – fa – sol, sinus lents avec léger vibrato, pas de rythme."""
    n = int(DURATION * SR); t = np.arange(n) / SR
    out = np.zeros((n, 2), dtype=np.float32)
    chords = [(130.81, 164.81, 196.0), (110.0, 130.81, 164.81), (87.31, 110.0, 130.81), (98.0, 123.47, 146.83)]
    seg = DURATION / 4
    for i, ch in enumerate(chords * 1):
        a, b = int(i * seg * SR), int(min(DURATION, (i + 1) * seg + 1.5) * SR)
        tt = t[a:b] - t[a]
        env = np.minimum(1, tt / 1.5) * np.minimum(1, (tt[-1] - tt) / 1.5 + 1e-3)
        x = sum(np.sin(2 * np.pi * f * tt + .2 * np.sin(2 * np.pi * .17 * tt)) + .3 * np.sin(2 * np.pi * 2.002 * f * tt) for f in ch) / 3
        out[a:b, 0] += x * env * .9
        out[a:b, 1] += np.roll(x, 240) * env * .9
    return out


def mix():
    tl = json.loads((OUT_DIR / 'timeline.json').read_text(encoding='utf-8'))
    n = int(DURATION * SR)
    voice = np.zeros(n, dtype=np.float32)
    for name, start, _ in LINES:
        x = read_wav(OUT_DIR / f'{name}.wav')
        x = x / (np.max(np.abs(x)) + 1e-9) * .8
        s = int(start * SR)
        voice[s:s + len(x)] += x[:n - s]
    sfx = np.zeros(n, dtype=np.float32)
    for name, fn in (('chime', chime), ('tap', tap), ('confirm', confirm)):
        x = fn(); s = int(tl['sfx'][name] * SR)
        sfx[s:s + len(x)] += x[:n - s]
    amb = ambience() * .05
    # Atténuation supplémentaire de l'ambiance pendant la voix (moyenne glissante par somme cumulée).
    k = int(.3 * SR)
    c = np.concatenate([[0], np.cumsum((np.abs(voice) > .01).astype(np.float64))])
    i = np.arange(n)
    env = ((c[np.clip(i + k // 2, 0, n)] - c[np.clip(i - k // 2, 0, n)]) / k).astype(np.float32)
    amb *= (1 - .55 * np.clip(env * 4, 0, 1))[:, None]
    fade = int(1.2 * SR)
    amb[:int(.6 * SR)] *= np.linspace(0, 1, int(.6 * SR))[:, None]
    amb[-fade:] *= np.linspace(1, 0, fade)[:, None]
    stereo = amb + (voice + sfx)[:, None]
    peak = np.max(np.abs(stereo))
    stereo *= .89 / peak
    write_wav(OUT_DIR / 'mix.wav', stereo.reshape(-1), channels=2)
    tmp = VIDEO.with_name('notif30_tmp.mp4')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', str(VIDEO), '-i', str(OUT_DIR / 'mix.wav'), '-map', '0:v:0', '-map', '1:a:0',
                    '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k',
                    '-t', str(DURATION), '-movflags', '+faststart', str(tmp)], check=True)
    tmp.replace(VIDEO)
    print('vidéo + bande son :', VIDEO)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--tts', action='store_true')
    args = ap.parse_args()
    tts() if args.tts else mix()
