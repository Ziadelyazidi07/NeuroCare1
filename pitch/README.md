# Pitch NeuroCare — hackathon (5 minutes)

Équipe NeuroCare : 3 élèves-ingénieurs (5ᵉ année Informatique & Gestion, EHEIM Oujda) et
2 étudiantes en 6ᵉ année de Médecine Générale.

| Livrable | Contenu |
|---|---|
| `NeuroCare_Pitch_Hackathon.pptx` | 10 slides 16:9, chronométrées sur 5 min (minutage et script oral complets dans les notes présentateur), apparitions automatiques en fondu, transitions fondu / poussée, vidéo de démo intégrée en slide 5, QR code vers le dépôt |
| `NeuroCare_Demo_45s.mp4` | Démo produit de 45 s (accueil FR ⇄ AR, Assistant Santé vocal en darija puis en français, Diabète FINDRISC + 7 signes, Alzheimer, Tension, Rappels & Suivi en mode démo, PDF), 1920 × 1080, 60 i/s, H.264, avec la musique instrumentale originale « NeuroCare Launch Theme » (AAC 48 kHz stéréo, -14 LUFS) |
| `assets/music/neurocare-launch-theme.m4a` | La musique seule : 120 BPM, do majeur, calée sur les scènes (montée à 8 s, pont émotionnel à 15 s, refrain à 25 s, montée à 37 s, impact final sur le logo à 42 s) |

| Temps | Slide |
|---|---|
| 0:00 – 0:25 | 1. Page de garde : slogan, logo, « 5 bilans + Assistant vocal », signature de l'équipe (hook raconté à l'oral) |
| 0:25 – 0:35 | 2. Plan de la présentation (étapes 01 à 08) |
| 0:35 – 1:10 | 3. Le problème (chiffres sourcés : HCP RGPH 2024, enquête STEPS 2017-2018, OMS) |
| 1:10 – 1:55 | 4. La solution : socle vocal Aidant ↔ Senior + 5 pôles + Assistant Santé vocal trilingue |
| 1:55 – 2:40 | 5. Démonstration (vidéo 45 s) |
| 2:40 – 3:15 | 6. Pourquoi NeuroCare est différent (dont le trilingue FR / AR / darija) |
| 3:15 – 3:50 | 7. Architecture technique (dont `assistant-service`, port 8089) et tests |
| 3:50 – 4:20 | 8. Rigueur clinique et éthique (binôme médecine × ingénierie) |
| 4:20 – 4:45 | 9. Impact social et modèle (B2C freemium, B2B2C) |
| 4:45 – 5:00 | 10. Équipe, phrase de clôture, QR code |

## Régénérer

```bash
pip install python-pptx qrcode imageio-ffmpeg playwright numpy pillow lxml
python pitch/scripts/prepare_assets.py          # logo détouré, icônes Ionicons, QR code -> pitch/assets/
python pitch/scripts/render_video.py --preview  # images de contrôle -> pitch/build/preview/
python pitch/scripts/render_video.py            # vidéo -> pitch/NeuroCare_Demo_45s.mp4 (≈ 3 min)
python pitch/scripts/compose_music.py           # musique originale mixée dans la vidéo (--track fichier.mp3 pour une musique sous licence)
python pitch/scripts/render_video.py --stills   # captures du téléphone pour le deck -> pitch/assets/screens/
python pitch/scripts/build_pptx.py              # deck -> pitch/NeuroCare_Pitch_Hackathon.pptx
```

La vidéo est rendue image par image dans Microsoft Edge (Playwright, canal `msedge`) à partir de
`video/demo.html`, puis encodée par FFmpeg (fourni par `imageio-ffmpeg`). `demo.html` est une reconstitution
HTML fidèle de l'application (textes des dictionnaires `fr.ts` / `ar.ts`, thème Dokterian, icônes Ionicons,
mêmes coordonnées que `DeviceIllustration.tsx`, fiche « oubli-medicament » de la base de connaissances de l'Assistant Santé, données du mode démo) : ce n'est pas un enregistrement d'écran du téléphone.
La musique est synthétisée par `compose_music.py` (numpy, aucun échantillon externe) : elle est originale et
libre de droits pour l'équipe. Un nouveau rendu de la vidéo efface la piste audio : relancer `compose_music.py` ensuite.
Pour utiliser une autre musique, la déposer sous `pitch/neurocare-launch-music.mp3` (ou `.wav`) : `compose_music.py`
la prend automatiquement (coupée à 45 s, fondu de sortie de 41 à 45 s, -14 LUFS).
La patiente « Hajja Zahra », « Ahmed Benali » et « Salma » sont des personnages illustratifs.

## Finale NEXUS HealthTech — pitch strict de 3 minutes

| Livrable | Contenu |
|---|---|
| `NeuroCare_Finale_3min.pptx` / `.pdf` | 8 slides alignées sur les 7 critères du jury, script oral chronométré dans les notes (2 min 50 s + 10 s de marge) |
| `NeuroCare_Demo_Finale_26s.mp4` | Montage muet de 26 s tiré de la démo 45 s, dans l'ordre du pitch : Assistant vocal → rappel « C'est fait » → bilan diabète → PDF |

| Temps | Slide |
|---|---|
| 0:00 – 0:15 | 1. Page de garde (accroche Hajja Zahra) |
| 0:15 – 0:37 | 2. Critère 1 : problème, cible, chiffres sourcés |
| 0:37 – 1:07 | 3. Critères 2 & 3 : valeur, 3 pôles, benchmark |
| 1:07 – 1:42 | 4. Critère 4 : prototype, architecture, tests, vidéo 26 s |
| 1:42 – 2:05 | 5. Critère 5 : sécurité, éthique, Loi 09-08 |
| 2:05 – 2:27 | 6. Critère 6 : coûts, revenus, jalons 6-12 mois |
| 2:27 – 2:40 | 7. Critère 7 : équipe |
| 2:40 – 2:50 | 8. Clôture |

```bash
python pitch/scripts/build_finale_3min.py            # deck + PDF (export par PowerPoint) + montage vidéo si absent
python pitch/scripts/build_finale_3min.py --png DIR  # + une image PNG par slide pour la relecture
```

Le script refuse de générer le deck si un texte parlé dépasse 2,7 mots/s ou si le minutage ne fait pas exactement 2 min 50 s.
