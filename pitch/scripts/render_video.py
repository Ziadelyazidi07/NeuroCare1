"""Rend pitch/video/demo.html en vidéo MP4 1920x1080, 60 i/s, 45 s (H.264, yuv420p, faststart).

Chaque image est calculée par renderFrame(t) dans Microsoft Edge headless (Playwright), puis envoyée à
FFmpeg (binaire fourni par imageio-ffmpeg). Le rendu est déterministe : aucune animation CSS ni minuterie.

Usage :
  python pitch/scripts/render_video.py                 # vidéo complète -> pitch/NeuroCare_Demo_45s.mp4
  python pitch/scripts/render_video.py --preview 3 9.8 # images PNG de contrôle -> pitch/build/preview/
  python pitch/scripts/render_video.py --stills        # captures d'écrans du téléphone pour le deck

Prérequis : pip install playwright imageio-ffmpeg ; Microsoft Edge installé (canal « msedge »).
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PITCH = ROOT / 'pitch'
HTML = PITCH / 'video' / 'demo.html'
OUT = PITCH / 'NeuroCare_Demo_45s.mp4'
BUILD = PITCH / 'build'
FPS, DURATION, W, H = 60, 45, 1920, 1080

# Captures pour le deck : nom -> instant de la timeline.
STILLS = {
    'home-fr': 7.5, 'home-ar': 11.0, 'senior': 19.0, 'senior-done': 21.5,
    'cardio-guide': 26.8, 'cardio-alert': 31.0, 'spo2-guide': 33.0, 'alz-result': 36.6, 'pdf-sheet': 38.7,
}


def open_page(p):
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
    glyphs = (PITCH / 'assets' / 'ionicons-glyphs.json').read_text(encoding='utf-8')
    page.add_init_script(f'window.ION = {glyphs};')
    page.goto(HTML.as_uri())
    page.wait_for_load_state('networkidle')
    page.evaluate('document.fonts.ready')
    page.wait_for_function("document.fonts.check('20px Ionicons')")
    page.evaluate('renderFrame(0)')
    return browser, page


def preview(times):
    target = BUILD / 'preview'
    target.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser, page = open_page(p)
        for t in times:
            page.evaluate(f'renderFrame({t})')
            path = target / f'frame_{t:05.2f}.png'
            page.screenshot(path=str(path))
            print(path)
        browser.close()


def stills():
    target = PITCH / 'assets' / 'screens'
    target.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser, page = open_page(p)
        page.set_viewport_size({'width': W, 'height': H})
        for name, t in STILLS.items():
            page.evaluate(f'renderStill({t})')
            page.locator('#phone').screenshot(path=str(target / f'{name}.png'), omit_background=True)
            page.reload()
            page.wait_for_function("document.fonts.check('20px Ionicons')")
            print(target / f'{name}.png')
        # Page du rapport PDF, sans la mise en scène.
        page.evaluate("renderFrame(41.5); document.getElementById('pdf').style.transform = 'none'")
        page.locator('#pdf').screenshot(path=str(target / 'pdf-report.png'))
        browser.close()


def video():
    BUILD.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ffmpeg, '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
           '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-color_range', 'tv', '-colorspace', 'bt709',
           '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-r', str(FPS),
           '-profile:v', 'high', '-level', '4.2', '-movflags', '+faststart', str(OUT)]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = FPS * DURATION
    start = time.time()
    with sync_playwright() as p:
        browser, page = open_page(p)
        for i in range(total):
            page.evaluate(f'renderFrame({i / FPS})')
            enc.stdin.write(page.screenshot(type='jpeg', quality=97))
            if i % 300 == 0:
                print(f'image {i}/{total} — {time.time() - start:.0f} s', flush=True)
        browser.close()
    enc.stdin.close()
    if enc.wait() != 0:
        sys.exit('FFmpeg a échoué')
    print('vidéo :', OUT, f'({OUT.stat().st_size / 1e6:.1f} Mo, {time.time() - start:.0f} s)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', nargs='*', type=float)
    ap.add_argument('--stills', action='store_true')
    args = ap.parse_args()
    if args.preview is not None:
        preview(args.preview or [1, 5, 9, 11, 16, 19.5, 22.8, 26.5, 29, 30.8, 32.8, 36.5, 38.6, 40.5, 44])
    elif args.stills:
        stills()
    else:
        video()
