# Pitch NeuroCare — hackathon (5 minutes)

Équipe « Khaliha 3la allah » : 3 élèves-ingénieurs (5ᵉ année Informatique & Gestion, EHEIM Oujda) et
2 étudiantes en 6ᵉ année de Médecine Générale.

| Livrable | Contenu |
|---|---|
| `NeuroCare_Pitch_Hackathon.pptx` | 9 slides 16:9, chronométrées sur 5 min (minutage et script oral complets dans les notes présentateur), apparitions automatiques en fondu, transitions fondu / poussée, vidéo de démo intégrée en slide 4, QR code vers le dépôt |
| `NeuroCare_Demo_45s.mp4` | Démo produit de 45 s, 1920 × 1080, 60 i/s, H.264 (sans son : commentée en direct) |

| Temps | Slide |
|---|---|
| 0:00 – 0:30 | 1. Hook émotionnel, logo, slogan, signature de l'équipe |
| 0:30 – 1:10 | 2. Le problème (chiffres sourcés : HCP RGPH 2024, enquête STEPS 2017-2018, OMS) |
| 1:10 – 1:55 | 3. La solution : socle vocal Aidant ↔ Senior + 5 pôles hors ligne |
| 1:55 – 2:40 | 4. Démonstration (vidéo 45 s) |
| 2:40 – 3:15 | 5. Pourquoi NeuroCare est différent |
| 3:15 – 3:50 | 6. Architecture technique et tests |
| 3:50 – 4:20 | 7. Rigueur clinique et éthique (binôme médecine × ingénierie) |
| 4:20 – 4:45 | 8. Impact social et modèle (B2C freemium, B2B2C) |
| 4:45 – 5:00 | 9. Équipe, phrase de clôture, QR code |

## Régénérer

```bash
pip install python-pptx qrcode imageio-ffmpeg playwright numpy pillow lxml
python pitch/scripts/prepare_assets.py          # logo détouré, icônes Ionicons, QR code -> pitch/assets/
python pitch/scripts/render_video.py --preview  # images de contrôle -> pitch/build/preview/
python pitch/scripts/render_video.py            # vidéo -> pitch/NeuroCare_Demo_45s.mp4 (≈ 3 min)
python pitch/scripts/render_video.py --stills   # captures du téléphone pour le deck -> pitch/assets/screens/
python pitch/scripts/build_pptx.py              # deck -> pitch/NeuroCare_Pitch_Hackathon.pptx
```

La vidéo est rendue image par image dans Microsoft Edge (Playwright, canal `msedge`) à partir de
`video/demo.html`, puis encodée par FFmpeg (fourni par `imageio-ffmpeg`). `demo.html` est une reconstitution
HTML fidèle de l'application (textes des dictionnaires `fr.ts` / `ar.ts`, thème Dokterian, icônes Ionicons,
mêmes coordonnées que `DeviceIllustration.tsx`) : ce n'est pas un enregistrement d'écran du téléphone.
La patiente « Hajja Zahra », « Ahmed Benali » et « Salma » sont des personnages illustratifs.
