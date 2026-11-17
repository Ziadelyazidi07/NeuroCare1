# Projet NeuroCare — Règles de Développement

## Référence
Toute l'architecture, le SQL, les endpoints et les règles sont dans `docs/cahier-des-charges.pdf`. Lis-le avant chaque étape.

## Stack Technique
- `backend/` : Spring Boot 3.3+, Java 21, Maven, PostgreSQL 16, Flyway, Spring Security (JWT + DeviceToken), WebSocket STOMP, ShedLock, MapStruct, OpenPDF, MinIO.
- `audio-service/` : Python 3.11, FastAPI.
- `mobile/` : React Native (Expo).
- `infra/` : docker-compose.yml (PostgreSQL 16, MinIO, backend, audio-service).

## Conventions Strictes
1. Packages backend : `ma.neurocare.<module>` (config, common, security, auth, user, consent, medication, reminder, voice, cognitive, notification, dashboard, report, audit).
2. Couches par module : `api/`, `domain/`, `application/`, `infrastructure/`.
3. DTO : Exclusivement des `record` Java. Jamais d'entité JPA dans les controllers.
4. Erreurs : Format RFC 7807 (`ProblemDetail`).
5. Éthique : Aucun score médical ni diagnostic.

## Règles de Travail
- Code étape par étape, jamais tout d'un coup.
- Après chaque étape, lance `mvn compile` ou `mvn test` dans `backend/` et corrige les erreurs avant de continuer.
- Fais un git commit à chaque étape validée.

## Environnement local
- `mvn` n'est pas dans le PATH : utiliser `backend/mvnw` (Maven Wrapper).
- JDK 21 non installé : utiliser le JDK 25 (`C:\Program Files\Eclipse Adoptium\jdk-25.0.2.10-hotspot`) — le pom compile avec `--release 21`.
