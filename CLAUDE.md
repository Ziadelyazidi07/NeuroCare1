# Projet NeuroCare — Règles de Développement

## Référence
- Cahier des charges à jour (état final, 6 modules, i18n, thème, stack) : `CAHIER_DES_CHARGES.md` (+ `.pdf`) à la racine.
- Cahier initial du Module 1 (SQL, endpoints, exigences EF-/ENF-) : `docs/cahier-des-charges.pdf`.
- Fonctionnement détaillé de l'application mobile : `mobile/README.md`. Démo : `docs/demo.md`.

## Stack Technique
- `backend/` : Spring Boot 3.5, Java 21, Maven, PostgreSQL 16, Flyway (V1 à V10), Spring Security (JWT aidant + DeviceToken senior), WebSocket STOMP, ShedLock, Resilience4j, MapStruct, OpenPDF, MinIO, springdoc. API REST `/api/v1`.
- `audio-service/` : Python 3.11, FastAPI (interne, clé `X-Internal-Key`).
- `mobile/` : Expo SDK 58, React Native 0.88, React 19, TypeScript, Expo Router, AsyncStorage, expo-secure-store, expo-audio, expo-notifications, expo-print + expo-sharing (PDF), @stomp/stompjs, EAS Build / EAS Update (canal `preview`).
- `infra/` : docker-compose.yml (PostgreSQL 16, MinIO, backend, audio-service), secrets dans `infra/.env` (non versionné).

## Les 6 modules (grille d'accueil `mobile/src/app/index.tsx`)
| # | Module | Dossier mobile | Données |
|---|---|---|---|
| 1 | Rappels & Suivi (senior ↔ aidant : voix du proche, « C'est fait », appairage 6 chiffres, tableau de bord temps réel, consentements, jeu de mots) | `modules/observance/` + `app/senior/*`, `app/aidant/*` | backend |
| 2 | Saturation SpO₂ (profil standard 95-100 / BPCO 88-92, alertes orange / rouge + appel 15 / 141) | `modules/saturation/` | téléphone |
| 3 | Santé mentale (Mini-GDS 4 q. → arrêt à 0, sinon GDS-15 : 16 questions au total, score /15) | `modules/mental/` | téléphone |
| 4 | Diabète FINDRISC (8 critères /26, IMC auto, risque à 10 ans) + partie 2 hors score : 7 signes d'hyperglycémie → encart d'alerte (prioritaire si ≥ 2 ou triade) | `modules/metabolic/` | téléphone |
| 5 | Tension HTA (urgence ≥ 180/110 + check-list, vigilance 135-179/85-109, normal < 135/85, hypotension TAS < 100, protocole 3 j × 18 mesures, moyenne) | `modules/cardio/` | téléphone |
| 6 | Alzheimer & Mémoire (4 A à la 2ᵉ personne, jeu des 4 mots FR/AR/darija, indice de vigilance à 2 issues, restitution personnalisée HAS / OMS / Lancet) | `modules/alzheimer/` | téléphone |

Chaque module 2 à 6 : `<x>.ts` (règles pures, codes seulement), `<x>Store.ts` (AsyncStorage via `modules/storage.ts`), `<x>Pdf.ts` (HTML → PDF, prend `t`), `<X>Screen.tsx` (encapsulé dans `ModuleScreen` : bouton Accueil, `ModuleHeader`, nom du patient, mention de non-diagnostic), `module.ts` (icône, `colour`, `tint`, route). Les endpoints backend des modules 2-5 existent encore mais l'app ne les appelle plus.

## Conventions Strictes
1. Packages backend : `ma.neurocare.<module>` (config, common, security, auth, user, consent, medication, reminder, voice, cognitive, notification, dashboard, report, audit, saturation, mental, metabolic, cardio).
2. Couches par module : `api/`, `domain/`, `application/`, `infrastructure/`.
3. DTO : Exclusivement des `record` Java. Jamais d'entité JPA dans les controllers.
4. Erreurs : Format RFC 7807 (`ProblemDetail`).
5. Éthique : jamais de diagnostic. Le Module 1 (observance) et les exercices cognitifs restent sans aucun score
   médical (ni score Alzheimer, ni risque, ni probabilité). « Sans réponse » n'est jamais présenté comme un oubli.
   Aucune dose calculée (consigne recopiée de l'ordonnance).
   Exception autorisée : les échelles cliniques standardisées des modules de pré-dépistage (Mini-GDS / GDS-15,
   FINDRISC, seuils SpO2, automesure HTA) peuvent calculer leur score et leurs seuils officiels, comme outils de
   pré-dépistage, de suivi d'indicateurs et d'orientation médicale. Conditions :
   - barème officiel testé (mobile et backend appliquent les mêmes seuils ; un score reçu par le serveur est
     toujours recalculé, jamais repris de l'application) ;
   - formulations « indicateurs compatibles avec… » et orientation vers un professionnel, jamais « vous avez… » ;
   - chaque écran, réponse d'API et PDF porte la mention explicite que le résultat ne constitue pas un diagnostic
     médical officiel et ne remplace pas un médecin (vérifié par `EthicsTest` et les tests mobile, en FR et AR).
   Le module « Alzheimer & Mémoire » (observation des 4 A, jeu des 4 mots) n'est pas une échelle validée : il ne
   calcule ni score Alzheimer, ni risque, ni probabilité, seulement un « indice de vigilance cognitive » à deux
   issues (rassurant / signes à signaler au médecin), avec orientation et mention de pré-dépistage.
6. Mobile : un dossier par module dans `mobile/src/modules/`, sans import d'un module à l'autre (vérifié par les tests).
   Aucun texte affiché en dur : tout passe par les dictionnaires `mobile/src/i18n/fr.ts` et `ar.ts` (une section par
   domaine dans `i18n/fr/*.ts` et `i18n/ar/*.ts`, typée `typeof fr` : même forme, vérifiée par TypeScript et les tests)
   et le hook `useLanguage()` (`t`, `isRTL`, `row`, `text`, `start`). Hors composants : `currentLanguage()` /
   `dictionaryFor()`. La logique clinique renvoie des codes (erreurs, raisons, niveaux), jamais du texte.
   Le sens droite-à-gauche se gère par styles (`row-reverse`, `textAlign`, `writingDirection`), jamais par
   `I18nManager.forceRTL`. Langue mémorisée sous `@neurocare/language`. PDF : `pdfDocument({ t, … })` met
   `<html lang dir>` (rtl en arabe). Dans les dictionnaires FR, annoter `: string` les fonctions qui renvoient des
   littéraux par ternaire (sinon l'arabe ne compile pas). Notifications FR : garder les apostrophes droites.
   Styles et composants : `mobile/src/theme/` uniquement (`Text` orienté, `Row`, `Card`, `PrimaryButton`/`Button`,
   `Badge`, `ModuleHeader`, `Field`, `Notice`…) — thème « Dokterian » : fond `#F5F8FC`, cartes blanches rayon 20,
   bordure `#E6EEF8`, ombre `#0F3D6E` 0,06, primaire `#246BFD`, titres `#112950`, texte ≥ 16, titres/boutons 20-24.
   Pastels des tuiles : observance `#246BFD/#EBF2FF`, SpO2 `#0EA5E9/#E0F2FE`, mental `#7C3AED/#F3E8FF`,
   diabète `#F59E0B/#FEF3C7`, HTA `#EF4444/#FEE2E2`, Alzheimer `#10B981/#D1FAE5`.
   L'espace senior garde ENF-08 (police ≥ 24, boutons ≥ 64 dp, contraste ≥ 7:1, thème « contraste élevé » noir/jaune
   si l'aidant l'a choisi).
7. Seul le Module 1 (« Rappels & Suivi ») dépend de la relation aidant / senior (appairage, compte, consentements).
   Les modules 2 à 6 s'ouvrent sans compte ni réseau et stockent leurs données sur le téléphone ; ils n'importent
   jamais `auth/`, `api/`, `senior/` ni `realtime/` (vérifié par les tests). Nom du patient facultatif commun
   (`PatientName.tsx`, défaut « Patient » / « المريض »).

## Règles de Travail
- Code étape par étape, jamais tout d'un coup.
- Après chaque étape backend, lance `backend/mvnw compile` ou `test` et corrige les erreurs avant de continuer.
- Mobile, avant tout commit : `npx tsc --noEmit`, `npm run lint` (expo lint), `npx jest` (183 tests au dernier passage),
  et `npx expo export --platform android --output-dir <tmp>` pour valider le bundle.
- Lint : `react-hooks/set-state-in-effect` → charger les données avec `useFocusEffect(useCallback(…))` ;
  `react-hooks/refs` interdit d'écrire un ref pendant le rendu.
- Tests d'écran : RNTL 14 (API asynchrone : `await render`, `await fireEvent…`), mocks dans les fabriques `jest.mock`
  via `require`. AsyncStorage est chargé à la demande dans `LanguageContext` pour que la logique pure se teste sans mock.
- Git : travailler sur une branche `feat/…`, puis `git fetch -q . feat/x:main && git switch main` (fast-forward).
  Fais un commit à chaque étape validée. Ne jamais committer les modifications locales de `mobile/package.json`
  (scripts `android`/`ios` → `expo run:*` de l'utilisateur) : ne stager que ses propres lignes.
- Ajout d'un module natif → nouveau build EAS ; sinon `eas update --channel preview` suffit.
- Mode démo hors ligne du Module 1 (`src/demo/`) : toute nouvelle route `/api/v1` utilisée par l'app doit aussi
  être servie par `demo/demoBackend.ts` (sinon 404 en démo).

## Environnement local (Windows)
- `mvn` n'est pas dans le PATH : utiliser `backend/mvnw` (Maven Wrapper).
- JDK 21 non installé : utiliser le JDK 25 (`C:\Program Files\Eclipse Adoptium\jdk-25.0.2.10-hotspot`) — le pom compile avec `--release 21`.
- tzdata du JDK 25 local (2025b) en retard sur l'image Docker (2026e) et PostgreSQL (2026f) : les règles
  d'`Africa/Casablanca` diffèrent (UTC+1 contre UTC+0 en nov. 2026). Les tests unitaires utilisent un fuseau
  aux règles fixes ; ne pas y coder en dur le décalage de Casablanca. La référence est l'image Docker.
- Stack complète : `cd infra && docker compose up -d --build` (ports hôtes dans `infra/.env` : API sur **8088** ;
  le port 8080 du poste est pris par le conteneur `api-gateway` d'un autre projet). Téléphone réel :
  `EXPO_PUBLIC_API_URL=http://<IPv4 Wi-Fi>:8088/api/v1` ; réseau Wi-Fi en profil « Public » → ouvrir le port 8088
  dans le pare-feu (PowerShell administrateur, voir `docs/demo.md`).
- Git Bash : les heredocs contenant des apostrophes ou de l'arabe échouent souvent → écrire les fichiers avec l'outil
  d'écriture ou des scripts Python placés dans le scratchpad.
- GitHub CLI installé dans `C:\Program Files\GitHub CLI\gh.exe` (hors PATH de Git Bash). Aucun remote configuré :
  publication prévue en dépôt **public** `neurocare` (`gh repo create neurocare --public --source . --remote origin --push`)
  dès que l'utilisateur aura fait `gh auth login`.
- PDF depuis Markdown : HTML (lib `markdown`) puis Edge headless `--print-to-pdf`.
