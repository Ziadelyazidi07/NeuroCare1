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
| Rappels **locaux** programmés (hors ligne) | non (désactivés) | oui |
| Push **FCM** envoyés par le serveur | non | oui, avec `google-services.json` |

Dans Expo Go, le rappel audio ne se déclenche donc que si l'application est ouverte : tester les
notifications et le scénario hors ligne sur un build de développement.
Sans FCM, les rappels locaux du build restent actifs : c'est le filet de sécurité prévu par le cahier (§4.1).
En build Android de production, le HTTP en clair est bloqué : utiliser HTTPS (Nginx + TLS, cahier §15.4).

Si `expo start` affiche une erreur d'installation de React Native DevTools (`dotslash error: Access is denied`),
ajouter `EXPO_UNSTABLE_HEADLESS=1` à `.env.local` puis relancer. L'application DevTools n'est alors plus
installée ; ce mode coupe aussi la vérification des versions de dépendances au démarrage et l'annonce Bonjour.

## Scénario de démonstration

Avec la stack en profil `demo` (comptes fictifs, voir `docs/demo.md`) :

1. **Aidant** : « Je suis aidant » → `06 00 00 00 01` / `NeuroCare-Demo-2026` (Salma B.).
2. Ouvrir « Hajj Ahmed » → tableau de bord « En direct ».
3. « Appairer son téléphone » → générer un code.
4. **Senior** (second téléphone ou après déconnexion) : « Je suis senior » → saisir le code.
5. À l'heure du rappel : audio + gros bouton « C'est fait » → la pastille passe au **vert** chez l'aidant.
6. Sans réponse : pastille **orange** et alerte (1 min en profil démo).
7. Senior : « Jeu de mémoire ». Aidant : « Rapport PDF » → partage du PDF.

Pour désappairer le téléphone du senior : appui long (3 s) sur « Bonjour … » en haut de l'écran senior.

## Fonctionnement détaillé

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
- Application fermée ou en arrière-plan : notification locale avec le son du système, puis lecture de la voix à
  l'ouverture. Android n'accepte comme son de notification qu'un fichier intégré au build, pas un fichier téléchargé.
- Bouton d'appel d'urgence (`tel:`) vers le contact saisi par l'aidant. Mini-jeu : 3 mots, pause, choix parmi 9,
  arrêt possible à tout moment ; seul le nombre de mots retrouvés est affiché, sans aucune interprétation.

**Espace aidant** (`src/app/aidant/`)
- Jetons stockés dans le trousseau sécurisé (`expo-secure-store`), renouvelés automatiquement (rotation du refresh token).
- Tableau de bord : abonnement STOMP à `/topic/seniors/{id}/events` (jeton présenté à la trame CONNECT),
  mise à jour immédiate des pastilles, historique 7 jours, alertes « sans réponse » et « téléphone injoignable ».
- Consentements : chaque changement demande de confirmer la présence et l'accord du senior.
- Voix : enregistrement d'environ 12 s (M4A), réécoute, envoi, remplacement et suppression.
- Rapport : choix de la semaine, observations pour le médecin, téléchargement authentifié puis partage du PDF.

## Structure

```
src/
  app/          écrans (Expo Router) : index, senior/*, aidant/*, aidant/[seniorId]/*
  api/          client HTTP (JWT / token d'appareil, erreurs RFC 7807), types, appels
  auth/         session sécurisée et contexte React
  senior/       file hors ligne, rappels locaux, audio du rappel
  realtime/     abonnement STOMP
  lib/          logique pure testée (pastilles, file hors ligne, dates, validation, URL)
  ui/           thème accessible et composants
assets/audio/   tonalité du rappel et confirmations embarquées
```

## Vérifications

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test            # tests Jest de src/lib
npx expo-doctor     # compatibilité des dépendances avec le SDK
```

## Limites connues

- Les confirmations `merci-*.mp3` de `assets/audio/` sont des voix de synthèse (espeak-ng) : à remplacer par des
  enregistrements de locuteurs, notamment en darija (cahier §10.5, EF-VO-05).
- Les mots darija du jeu sont affichés en écriture arabe et en transcription latine ; liste à faire relire.
- Pas encore de tests de composants ni de tests de bout en bout (Maestro / Detox) : la logique métier
  est testée côté backend (CA-01 à CA-10) et dans `src/lib`.
