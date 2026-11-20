# Projet NeuroCare — Règles de Développement

## Référence
Toute l'architecture, le SQL, les endpoints et les règles sont dans `docs/cahier-des-charges.pdf`. Lis-le avant chaque étape.

## Stack Technique
- `backend/` : Spring Boot 3.3+, Java 21, Maven, PostgreSQL 16, Flyway, Spring Security (JWT + DeviceToken), WebSocket STOMP, ShedLock, MapStruct, OpenPDF, MinIO.
- `audio-service/` : Python 3.11, FastAPI.
- `mobile/` : React Native (Expo).
- `infra/` : docker-compose.yml (PostgreSQL 16, MinIO, backend, audio-service).

## Conventions Strictes
1. Packages backend : `ma.neurocare.<module>` (config, common, security, auth, user, consent, medication, reminder, voice, cognitive, notification, dashboard, report, audit, saturation, mental, metabolic, cardio).
2. Couches par module : `api/`, `domain/`, `application/`, `infrastructure/`.
3. DTO : Exclusivement des `record` Java. Jamais d'entité JPA dans les controllers.
4. Erreurs : Format RFC 7807 (`ProblemDetail`).
5. Éthique : jamais de diagnostic. Le Module 1 (observance) et les exercices cognitifs restent sans aucun score
   médical (ni score Alzheimer, ni risque, ni probabilité).
   Exception autorisée : les échelles cliniques standardisées des modules de pré-dépistage (Mini-GDS / GDS-15,
   FINDRISC, seuils SpO2, automesure HTA) peuvent calculer leur score et leurs seuils officiels, comme outils de
   pré-dépistage, de suivi d'indicateurs et d'orientation médicale. Conditions :
   - barème officiel testé (mobile et backend appliquent les mêmes seuils ; un score reçu par le serveur est
     toujours recalculé, jamais repris de l'application) ;
   - formulations « indicateurs compatibles avec… » et orientation vers un professionnel, jamais « vous avez… » ;
   - chaque écran, réponse d'API et PDF porte la mention explicite que le résultat ne constitue pas un diagnostic
     médical officiel et ne remplace pas un médecin (vérifié par `EthicsTest`).
6. Mobile : un dossier par module dans `mobile/src/modules/`, sans import d'un module à l'autre (vérifié par les tests).
7. Seul le Module 1 (« Rappels & Suivi ») dépend de la relation aidant / senior (appairage, compte, consentements).
   Les modules 2 à 5 s'ouvrent sans compte ni réseau et stockent leurs données sur le téléphone ; ils n'importent
   jamais `auth/`, `api/`, `senior/` ni `realtime/` (vérifié par les tests).

## Règles de Travail
- Code étape par étape, jamais tout d'un coup.
- Après chaque étape, lance `mvn compile` ou `mvn test` dans `backend/` et corrige les erreurs avant de continuer.
- Fais un git commit à chaque étape validée.

## Environnement local
- `mvn` n'est pas dans le PATH : utiliser `backend/mvnw` (Maven Wrapper).
- JDK 21 non installé : utiliser le JDK 25 (`C:\Program Files\Eclipse Adoptium\jdk-25.0.2.10-hotspot`) — le pom compile avec `--release 21`.
- tzdata du JDK 25 local (2025b) en retard sur l'image Docker (2026e) et PostgreSQL (2026f) : les règles
  d'`Africa/Casablanca` diffèrent (UTC+1 contre UTC+0 en nov. 2026). Les tests unitaires utilisent un fuseau
  aux règles fixes ; ne pas y coder en dur le décalage de Casablanca. La référence est l'image Docker.
- Stack complète : `cd infra && docker compose up -d --build` (ports hôtes dans `infra/.env`). Démo : `docs/demo.md`.
