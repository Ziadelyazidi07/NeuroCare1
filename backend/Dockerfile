# syntax=docker/dockerfile:1.7
# NeuroCare backend — build multi-étapes (cahier §15.4) : Maven/JDK 21 → JRE 21.

# ---------- 1. Build ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
# Dépendances d'abord (couche réutilisée tant que le pom ne change pas) ; cache Maven persistant BuildKit.
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -q -B dependency:go-offline
COPY src ./src
# Les tests (Testcontainers) tournent en CI via « mvn verify », pas dans l'image.
RUN --mount=type=cache,target=/root/.m2 mvn -q -B package -DskipTests \
    && cp target/neurocare-backend-*.jar app.jar \
    && java -Djarmode=tools -jar app.jar extract --layers --launcher --destination extracted

# ---------- 2. Exécution ----------
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
RUN groupadd --system --gid 1001 neurocare \
    && useradd --system --uid 1001 --gid neurocare --home /app neurocare
# Couches Spring Boot, de la plus stable à la plus changeante : un changement de code ne recopie que la dernière.
COPY --from=build --chown=neurocare:neurocare /app/extracted/dependencies/ ./
COPY --from=build --chown=neurocare:neurocare /app/extracted/spring-boot-loader/ ./
COPY --from=build --chown=neurocare:neurocare /app/extracted/snapshot-dependencies/ ./
COPY --from=build --chown=neurocare:neurocare /app/extracted/application/ ./
USER neurocare
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
# Pas de curl dans l'image JRE : sonde HTTP en bash pur sur /actuator/health.
HEALTHCHECK --interval=15s --timeout=3s --start-period=60s --retries=5 \
    CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080 && printf "GET /actuator/health HTTP/1.0\r\nHost: localhost\r\n\r\n" >&3 && grep -q "\"status\":\"UP\"" <&3'
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
