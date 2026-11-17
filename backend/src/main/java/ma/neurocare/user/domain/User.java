package ma.neurocare.user.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ma.neurocare.common.domain.BaseEntity;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Tout compte : SENIOR, AIDANT, MEDECIN, ADMIN (table {@code users}).
 * Un SENIOR n'a ni mot de passe ni forcément de téléphone.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseEntity {

    @Column(name = "nom_complet", nullable = false, length = 120)
    private String nomComplet;

    /** Format E.164, unique, NULL possible pour un senior. */
    @Column(name = "telephone", unique = true, length = 20)
    private String telephone;

    /** BCrypt ; NULL pour un SENIOR. */
    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "role", nullable = false, columnDefinition = "user_role")
    private UserRole role;

    @Column(name = "actif", nullable = false)
    private boolean actif = true;

    @Column(name = "failed_logins", nullable = false)
    private short failedLogins;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "date_creation", nullable = false, updatable = false)
    private Instant dateCreation = Instant.now();

    @Column(name = "date_maj", nullable = false)
    private Instant dateMaj = Instant.now();

    public User(String nomComplet, String telephone, String passwordHash, UserRole role) {
        this.nomComplet = nomComplet;
        this.telephone = telephone;
        this.passwordHash = passwordHash;
        this.role = role;
    }

    @PreUpdate
    void touch() {
        this.dateMaj = Instant.now();
    }
}
