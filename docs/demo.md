# NeuroCare — scénario de démonstration (3 min)

> **Données entièrement fictives.** Le profil Spring `demo` charge `V99__demo_data.sql`
> (comptes aux identifiants publics) : il ne doit jamais être activé en production.

## Lancer

```bash
cd infra
cp .env.example .env          # puis renseigner les secrets ; SPRING_PROFILES_ACTIVE=demo
docker compose down -v        # repartir d'une base vide : les rappels « en direct » sont recalculés
docker compose up --build
```

Délais du profil `demo` : moteur toutes les **10 s**, relance à **+30 s**, `SANS_REPONSE` à **+1 min**.

## Plan B : Wi-Fi de la salle sans accès au PC

- Adresse du serveur : `http://<IPv4 du PC>:8088/api/v1` (port **8088** : `BACKEND_PORT` de `infra/.env`). Sur le
  téléphone, sous la connexion aidant ou l'appairage senior : « Mode Démo Hors Ligne (Sans serveur) » → champ
  « URL de l'API », **Tester** puis **Enregistrer** (aucune recompilation).
- Pare-feu Windows (réseau « Public ») : PowerShell **administrateur**
  `New-NetFirewallRule -DisplayName "NeuroCare API 8088" -Direction Inbound -Protocol TCP -LocalPort 8088 -Action Allow -Profile Any`.
- Sans réseau du tout : « Entrer comme aidant (démo) » ou « Entrer comme senior (démo) » : données fictives sur le
  téléphone, Vitamine D3 à confirmer 2 min après l'entrée, rapport PDF généré localement.

## Personnages et accès

| Rôle | Nom | Accès |
|------|-----|-------|
| Senior | Hajj Ahmed, 74 ans (né en 1952), darija | token d'appareil `ncd_demo-hajj-ahmed-NE-PAS-UTILISER-EN-PRODUCTION` (déjà appairé) |
| Aidante | Salma B. (fille, l'appelle « Baba ») | téléphone `+212600000001`, mot de passe `NeuroCare-Demo-2026` |

Identifiant du senior : `0d000000-0000-4000-8000-000000000002`.
Les 4 consentements sont accordés ; la paire est validée.

## Contenu préchargé

- **Metformine 500** (08:00 et 20:00, « 1 comprimé pendant le repas ») depuis 3 semaines, avec
  14 jours d'historique : surtout confirmées, quelques « sans réponse », une désactivée.
- **Vitamine D** à **T+2 min** et **Amlodipine 5** à **T+4 min** (T = premier démarrage), pour le jour même.
- 6 exercices de rappel de mots sur 5 semaines (dont un interrompu).

## Déroulé (cahier §2.2)

1. Salma se connecte (`POST /api/v1/auth/login`) et ouvre le tableau de bord
   (`GET /api/v1/seniors/{id}/dashboard/today`) abonné à `/topic/seniors/{id}/events`.
2. À T+2 min, le téléphone de Hajj Ahmed reçoit le rappel « Vitamine D » ; il appuie sur « C'est fait »
   (`POST /api/v1/doses/{doseId}/confirm`) → **pastille verte** en direct chez Salma.
3. À T+4 min, le rappel « Amlodipine 5 » est laissé sans réponse → après 1 min, **pastille orange** et alerte.
4. Hajj Ahmed fait un exercice de 3 mots (`GET /api/v1/me/cognitive/next`, `POST /api/v1/me/cognitive/sessions`)
   → résultat brut visible.
5. Salma télécharge le rapport de la semaine précédente
   (`GET /api/v1/seniors/{id}/reports/weekly?weekStart=<lundi>`) : PDF marqué « DONNÉES FICTIVES »
   avec l'avertissement de non-diagnostic.

Pour rejouer un rappel « en direct » sans réinitialiser la base, Salma crée un traitement à l'heure
voulue (`POST /api/v1/seniors/{id}/medications`).
