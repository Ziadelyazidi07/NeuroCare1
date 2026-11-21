"""Bande son de la démo « voix de la fille » (pitch/NeuroCare_Demo_45s.mp4) : voix de synthèse + musique douce.

- Voix : edge-tts. Salma (la fille) : fr-FR-DeniseNeural, débit posé ; Assistant Santé en darija : ar-MA-MounaNeural.
  Dans l'application, le rappel est lu avec la VRAIE voix enregistrée par le proche : ici, une voix de synthèse
  joue ce rôle (Salma et Hajja Zahra sont des personnages illustratifs).
- Musique : nappe originale synthétisée (numpy, aucun échantillon externe), do majeur, 66 BPM, atténuée sous les voix.
- Sortie : pitch/build/voix/mix.wav (48 kHz stéréo, ≈ -16 LUFS intégrés), puis multiplexage dans la vidéo.

Usage :
  python pitch/scripts/compose_voix_audio.py --tts     # (ré)génère les voix et affiche leurs durées
  python pitch/scripts/compose_voix_audio.py           # mixage + multiplexage dans pitch/NeuroCare_Demo_45s.mp4
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
OUT_DIR = PITCH / 'build' / 'voix'
VIDEO = PITCH / 'NeuroCare_Demo_45s.mp4'
SR, DURATION = 48000, 45.0
FF = imageio_ffmpeg.get_ffmpeg_exe()

# Répliques : nom -> (voix, débit, hauteur, texte, instant de départ dans la vidéo en secondes).
# Les instants sont repris tels quels par la timeline de pitch/video/demo_voix.html (VOICE_LINES).
LINES = {
    'salma_rappel': ('fr-FR-DeniseNeural', '+4%', '+2Hz',
                     "Mama h'biba, c'est l'heure de ton médicament du soir, ton comprimé de Metformine. "
                     "Prends-le maintenant, avec un grand verre d'eau. Je pense fort à toi.", 1.6),
    'salma_rappel_bis': (None, None, None, 'salma_rappel', 14.2),  # réécoute dans l'espace senior : même enregistrement
    'salma_bravo': ('fr-FR-DeniseNeural', '+0%', '+3Hz',
                    "Bravo Mama ! Je suis fière de toi. Je t'aime.", 29.6),
    'assistant_dj': ('ar-MA-MounaNeural', '+0%', '+0Hz',
                     'ما تخافيش، ما تاخديش جوج دوايات فمرة.', 36.9),
}


def tts():
    import edge_tts

    async def run():
        for name, (voice, rate, pitch, text, _) in LINES.items():
            if voice is None:
                continue
            mp3 = OUT_DIR / f'{name}.mp3'
            await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(str(mp3))
            raw = OUT_DIR / f'{name}_raw.wav'
            subprocess.run([FF, '-y', '-loglevel', 'error', '-i', str(mp3), '-ar', str(SR), '-ac', '1', str(raw)], check=True)
            x = trim_silence(read_wav(raw))  # les fichiers edge-tts ont des silences en tête et en queue
            with wave.open(str(OUT_DIR / f'{name}.wav'), 'wb') as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes())

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    asyncio.run(run())
    durations = {}
    for name, (voice, *_rest) in LINES.items():
        src = name if voice else LINES[name][3]
        durations[name] = round(len(read_wav(OUT_DIR / f'{src}.wav')) / SR, 2)
    (OUT_DIR / 'durations.json').write_text(json.dumps(durations, indent=2), encoding='utf-8')
    for name, d in durations.items():
        start = LINES[name][4]
        print(f'{name:18s} {start:5.1f} s -> {start + d:5.2f} s  ({d:.2f} s)')


def read_wav(path):
    with wave.open(str(path)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return x


def trim_silence(x, thr=0.004):
    idx = np.where(np.abs(x) > thr)[0]
    return x[max(0, idx[0] - 240): idx[-1] + 2400] if len(idx) else x


# ---------------------------------------------------------------- musique originale (nappe douce)
def adsr(n, a, r):
    env = np.ones(n, dtype=np.float32)
    na, nr = min(int(a * SR), n // 2), min(int(r * SR), n // 2)  # notes courtes en fin de morceau
    env[:na] = np.linspace(0, 1, na)
    env[-nr:] *= np.linspace(1, 0, nr)
    return env


def piano(freq, dur, vel=0.5):
    """Note de piano électrique douce : quelques partiels qui décroissent."""
    t = np.arange(int(dur * SR)) / SR
    tone = sum(a * np.sin(2 * np.pi * freq * k * t) * np.exp(-t * (1.6 + k * 1.1)) for k, a in ((1, 1.0), (2, .32), (3, .12), (4, .05)))
    return (vel * tone * adsr(len(t), .006, .25)).astype(np.float32)


def pad(freqs, dur):
    t = np.arange(int(dur * SR)) / SR
    x = sum(np.sin(2 * np.pi * f * t + .3 * np.sin(2 * np.pi * .21 * t)) + .35 * np.sin(2 * np.pi * f * 2.003 * t) for f in freqs)
    return (x / len(freqs) * adsr(len(t), 1.2, 1.4)).astype(np.float32)


NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}


def hz(name, octave):
    return NOTE[name] * 2 ** (octave - 4)


def music():
    beat = 60 / 66
    bar = 4 * beat
    # Progression tendre : C – Am – F – G (puis Fmaj7 – G – C pour l'arrivée sur le logo).
    chords = [('C', 'E', 'G'), ('A', 'C', 'E'), ('F', 'A', 'C'), ('G', 'B', 'D')] * 3 + [('F', 'A', 'C'), ('G', 'B', 'D'), ('C', 'E', 'G')]
    n = int(DURATION * SR)
    out = np.zeros((n, 2), dtype=np.float32)
    rng = np.random.default_rng(7)
    for i, ch in enumerate(chords):
        start = i * bar
        if start >= DURATION:
            break
        dur = min(bar + 1.2, DURATION - start)
        root = hz(ch[0], 2 if ch[0] in 'ABG' else 3)
        p = pad([root, hz(ch[1], 3), hz(ch[2], 3)], dur) * .16
        s = int(start * SR)
        out[s:s + len(p), 0] += p
        out[s:s + len(p), 1] += p * .92
        # Arpège de piano, une note par temps (et demi-temps sur la fin), légèrement humanisé.
        arp = [hz(ch[0], 4), hz(ch[1], 4), hz(ch[2], 4), hz(ch[1], 5 if ch[1] in 'CDE' else 4)]
        for k in range(4):
            tk = start + k * beat + rng.uniform(-.008, .008)
            if tk >= DURATION - .3:
                continue
            note = piano(arp[k], min(2.4, DURATION - tk), vel=.18 + .04 * (k == 0))
            j = int(tk * SR)
            pan = .5 + .25 * np.sin(k)
            out[j:j + len(note), 0] += note * (1 - pan) * 1.6
            out[j:j + len(note), 1] += note * pan * 1.6
    # Petite réverbération (échos décroissants).
    for delay, g in ((.083, .25), (.191, .18), (.317, .12), (.487, .08)):
        d = int(delay * SR)
        out[d:, 0] += out[:-d, 1] * g
        out[d:, 1] += out[:-d, 0] * g
    fade = int(2.0 * SR)
    out[:int(.8 * SR)] *= np.linspace(0, 1, int(.8 * SR))[:, None]
    out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return out


def mix():
    durations = json.loads((OUT_DIR / 'durations.json').read_text(encoding='utf-8'))
    n = int(DURATION * SR)
    voice = np.zeros(n, dtype=np.float32)
    for name, (v, _r, _p, text, start) in LINES.items():
        x = read_wav(OUT_DIR / f'{(name if v else text)}.wav')
        x = x / (np.max(np.abs(x)) + 1e-9) * .82
        s = int(start * SR)
        voice[s:s + len(x)] += x[:n - s]
        assert abs(durations[name] - len(x) / SR) < .05
    m = music()
    # Atténuation de la musique sous les voix (sidechain lissé).
    k = int(.35 * SR)  # moyenne glissante par somme cumulée (np.convolve direct serait quadratique)
    c = np.concatenate([[0], np.cumsum((np.abs(voice) > .01).astype(np.float64))])
    idx = np.clip(np.arange(n) + k // 2, 0, n), np.clip(np.arange(n) - k // 2, 0, n)
    env = ((c[idx[0]] - c[idx[1]]) / k).astype(np.float32)
    duck = 1 - .62 * np.clip(env * 4, 0, 1)
    m *= duck[:, None]
    stereo = m * .55 + voice[:, None] * np.array([.98, .98])
    stereo /= max(1.0, np.max(np.abs(stereo)) / .89)
    pcm = (stereo * 32767).astype(np.int16)
    path = OUT_DIR / 'mix.wav'
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    # Normalisation intégrée (loudnorm, 2 passes en une : cible -16 LUFS, crête -1,5 dBTP) et multiplexage.
    tmp = VIDEO.with_name('demo_voix_tmp.mp4')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', str(VIDEO), '-i', str(path), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
                    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', str(tmp)], check=True)
    tmp.replace(VIDEO)
    print('vidéo + bande son :', VIDEO)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--tts', action='store_true')
    args = ap.parse_args()
    if args.tts:
        tts()
    else:
        mix()
