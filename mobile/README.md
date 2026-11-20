# NeuroCare — application mobile (Expo)

Application React Native (Expo SDK 58, Expo Router, TypeScript) connectée au backend NeuroCare
(API REST `/api/v1` et temps réel WebSocket STOMP `/ws`). Elle réunit les deux espaces du cahier des charges :

| Espace | Connexion | Fonctions |
|--------|-----------|-----------|
| **Senior** | code d'appairage à 6 chiffres → token d'appareil | un seul écran : prochain rappel, gros bouton « C'est fait », audio du rappel, appel d'urgence, mini-jeu de mémoire ; fonctionne hors ligne |
| **Aidant** | téléphone + mot de passe (JWT) | tableau de bord en temps réel (pastilles verte / orange / grise), traitements, 4 consentements, enregistrement vocal, rapport PDF, appairage du téléphone du senior |

> NeuroCare aide à suivre des activités et à repérer des changements à discuter avec un professionnel.
> Il ne détecte pas Alzheimer et ne propose aucune dose. « C'est fait » confirme le rappel, pas la prise du médicament.

## Prérequis

- Node.js 20 ou plus récent (testé avec Node 24) et npm.
- Le backend NeuroCare démarré : depuis la racine du dépôt, `cd infra && docker compose up -d --build`
  (voir `docs/demo.md` ; l'API écoute sur le port défini par `BACKEND_PORT` dans `infra/.env`, 8088 par défaut ici).
- Un téléphone avec **Expo Go**, ou un émulateur Android / simulateur iOS.

## Installation

```bash
cd mobile
npm install          # .npmrc active legacy-peer-deps (conflit react-dom limité à la cible web)
```

## Adresse du backend

Par défaut : `http://localhost:8088/api/v1` (le WebSocket est déduit : `ws://localhost:8088/ws`).
`localhost` ne désigne le poste de développement que sur le simulateur iOS. Selon le cas :

| Appareil | Adresse à utiliser |
|----------|--------------------|
| Simulateur iOS | `http://localhost:8088/api/v1` |
| Émulateur Android | `http://10.0.2.2:8088/api/v1` |
| Téléphone réel (même Wi-Fi) | `http://<IP-du-poste>:8088/api/v1`, ex. `http://192.168.1.20:8088/api/v1` |

Deux façons de la changer :

1. **Dans l'application** : écran d'accueil → « Serveur : … (modifier) » (mémorisé sur le téléphone).
2. **Au lancement** : `EXPO_PUBLIC_API_URL=http://192.168.1.20:8088/api/v1 npx expo start`
   (sous PowerShell : `$env:EXPO_PUBLIC_API_URL="http://192.168.1.20:8088/api/v1"; npx expo start`).

Pour un téléphone réel, pensez aussi à `STORAGE_PUBLIC_ENDPOINT=http://<IP-du-poste>:9000` dans `infra/.env`,
sinon les URL des fichiers audio pointent vers `localhost` (voir `docs/demo.md`).

## Lancer

```bash
npx expo start            # puis scanner le QR code avec Expo Go, ou :
npx expo start --android  # émulateur Android
npx expo start --ios      # simulateur iOS (macOS)
```

### Ce qui marche dans Expo Go, et ce qui demande un build de développement

| Fonction | Expo Go | Build de développement (`npx expo run:android`, `eas build --profile development`) |
|----------|---------|------|
| API REST, temps réel STOMP, PDF, enregistrement vocal, audio | oui | oui |
| Rappels **locaux** à T-10 min et alarme à l'heure exacte (hors ligne, écran verrouillé) | non (désactivés) | oui |
| Push **FCM** envoyés par le serveur | non | oui, avec `google-services.json` |

Dans Expo Go, le rappel audio ne se déclenche donc que si l'application est ouverte : tester les
notifications et le scénario hors ligne sur un build de développement.
Après toute modification de `app.json` ou de la sonnerie, il faut reconstruire l'application : `npx expo run:android`
(Android Studio et son SDK requis). Android conserve les réglages d'un canal existant : changer son identifiant
dans `src/senior/reminders.ts` si le son ou la vibration évoluent.
Sans FCM, les rappels locaux du build restent actifs : c'est le filet de sécurité prévu par le cahier (§4.1).
Les builds Android autorisent le HTTP en clair pour joindre le backend local (`usesCleartextTraffic`). L'APK de test se construit avec
`eas build -p android --profile preview`.
Une fois cet APK installé, les changements JavaScript et assets se publient sans le reconstruire :
`eas update --channel preview --message "…"`. Toute modification native (plugin, permission, module) ou du
champ `version` de `app.json` impose un nouvel APK (`runtimeVersion` suit la version de l'application). Avant une vraie mise en production : retirer cette option et utiliser HTTPS (cahier §15.4).

Si `expo start` affiche une erreur d'installation de React Native DevTools (`dotslash error: Access is denied`),
ajouter `EXPO_UNSTABLE_HEADLESS=1` à `.env.local` puis relancer. L'application DevTools n'est alors plus
installée ; ce mode coupe aussi la vérification des versions de dépendances au démarrage et l'annonce Bonjour.

## Scénario de démonstration

Avec la stack en profil `demo` (comptes fictifs, voir `docs/demo.md`) :

1. **Aidant** : grille d'accueil → « Rappels & Suivi » → « Je suis aidant » → `06 00 00 00 01` / `NeuroCare-Demo-2026` (Salma B.).
2. Ouvrir « Hajj Ahmed » → tableau de bord « En direct ».
3. « Appairer son téléphone » → générer un code.
4. **Senior** (second téléphone ou après déconnexion) : « Rappels & Suivi » → « Je suis senior » → saisir le code.
5. À l'heure du rappel : audio + gros bouton « C'est fait » → la pastille passe au **vert** chez l'aidant.
6. Sans réponse : pastille **orange** et alerte (1 min en profil démo).
7. Senior : « Jeu de mémoire ». Aidant : « Rapport PDF » → partage du PDF.

Pour déconnecter le téléphone du senior : bouton « Se déconnecter / Changer de profil » en bas de l'écran senior
(confirmation demandée). Les rappels programmés et les voix téléchargées sont alors effacés.

## Fonctionnement détaillé

**Langue et thème**
- En haut de l'accueil, deux pilules « FR | Français » et « AR | العربية ». Le choix est mémorisé
  (`@neurocare/language`) et s'applique tout de suite à toute l'application : grille, Module 1 (senior et
  aidant), modules 2 à 6, alertes, notifications programmées ensuite et PDF.
- Arabe : texte aligné à droite (`writingDirection: 'rtl'`) et rangées inversées (`row-reverse`) par le hook
  `useLanguage()`, sans `I18nManager.forceRTL` (donc sans redémarrage). Les PDF arabes sont en `dir="rtl"`.
- Textes : dictionnaires `src/i18n/fr.ts` et `src/i18n/ar.ts` (une section par module dans `fr/` et `ar/`) ;
  TypeScript refuse un dictionnaire arabe incomplet. La logique clinique ne renvoie que des codes.
- Limites : les messages d'erreur détaillés du serveur, l'avertissement du tableau de bord et le rapport
  hebdomadaire PDF du Module 1 (générés par le backend) restent en français.
- Logo officiel `assets/images/neurocare-logo.png` : en haut de la carte de bienvenue, en-tête des PDF
  (data URI `src/modules/pdfLogo.ts`), icône et écran de démarrage (`app.json` ; un changement d'icône demande
  un nouveau build EAS). L'icône adaptative Android utilise `assets/images/neurocare-adaptive-icon.png` : le logo
  réduit à 56 % (22 % de marge par côté, fond `#F5F8FC`) pour tenir en entier dans la zone sûre centrale de 66 %.
- Thème médical « clean » (`src/theme/`) : fond `#F5F8FC`, cartes blanches arrondies (20) avec ombre légère,
  bleu `#246BFD`, titres `#112950`, badges pastel par module ; composants `Card`, `PrimaryButton`, `Badge`,
  `ModuleHeader`, `Text` orienté. Texte courant ≥ 16, titres et boutons 20-24. L'espace senior garde son
  thème « contraste élevé » noir / jaune quand l'aidant l'a choisi.

**Grille des modules** (`src/app/index.tsx`)
- Au démarrage, une grille de 6 tuiles : « Rappels & Suivi », « Saturation SpO₂ », « Santé Mentale »,
  « Diabète (FINDRISC) », « Tension (HTA) » et « Alzheimer & Mémoire », avec l'adresse du serveur et un rappel éthique (pré-dépistage
  et aide à la décision, jamais de diagnostic).
- « Rappels & Suivi » (Module 1) ouvre le choix Senior / Aidant (`src/app/observance-role.tsx`) ; un téléphone
  déjà appairé ou un aidant connecté va directement dans son espace.
- Modules 2 à 6 : accès direct depuis la grille, sans appairage, sans connexion et sans réseau. La relation
  aidant / senior (code à 6 chiffres, compte aidant, consentements) ne concerne que « Rappels & Suivi ».
  Historiques stockés sur le téléphone (AsyncStorage, clés `neurocare.spo2.*`, `neurocare.gds.*`,
  `neurocare.findrisc.*`, `neurocare.bp.*`, `neurocare.memory.*`, 500 éléments au plus par historique, 20 protocoles HTA).
  Un champ facultatif « Nom et prénom du patient », mémorisé et commun aux 5 modules, personnalise les PDF
  (« Patient » s'il est vide). Désinstaller l'application efface ces données.
- PDF : chaque fichier est renommé avant le partage (`renamePdf`, `moveAsync`) en
  `NeuroCare_<Module>_<Patient>_<YYYY-MM-DD>_<HHhMM>.pdf` (`src/lib/pdfFileName.ts` : `Saturation-SpO2`,
  `Sante-Mentale-GDS`, `Diabete-FINDRISC`, `Tension-HTA`, `Alzheimer-4A`, `Rappels-Suivi` ; caractères
  interdits retirés, espaces → tirets). Ex. : `NeuroCare_Tension-HTA_Ahmed-Benali_2026-11-20_11h30.pdf`.
- Bandeau d'aide à la mesure en haut de chaque module 2 à 6 (`src/modules/MeasurementGuideCard.tsx`,
  textes `guide` de chaque dictionnaire) : illustration de l'appareil (`DeviceIllustration.tsx` : tensiomètre,
  oxymètre, balance + mètre ruban + lecteur de glycémie), chiffres à recopier avec code couleur, pharmacie,
  conditions de mesure ou conseils de passation (GDS, Alzheimer).
- **Saturation SpO₂** (`src/modules/saturation/`) : question du profil respiratoire (maladie respiratoire
  chronique : Oui / Non, modifiable), saisie au repos de la SpO₂ et du pouls, alerte immédiate même hors ligne.
  Standard : 95-100 % vert, 90-94 % orange (repos, vérifier le capteur, recontrôler dans 10 min), < 90 % rouge
  avec boutons d'appel 15 / 141. BPCO : 88-92 % vert, < 85 % rouge, orange ailleurs. Historique 90 jours et
  « Télécharger le relevé SpO2 PDF » (`expo-print` + partage).
- **Santé mentale** (`src/modules/mental/`) : Mini-GDS (4 questions, 7 derniers jours). À 0, arrêt : « absence
  probable de dépression ». Dès 1 point, les 12 autres items de la GDS-15 (vie vide, heureux et situation
  désespérée sont communs aux deux échelles). Restitution 0-4 / 5-9 / 10-15, orientation médicale et
  « Télécharger le rapport GDS PDF » (questions, réponses, scores).
- **Diabète (FINDRISC)** (`src/modules/metabolic/`) : les 8 questions officielles, IMC calculé depuis le poids et
  la taille (en cm ou en m), score sur 26 et restitution (< 7 faible 1 % ; 7-11 légèrement accru 4 % ; 12-14 modéré
  17 % ; 15-20 élevé 33 % ; > 20 très élevé 50 %, risque à 10 ans) avec l'orientation médicale. Résultat immédiat
  même hors ligne, historique et « Télécharger le bilan FINDRISC PDF ».
- **Tension (HTA)** (`src/modules/cardio/`) : alerte à chaque mesure, même hors ligne. ≥ 180/110 : alerte rouge,
  check-list de symptômes et boutons 15 / 141. 135-179 / 85-109 : vigilance (protocole 3 jours, moins de sel).
  < 135/85 : vert (note sur la tolérance après 80 ans). TAS < 100 : risque de malaise et de chute. Protocole
  d'automesure guidé : 3 jours × matin et soir × M1-M3 = 18 mesures, minuteur de repos de 1 ou 2 min, moyenne
  (alerte « à montrer au médecin » si ≥ 135/85) et « Télécharger le relevé d'automesure HTA PDF ». Ressaisir un
  créneau remplace la mesure.
- **Alzheimer & Mémoire** (`src/modules/alzheimer/`) : section A, 8 questions d'observation Oui / Non sur les
  dernières semaines, 2 par domaine des « 4 A » (amnésie, aphasie, apraxie, agnosie). Section B, jeu de mémoire
  sans chronomètre : 4 mots illustrés (Clé, Citron, Horloge, Olivier), distraction (jour de la semaine, petit
  calcul), rappel libre écrit (accents, majuscules et pluriels indifférents), puis reconnaissance parmi 12 images.
  Le jeu peut être passé. « Indice de vigilance cognitive » à deux issues seulement, sans score chiffré : rassurant,
  ou signes à signaler (≥ 2 signes sur les 4 A ou les 2 d'un domaine, ≤ 1 mot retrouvé spontanément, un mot ni
  retrouvé ni reconnu, ≥ 2 intrus, jour faux) avec orientation vers le médecin traitant, un neurologue ou une
  consultation mémoire. Conseils personnalisés par domaine et prévention (marche 30 min, sommeil 7 h, lien
  social, assiette MIND). « Télécharger le bilan Mémoire & 4 A PDF » : domaines, rappel, conseils, historique.
  Questionnaire et jeu non validés comme test : outil de pré-dépistage et d'aide à la consultation.
- Chaque écran, réponse d'API et PDF de ces modules rappelle qu'ils ne constituent pas un diagnostic médical
  officiel et ne remplacent pas un médecin.
- Le bouton « ← Accueil Modules » (choix Senior / Aidant, espaces senior et aidant, modules) revient à la grille.
- Un téléphone senior ouvert par une alarme, ou touché par une alarme depuis un autre module, va droit à
  l'écran de rappel, qui joue la voix comme avant.

**Espace senior** (`src/app/senior/`)
- Police ≥ 24 sp (taille du profil), contraste élevé (noir / blanc / jaune, ≥ 7:1), bouton « C'est fait » de 128 dp,
  libellés d'accessibilité sur chaque bouton (ENF-08).
- « C'est fait » : retour haptique + audio « C'est noté », confirmation envoyée avec un en-tête `Idempotency-Key`
  unique. Sans réseau, la confirmation est mise en file (stockage local) et envoyée par `POST /me/doses/sync`
  au retour de la connexion (CA-10).
- Les prises des 48 h sont mises en cache et programmées en **notifications locales** (canal Android
  « Rappels médicaments ») ; l'audio de chaque traitement est téléchargé à l'avance
  (`GET /me/medications/{id}/audio`).
- Son des rappels : uniquement la voix de l'aidant (message cloné si disponible, sinon son enregistrement joué
  tel quel). Le senior n'a aucun réglage ; sans voix enregistrée, son téléphone joue une simple tonalité.
- Application ouverte : à l'heure exacte de la prise, alerte à l'écran et lecture automatique de la voix. L'écran
  se met à jour seul par STOMP quand l'aidant modifie un traitement ou sa voix.
- Application fermée ou écran verrouillé : rappel « Rappel bientôt » à T-10 min, puis alarme à l'heure exacte avec
  priorité maximale, forte vibration et sonnerie intégrée à l'APK (`assets/audio/alarme_rappel.wav`). La voix de
  l'aidant part à l'ouverture : `expo-notifications` n'accepte pas un fichier téléchargé comme son de notification.
- Si une autorisation manque, l'écran senior propose « Activer les alertes sur ce téléphone » (demande système,
  ou réglages Android après un refus définitif).
- Bouton d'appel d'urgence (`tel:`) vers le contact saisi par l'aidant. Mini-jeu : 3 mots, pause, choix parmi 9,
  arrêt possible à tout moment ; seul le nombre de mots retrouvés est affiché, sans aucune interprétation.

**Espace aidant** (`src/app/aidant/`)
- Connexion ou création de compte (`POST /auth/register`), mot de passe affichable (icône œil) et option
  « Enregistrer mes identifiants », conservés dans le trousseau sécurisé du téléphone.
- Jetons stockés dans le trousseau sécurisé (`expo-secure-store`), renouvelés automatiquement (rotation du refresh token).
- Tableau de bord : abonnement STOMP à `/topic/seniors/{id}/events` (jeton présenté à la trame CONNECT),
  mise à jour immédiate des pastilles, historique 7 jours, alertes « sans réponse » et « téléphone injoignable ».
- Consentements : chaque changement demande de confirmer la présence et l'accord du senior.
- Voix : enregistrement d'environ 12 s (M4A), réécoute, envoi, remplacement et suppression.
- Rapport : choix de la semaine, observations pour le médecin, téléchargement authentifié, renommage
  `NeuroCare_Rappels-Suivi_<Senior>_<date>_<HHhMM>.pdf` puis partage du PDF.

## Structure

```
src/
  app/          écrans (Expo Router) : index (grille), observance-role, modules/*, senior/*, aidant/*
  modules/      un dossier par module (observance, saturation, mental, metabolic, cardio, alzheimer), sans import croisé
  api/          client HTTP (JWT / token d'appareil, erreurs RFC 7807), types, appels
  auth/         session sécurisée et contexte React
  senior/       file hors ligne, rappels locaux, audio du rappel
  realtime/     abonnement STOMP
  lib/          logique pure testée (pastilles, file hors ligne, dates, validation, URL)
  i18n/         langue (contexte, hook useLanguage), dictionnaires fr / ar
  theme/        thème médical, composants Card, PrimaryButton, Badge, ModuleHeader, Text orienté
  ui/           bouton « Accueil Modules »
assets/audio/   tonalité du rappel et sonnerie d'alarme embarquées
```

## Vérifications

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test            # tests Jest de src/lib
npx expo-doctor     # compatibilité des dépendances avec le SDK
```

## Limites connues

- Les mots darija du jeu sont affichés en écriture arabe et en transcription latine ; liste à faire relire.
- Pas encore de tests de composants ni de tests de bout en bout (Maestro / Detox) : la logique métier
  est testée côté backend (CA-01 à CA-10) et dans `src/lib`.
