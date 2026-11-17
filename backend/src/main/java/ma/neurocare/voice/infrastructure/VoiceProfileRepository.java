package ma.neurocare.voice.infrastructure;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import ma.neurocare.voice.domain.VoiceProfile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VoiceProfileRepository extends JpaRepository<VoiceProfile, UUID> {

    List<VoiceProfile> findByCaregiverLinkIdInOrderByDateCreationDesc(Collection<UUID> caregiverLinkIds);
}
