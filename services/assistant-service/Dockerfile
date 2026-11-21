# syntax=docker/dockerfile:1.7
# NeuroCare assistant-service — build multi-étapes : Maven/JDK 21 → JRE 21 (port 8089).

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -q -B dependency:go-offline
COPY src ./src
# La base de connaissances est validée au démarrage et par les tests (mvn verify en CI).
RUN --mount=type=cache,target=/root/.m2 mvn -q -B package -DskipTests \
    && cp target/assistant-service-*.jar app.jar \
    && java -Djarmode=tools -jar app.jar extract --layers --launcher --destination extracted

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
RUN groupadd --system --gid 1001 neurocare \
    && useradd --system --uid 1001 --gid neurocare --home /app neurocare
COPY --from=build --chown=neurocare:neurocare /app/extracted/dependencies/ ./
COPY --from=build --chown=neurocare:neurocare /app/extracted/spring-boot-loader/ ./
COPY --from=build --chown=neurocare:neurocare /app/extracted/snapshot-dependencies/ ./
COPY --from=build --chown=neurocare:neurocare /app/extracted/application/ ./
USER neurocare
EXPOSE 8089
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
HEALTHCHECK --interval=15s --timeout=3s --start-period=40s --retries=5 \
    CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8089 && printf "GET /api/v1/assistant/health HTTP/1.0\r\nHost: localhost\r\n\r\n" >&3 && grep -q "\"status\":\"UP\"" <&3'
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
