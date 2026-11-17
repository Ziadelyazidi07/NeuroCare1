package ma.neurocare.user.infrastructure;

import java.util.Optional;
import java.util.UUID;

import ma.neurocare.user.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByTelephone(String telephone);

    boolean existsByTelephone(String telephone);
}
