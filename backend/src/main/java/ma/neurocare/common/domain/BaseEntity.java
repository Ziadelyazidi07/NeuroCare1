package ma.neurocare.common.domain;

import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;
import org.hibernate.proxy.HibernateProxy;
import org.springframework.data.domain.Persistable;

/**
 * Entité à identifiant UUID v4 généré côté application (cahier §5.3).
 * Implémente {@link Persistable} pour que {@code save()} fasse un INSERT direct
 * (pas de SELECT préalable) sur une entité neuve.
 */
@MappedSuperclass
public abstract class BaseEntity implements Persistable<UUID> {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Transient
    private boolean isNew = true;

    protected BaseEntity() {
        this.id = UUID.randomUUID();
    }

    /** Pour les entités dont l'identifiant est imposé (ex. profil senior = id de l'utilisateur). */
    protected BaseEntity(UUID id) {
        this.id = Objects.requireNonNull(id);
    }

    @Override
    public UUID getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        this.isNew = false;
    }

    @Override
    public final boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null) {
            return false;
        }
        Class<?> oClass = o instanceof HibernateProxy p
                ? p.getHibernateLazyInitializer().getPersistentClass() : o.getClass();
        Class<?> thisClass = this instanceof HibernateProxy p
                ? p.getHibernateLazyInitializer().getPersistentClass() : getClass();
        return thisClass == oClass && o instanceof BaseEntity other && Objects.equals(id, other.getId());
    }

    @Override
    public final int hashCode() {
        return Objects.hashCode(id);
    }
}
