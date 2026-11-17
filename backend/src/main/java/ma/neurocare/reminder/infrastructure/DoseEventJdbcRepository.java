package ma.neurocare.reminder.infrastructure;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Requêtes SQL natives du moteur de rappel (insertion idempotente, clôture en masse).
 */
@Repository
@RequiredArgsConstructor
public class DoseEventJdbcRepository {

    private final NamedParameterJdbcTemplate jdbc;

    /** Prise clôturée en SANS_REPONSE par le job de clôture. */
    public record ClosedDose(UUID doseId, UUID seniorId, UUID scheduleId, Instant datePrevue) {
    }

    /**
     * Crée la prise si elle n'existe pas : UNIQUE (schedule_id, date_prevue) garantit
     * qu'un rappel n'est jamais généré deux fois (cahier §6.5).
     *
     * @return {@code true} si une ligne a été insérée
     */
    public boolean insertIfAbsent(UUID scheduleId, UUID seniorId, Instant datePrevue) {
        int rows = jdbc.update("""
                INSERT INTO dose_events (id, schedule_id, senior_id, date_prevue)
                VALUES (:id, :scheduleId, :seniorId, :datePrevue)
                ON CONFLICT (schedule_id, date_prevue) DO NOTHING
                """, new MapSqlParameterSource()
                .addValue("id", UUID.randomUUID())
                .addValue("scheduleId", scheduleId)
                .addValue("seniorId", seniorId)
                .addValue("datePrevue", utc(datePrevue)));
        return rows > 0;
    }

    /**
     * Clôture en masse (cahier §9.2) : EN_ATTENTE dont l'heure prévue + délai du senior est dépassée.
     * {@code timeoutOverride} (profil demo) remplace le délai de chaque senior s'il est renseigné.
     */
    public List<ClosedDose> closeExpired(Instant now, Duration timeoutOverride) {
        return jdbc.query("""
                UPDATE dose_events d SET statut = 'SANS_REPONSE', version = d.version + 1
                  FROM senior_profiles p
                 WHERE d.senior_id = p.user_id AND d.statut = 'EN_ATTENTE'
                   AND d.date_prevue + CASE
                         WHEN CAST(:overrideSeconds AS bigint) IS NULL THEN make_interval(mins => p.delai_sans_reponse_min)
                         ELSE make_interval(secs => CAST(:overrideSeconds AS double precision))
                       END < :now
                RETURNING d.id, d.senior_id, d.schedule_id, d.date_prevue
                """, new MapSqlParameterSource()
                        .addValue("now", utc(now))
                        .addValue("overrideSeconds", timeoutOverride == null ? null : timeoutOverride.toSeconds()),
                (rs, i) -> new ClosedDose(
                        rs.getObject("id", UUID.class),
                        rs.getObject("senior_id", UUID.class),
                        rs.getObject("schedule_id", UUID.class),
                        rs.getObject("date_prevue", OffsetDateTime.class).toInstant()));
    }

    private static OffsetDateTime utc(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
