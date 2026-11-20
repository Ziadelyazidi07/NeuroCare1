# Cahier des charges — NeuroCare

**Application mobile d'observance thérapeutique, de pré-dépistage et d'aide à la décision médicale**

| | |
|---|---|
| Version du document | 1.0 — état final du projet |
| Date | 20 novembre 2026 |
| Dépôt | `neurocare` (monorepo : `mobile/`, `backend/`, `audio-service/`, `infra/`, `docs/`) |
| Langues de l'application | Français, Arabe (bascule instantanée, droite-à-gauche complet) |

---

## Sommaire

1. Présentation générale
2. Objectifs
3. Positionnement éthique et juridique
4. Utilisateurs cibles
5. Architecture fonctionnelle : 6 modules indépendants
6. Module 1 — Rappels & Suivi
7. Module 2 — Saturation en oxygène (SpO₂)
8. Module 3 — Santé mentale (Mini-GDS / GDS-15)
9. Module 4 — Pré-dépistage du diabète (FINDRISC)
10. Module 5 — Cardio-vasculaire (HTA)
11. Module 6 — Alzheimer & Mémoire
12. Exigences transverses (interface, langues, PDF, hors ligne, accessibilité)
13. Architecture technique et stack
14. Données, sécurité et confidentialité
15. Qualité, tests et livraison
16. Limites connues et évolutions

---

## 1. Présentation générale

NeuroCare est une application mobile destinée aux seniors, à leurs proches aidants et aux professionnels
qui les accompagnent. Elle réunit dans une seule application, sous forme de **lanceur de modules**, deux
familles de services :

- un **socle d'observance** (Module 1) : rappels de prise de médicaments avec la voix enregistrée d'un proche,
  confirmation « C'est fait » par le senior et suivi en temps réel par l'aidant ;
- cinq **modules de pré-dépistage et de suivi d'indicateurs** (Modules 2 à 6) : saturation en oxygène,
  humeur, risque de diabète, tension artérielle, mémoire et fonctions cognitives.

Chaque module produit, quand c'est pertinent, un **rapport PDF nominatif** destiné à être montré ou envoyé
au médecin.

## 2. Objectifs

| Objectif | Traduction dans le produit |
|---|---|
| Améliorer l'observance thérapeutique | Rappels vocaux personnalisés, alarme même téléphone verrouillé, confirmation en un geste |
| Rassurer et impliquer l'entourage | Tableau de bord aidant en temps réel, alertes « sans réponse », rapport hebdomadaire |
| Repérer tôt des signes à surveiller | Échelles et seuils standardisés (SpO₂, GDS, FINDRISC, HTA, observation des 4 A) |
| Orienter vers le bon professionnel | Messages d'orientation gradués, appel direct des urgences (15 / 141) en cas d'alerte rouge |
| Faciliter la consultation | Rapports PDF nominatifs, historiques locaux, protocole d'automesure guidé |
| Être utilisable par tous | Interface bilingue français / arabe, grandes cibles tactiles, fonctionnement hors ligne |

## 3. Positionnement éthique et juridique

NeuroCare est un **outil d'observance, de pré-dépistage, de suivi d'indicateurs et d'aide à la décision
médicale**. Il **ne pose jamais de diagnostic** et **ne remplace jamais un médecin**.

Règles appliquées dans tout le produit :

1. **Aucun diagnostic.** Le Module 1 et le mini-jeu de mémoire n'affichent aucun score médical (ni score
   Alzheimer, ni risque, ni probabilité). Le statut « Sans réponse » n'est jamais présenté comme un oubli.
2. **Échelles standardisées uniquement pour le pré-dépistage.** Les modules 2 à 5 appliquent des barèmes et
   seuils officiels (Mini-GDS / GDS-15, FINDRISC, seuils SpO₂, automesure tensionnelle), testés
   automatiquement. Le backend recalcule toujours un score reçu.
3. **Formulations prudentes.** « Indicateurs compatibles avec… », « signes à signaler », orientation vers un
   professionnel ; jamais « vous avez… ».
4. **Module 6 sans score anxiogène.** Le questionnaire des 4 A et le jeu des 4 mots ne sont pas une échelle
   validée : ils ne produisent qu'un « indice de vigilance cognitive » à deux issues (rassurant / signes à
   signaler au médecin).
5. **Mention obligatoire.** Chaque écran de module, chaque réponse d'API concernée et chaque PDF porte la
   mention : *« Outil de pré-dépistage, de suivi et d'orientation : ce document ne constitue pas un diagnostic
   médical officiel et ne remplace pas un médecin. »* (vérifiée par des tests automatisés, dans les deux langues).
6. **Aucune dose calculée.** Les traitements sont recopiés d'une prescription existante (texte libre) ;
   l'application ne propose ni ne calcule de posologie.
7. **Consentements granulaires** (Module 1) : rappels, exercices, partage familial et voix sont accordés ou
   retirés séparément, en présence du senior, avec journal horodaté.
8. **Données de santé.** Les modules 2 à 6 conservent les données uniquement sur le téléphone ; le Module 1
   chiffre les échanges (HTTPS en production) et journalise les accès aux données de santé.

## 4. Utilisateurs cibles

| Profil | Besoins | Espace |
|---|---|---|
| Senior | Rappels simples, gros boutons, voix familière, aucun compte à gérer | Espace senior (Module 1), modules 2 à 6 |
| Aidant (proche) | Configurer les traitements, enregistrer sa voix, suivre les prises, recevoir les alertes | Espace aidant (Module 1) |
| Patient autonome / soignant de proximité | Mesurer, évaluer, obtenir un rapport pour le médecin | Modules 2 à 6 (sans compte) |
| Médecin | Lire un relevé clair et daté | Rapports PDF |

## 5. Architecture fonctionnelle : 6 modules indépendants

L'écran d'accueil est une **grille de 6 grandes cartes** (lanceur d'applications), précédée d'une carte de
bienvenue (logo NeuroCare, sous-titre, sélecteur de langue) et suivie d'un rappel éthique et de l'adresse du
serveur (modifiable).

| # | Module | Icône / accent | Compte requis | Stockage |
|---|---|---|---|---|
| 1 | Rappels & Suivi | bleu `#246BFD` | Oui (appairage senior, compte aidant) | Serveur + cache local |
| 2 | Saturation SpO₂ | cyan `#0EA5E9` | Non | Téléphone |
| 3 | Santé Mentale | violet `#7C3AED` | Non | Téléphone |
| 4 | Diabète (FINDRISC) | ambre `#F59E0B` | Non | Téléphone |
| 5 | Tension (HTA) | corail `#EF4444` | Non | Téléphone |
| 6 | Alzheimer & Mémoire | émeraude `#10B981` | Non | Téléphone |

Principes d'architecture :

- **Indépendance stricte** : un dossier par module (`mobile/src/modules/<module>/`), aucun import d'un module
  à l'autre ; seule la relation aidant / senior du Module 1 dépend de l'authentification. Ces deux règles sont
  vérifiées par des tests.
- **Accès direct** : les modules 2 à 6 s'ouvrent sans connexion, sans appairage et sans réseau.
- **Navigation** : bouton « Accueil Modules » sur tous les écrans (retour à la grille sans empiler les écrans).
- **Nom du patient** : champ facultatif « Nom et prénom du patient », mémorisé et commun aux modules 2 à 6 ;
  vide, les PDF portent « Patient » (« المريض » en arabe). Il ne bloque jamais l'utilisation.

## 6. Module 1 — Rappels & Suivi (socle observance Senior ↔ Aidant)

### 6.1 Parcours

1. L'aidant crée son compte (téléphone + mot de passe, identifiants mémorisables dans le stockage sécurisé).
2. Il crée le profil du senior (nom, surnom utilisé dans les messages, lien, année de naissance facultative,
   langue des rappels darija / français / arabe, contact d'urgence).
3. Il recueille les **4 consentements** avec le senior : partage familial, rappels, exercices, voix.
4. Il **appaire** le téléphone du senior : code à 6 chiffres, valable 10 minutes, usage unique ; révocation
   possible en cas de perte ou de vol.
5. Il saisit les **traitements** (nom, consigne recopiée de l'ordonnance, dates, plusieurs horaires et jours).
6. Il **enregistre sa voix** (~12 s, 10 à 30 s acceptées), la réécoute, l'envoie, la remplace ou la supprime.

### 6.2 Espace senior

- Écran unique, police ≥ 24 sp, boutons ≥ 64 dp, contraste ≥ 7:1 (thème médical ou « contraste élevé » noir /
  jaune selon le réglage de l'aidant).
- À l'heure de la prise : alerte plein écran « C'est l'heure ! », lecture automatique de la **voix du proche**
  (téléchargée à l'avance, donc disponible hors ligne), tonalité simple si aucune voix n'est enregistrée.
- Notifications : pré-rappel à T-10 min, puis alarme à l'heure exacte (canal alarme Android, contourne le mode
  Ne pas déranger, fonctionne téléphone verrouillé ; bouton « Écouter le message »).
- **Confirmation silencieuse « C'est fait »** : la voix s'arrête, vibration et message de confirmation ; hors
  ligne, la confirmation est mise en file et envoyée au retour du réseau.
- Bouton d'appel du proche, accès au **mini-jeu de mémoire**, déconnexion protégée (appui long + confirmation).

### 6.3 Mini-jeu de mémoire (bienveillant)

Mémorisation de mots, courte pause, puis reconnaissance parmi des propositions. Facultatif, interruptible à
tout moment sans pénalité ; seul un retour bienveillant est affiché (« Vous avez retrouvé n mot(s) »), sans
score ni interprétation. Le résultat brut est transmis à l'aidant (si le consentement « exercices » est accordé).

### 6.4 Espace aidant

- **Tableau de bord du jour en temps réel** (WebSocket STOMP) : pastilles vert (confirmé) / orange (sans
  réponse) / gris (en attente, désactivé), heure de confirmation, bandeaux d'alerte (« pas de réponse au
  rappel… », voix prête, téléphone du senior injoignable), indicateur « En direct ».
- Historique sur 7 jours (barres empilées, taux de confirmation parmi les rappels clôturés), dernier exercice.
- Gestion des traitements (ajout, modification, arrêt avec conservation de l'historique).
- Consentements avec confirmation explicite et journal.
- **Rapport hebdomadaire PDF** pour le médecin (choix de la semaine, observations libres jusqu'à 1 000
  caractères), généré par le serveur.

## 7. Module 2 — Saturation en oxygène (SpO₂)

- **Profil respiratoire** (question initiale, modifiable) : « Le patient souffre-t-il d'une maladie
  respiratoire chronique connue (ex : BPCO, insuffisance respiratoire) ? ».
- **Saisie au repos** : SpO₂ (50-100 %) et pouls (30-220 bpm), consignes de mesure (repos 5 min, main chaude,
  sans vernis).
- **Alertes immédiates, hors ligne** :

| Profil | Vert | Orange (recontrôle) | Rouge (urgence) |
|---|---|---|---|
| Standard | 95-100 % | 90-94 % | < 90 % |
| BPCO / insuffisance respiratoire | 88-92 % | hors cible, ≥ 85 % | < 85 % |

  Orange : repos, vérification du capteur, nouvelle mesure dans 10 minutes, puis médecin si la valeur persiste.
  Rouge : message d'urgence et **boutons d'appel direct 15 / 141**.
- **Historique local** (les 500 dernières mesures, la plus récente en premier) avec badge de niveau.
- **PDF** « Télécharger le relevé SpO2 PDF » : profil, tableau des mesures, alertes et orientation.

## 8. Module 3 — Santé mentale (Mini-GDS puis GDS-15)

- Évaluation de l'état émotionnel **des 7 derniers jours**, réponses Oui / Non, question par question, retour
  arrière possible.
- **Étape 1 — Mini-GDS (4 questions)** : si le score vaut 0, arrêt : « Absence probable de dépression ».
- **Étape 2 — GDS-15** : dès 1 point, les items de la GDS-15 non encore posés (12 questions, trois items étant
  communs aux deux échelles), avec les **5 items inversés** comptés sur « Non ».
- **Restitution** : 0-4 indice normal ; 5-9 indicateurs compatibles avec une dépression légère à modérée ;
  10-15 indicateurs compatibles avec une dépression sévère (consultation rapide, appel 15 / 141 en cas d'idées
  noires).
- Historique local des passations et **rapport PDF** (toutes les questions et réponses, points, scores,
  orientation, barème).

## 9. Module 4 — Pré-dépistage du diabète de type 2 (FINDRISC)

- Questionnaire officiel en **8 critères, score sur 26** :

| Critère | Points |
|---|---|
| Âge | < 45 : 0 · 45-54 : 2 · 55-64 : 3 · > 64 : 4 |
| IMC (calculé automatiquement depuis poids et taille, en cm ou en m) | < 25 : 0 · 25-30 : 1 · > 30 : 3 |
| Tour de taille — homme / femme | < 94 / < 80 : 0 · 94-102 / 80-88 : 3 · > 102 / > 88 : 4 |
| Activité physique ≥ 30 min / jour | Non : 2 |
| Fruits ou légumes tous les jours | Non : 1 |
| Traitement antihypertenseur | Oui : 2 |
| Glycémie élevée déjà constatée | Oui : 5 |
| Diabète dans la famille | 2ᵉ degré : 3 · 1ᵉʳ degré : 5 |

- **Risque estimé à 10 ans** : < 7 faible (1 %) ; 7-11 légèrement accru (4 %) ; 12-14 modéré (17 %) ;
  15-20 élevé (33 %) ; > 20 très élevé (50 %), avec conseils et orientation (glycémie à jeun, médecin traitant,
  endocrinologue).
- Résultat immédiat hors ligne, historique local et **bilan PDF** nominatif (8 réponses, poids, taille, IMC,
  points, total, orientation, barème).

## 10. Module 5 — Cardio-vasculaire (hypertension artérielle)

### 10.1 Alerte immédiate à chaque mesure (hors ligne)

| Niveau | Seuil | Conduite proposée |
|---|---|---|
| Urgence hypertensive | ≥ 180 / 110 | Check-list de symptômes (maux de tête violents, douleur thoracique, essoufflement, trouble de la parole ou de la vision) ; symptôme présent → appel immédiat ; **boutons 15 / 141** |
| Vigilance | 135-179 / 85-109 | Valeurs compatibles avec une HTA modérée : suivre le protocole 3 jours, limiter le sel |
| Normal | < 135 / 85 | Note : après 80 ans, une systolique jusqu'à 140-145 peut être tolérée selon l'avis du médecin |
| Hypotension | TAS < 100 | Risque de malaise et de chute : s'allonger, boire, se relever lentement |

### 10.2 Protocole guidé d'automesure

- **3 jours consécutifs × matin et soir × 3 mesures (M1, M2, M3) = 18 mesures**, consignes de position.
- Grille 3 jours colorée par niveau, saisie guidée du créneau suivant, re-saisie possible d'un créneau.
- **Minuteur de repos facultatif** (1 ou 2 minutes, vibration en fin de minuterie).
- **Moyenne** provisoire puis finale ; moyenne ≥ 135 / 85 : « relevé à montrer au médecin ».
- Mesures ponctuelles et historique local ; **PDF** « relevé d'automesure HTA » (tableau complet, moyenne,
  orientation, alertes).

## 11. Module 6 — Alzheimer & Mémoire (pré-dépistage des 4 A et prévention cognitive)

- **Section A — Observation des 4 A** (dernières semaines, Oui / Non, 2 questions par domaine, remplissable par
  la personne ou un proche) : **Amnésie** (mémoire récente), **Aphasie** (langage), **Apraxie** (gestes et
  autonomie), **Agnosie** (reconnaissance et repères).
- **Section B — Jeu de mémoire bienveillant** (sans chronomètre, peut être passé) : mémorisation de 4 mots
  illustrés (Clé, Citron, Horloge, Olivier) ; distraction (jour de la semaine, petit calcul) ; **rappel libre
  écrit** tolérant (accents, majuscules, pluriels, article arabe, formes arabes et darija comme « ساروت ») ;
  **reconnaissance visuelle** parmi 12 images.
- **Indice de vigilance cognitive** à deux issues, sans score : *rassurant*, ou *signes à signaler* (≥ 2 signes
  sur les 4 A ou les 2 signes d'un domaine, ≤ 1 mot retrouvé spontanément, un mot ni retrouvé ni reconnu,
  ≥ 2 intrus choisis, jour de la semaine erroné). Les raisons sont listées.
- **Orientation** : message encourageant si rassurant ; sinon recommandation bienveillante de consulter le
  médecin traitant, un neurologue ou une consultation mémoire pour un bilan neuropsychologique.
- **Conseils de prévention personnalisés** : un conseil pratique par domaine touché, puis marche 30 min/jour,
  sommeil ~7 h, lien social, alimentation de type **MIND** (huile d'olive, poisson, noix, fruits et légumes),
  stimulation intellectuelle, contrôle tension / glycémie / audition / vue.
- Historique local et **rapport PDF** « Bilan Mémoire & 4 A » (domaines, rappel, conseils, historique,
  mention « outil de pré-dépistage et d'aide à la consultation »).

## 12. Exigences transverses

### 12.1 Thème visuel « médical clean » (inspiration Dokterian)

- Fond gris-bleuté `#F5F8FC`, cartes blanches très arrondies (rayon 20), bordures `#E6EEF8`, ombres légères
  (`#0F3D6E`, opacité 0,06).
- Bleu d'action `#246BFD`, titres bleu profond `#112950`, badges d'icônes pastel par module.
- Composants partagés : `Card`, `PrimaryButton`, `Badge`, `ModuleHeader`, `Text` orienté selon la langue.
- Lisibilité : texte courant ≥ 16 px, titres et boutons 20-24 px, cibles tactiles ≥ 48 dp (≥ 64 dp côté senior).

### 12.2 Interface bilingue instantanée français / arabe

- Sélecteur **« FR | Français » / « AR | العربية »** en haut de l'accueil ; choix mémorisé
  (`@neurocare/language`) et appliqué **immédiatement à toute l'application**, sans redémarrage.
- **RTL complet** par styles dynamiques (hook `useLanguage()` : `writingDirection: 'rtl'`, `row-reverse`,
  alignement à droite, flèches inversées), sans `I18nManager.forceRTL`.
- Dictionnaires `fr.ts` et `ar.ts` de **forme identique** (contrôlée par TypeScript et par les tests) ; arabe
  clair et bienveillant, adapté aux seniors. La logique clinique ne manipule que des codes.
- Notifications programmées dans la langue choisie.

### 12.3 Rapports PDF nominatifs

- Générés sur le téléphone avec **expo-print** (HTML → PDF) puis partagés avec **expo-sharing**.
- Édition en français ou en arabe (`<html lang="ar" dir="rtl">`), en-tête avec le **logo officiel NeuroCare**
  (intégré en data URI, sans réseau), nom du patient, date de génération, contenu propre au module et mention
  de non-diagnostic.
- **Nom de fichier explicite et horodaté** (renommage `moveAsync` avant le partage) :
  `NeuroCare_<Module>_<Patient>_<YYYY-MM-DD>_<HHhMM>.pdf`, avec `Rappels-Suivi`, `Saturation-SpO2`,
  `Sante-Mentale-GDS`, `Diabete-FINDRISC`, `Tension-HTA` ou `Alzheimer-4A` ; caractères interdits
  (`/ \ : * ? " < > |`) retirés, espaces remplacés par des tirets, « Patient » par défaut. Ex. :
  `NeuroCare_Tension-HTA_Ahmed-Benali_2026-11-20_11h30.pdf`. Le rapport hebdomadaire du Module 1 porte le nom
  du senior.

### 12.3 bis Bandeaux d'aide à la mesure

- En haut des modules 2 à 6, une carte `MeasurementGuideCard` (FR / AR) : **illustration de l'appareil**
  (`DeviceIllustration`, dessinée en composants natifs, sans dépendance native), lecture de l'écran avec code
  couleur, alternative **en pharmacie** et conditions de mesure.
- Tension : tensiomètre électronique au bras (écran `SYS 120` → TAS, `DIA 80` → TAD, `PUL 72` → pouls) ; assis
  au calme 5 min, bras à hauteur du cœur, le matin avant le petit-déjeuner et les médicaments.
- SpO₂ : oxymètre de pouls au doigt (`SpO₂ 98 %`, `PR 72`) ; repos complet 5 min, doigt propre, sec et
  réchauffé, sans vernis ni faux ongles.
- Diabète : pèse-personne (`70.0 kg`), mètre ruban au nombril, lecteur de glycémie (`0.95 g/L`) ; toute
  glycémie capillaire est notée à jeun (≥ 8 h) ou 2 h après le début du repas.
- Santé mentale et Alzheimer : conseils de passation (calme, 7 derniers jours ; lunettes et appareils auditifs).

### 12.4 Hors ligne

- Modules 2 à 6 : 100 % hors ligne (calculs, alertes, historiques et PDF).
- Module 1 : cache local des prises et du profil, voix préchargées, file d'attente des confirmations,
  notifications locales programmées à l'avance.

## 13. Architecture technique et stack

### 13.1 Vue d'ensemble

```
 Téléphone (Expo / React Native)
 ├── Modules 2 à 6 ──► AsyncStorage (local, hors ligne) ──► expo-print / expo-sharing (PDF)
 └── Module 1 ──HTTPS REST /api/v1 + WebSocket STOMP──► Backend Spring Boot ──► PostgreSQL 16
                                                          │                    └► MinIO (fichiers voix)
                                                          └── HTTP interne ──► audio-service (FastAPI)
```

### 13.2 Mobile (`mobile/`)

| Domaine | Technologies |
|---|---|
| Socle | React Native 0.88, React 19, **Expo SDK 58**, **TypeScript** |
| Navigation | **Expo Router** (routes fichiers, pile de navigation) |
| Persistance locale | **AsyncStorage** (modules autonomes, langue, cache), **expo-secure-store** (session, identifiants) |
| Audio et alertes | **expo-audio** (enregistrement de la voix, lecture des rappels), **expo-notifications** (pré-rappels et alarmes), expo-haptics |
| PDF | **expo-print**, **expo-sharing**, expo-file-system |
| Temps réel | @stomp/stompjs (WebSocket STOMP), NetInfo |
| Langues | Contexte i18n maison (`src/i18n/`), dictionnaires fr / ar |
| Thème | `src/theme/` (jetons de couleurs, composants partagés) |
| Distribution | **EAS Build** (APK de test), **EAS Update** (mises à jour OTA, canal `preview`) |

### 13.3 Backend (`backend/`) — Module 1 et API de pré-dépistage

| Domaine | Technologies |
|---|---|
| Langage / cadre | **Java 21**, **Spring Boot 3.5**, Maven (wrapper) |
| Sécurité | **Spring Security**, **JWT** (aidant) et jeton d'appareil (senior), mots de passe hachés |
| Données | **JPA / Hibernate**, **PostgreSQL 16**, migrations **Flyway** (V1 à V10) |
| API | **REST versionnée `/api/v1`**, erreurs au format RFC 7807 (`ProblemDetail`), DTO en `record`, OpenAPI (springdoc) |
| Temps réel | WebSocket STOMP |
| Tâches planifiées | ShedLock (verrous distribués), Resilience4j |
| Fichiers et PDF | MinIO (voix), OpenPDF (rapport hebdomadaire) |
| Organisation | Paquets `ma.neurocare.<module>` en couches `api / domain / application / infrastructure` |

Les modules de pré-dépistage disposent aussi d'endpoints serveur (scores toujours recalculés), non utilisés
par l'application depuis le passage des modules 2 à 6 en stockage local.

### 13.4 Service audio (`audio-service/`)

Python 3.11, FastAPI : microservice interne (non exposé à Internet), protégé par une clé partagée avec le
backend, pour le traitement des voix.

### 13.5 Infrastructure (`infra/`)

**Docker** et **Docker Compose** : PostgreSQL 16, MinIO, backend, audio-service ; ports et secrets dans
`infra/.env` (non versionné, modèle `infra/.env.example`).

## 14. Données, sécurité et confidentialité

- Secrets (clé JWT, mots de passe de base et de stockage) fournis par variables d'environnement, jamais
  versionnés.
- Session et identifiants mémorisés dans le stockage sécurisé du téléphone.
- Accès aux données d'un senior soumis au lien aidant et au consentement « partage familial » ; lectures de
  données de santé journalisées.
- Voix : donnée sensible, utilisée uniquement pour les rappels, supprimée au retrait du consentement.
- Modules 2 à 6 : aucune donnée envoyée sur le réseau ; les données restent sur le téléphone et sont effacées à
  la désinstallation.

## 15. Qualité, tests et livraison

| Contrôle | Portée |
|---|---|
| Tests backend | Tests unitaires (barèmes, sécurité, services) et tests d'intégration sur PostgreSQL (Testcontainers), dont `EthicsTest` (mentions de non-diagnostic) — 164 tests unitaires et 81 tests d'intégration au dernier passage |
| Tests mobile | **162 tests** Jest / React Native Testing Library : barèmes et seuils de chaque module, stockage local, PDF français et arabe (logo, nom de fichier horodaté), bandeaux d'aide à la mesure, parcours complets des écrans sur téléphone vierge, bascule de langue et RTL, indépendance des modules |
| Typage et style | `tsc --noEmit`, `expo lint` |
| Bundle | `expo export` (Android) |
| Livraison | EAS Build (APK `preview`) et EAS Update (OTA, sans réinstallation tant qu'aucun module natif n'est ajouté) |

## 16. Limites connues et évolutions

- Les textes produits par le serveur (messages d'erreur détaillés, avertissement du tableau de bord, rapport
  hebdomadaire PDF) restent en français.
- Les questions GDS-15 en arabe sont une traduction de travail : à remplacer par la version arabe validée pour
  un usage clinique.
- Le questionnaire des 4 A et les seuils de l'indice de vigilance sont à faire valider par un clinicien.
- Modules 2 à 6 : un seul historique par téléphone (pas de séparation par patient) ; aucune sauvegarde
  distante.
- Évolutions possibles : export / sauvegarde chiffrée des historiques locaux, traduction des contenus serveur,
  profils multi-patients, partage sécurisé des relevés avec le médecin.

---

*NeuroCare est un outil de pré-dépistage et d'aide à la décision médicale. Il ne constitue pas un dispositif de
diagnostic et ne remplace pas l'avis d'un professionnel de santé.*
