package ma.neurocare.cognitive.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

import ma.neurocare.common.domain.Language;

/**
 * Banque de mots du rappel de mots (EF-CG-01) : noms concrets du quotidien, faciles à illustrer et à
 * prononcer. En darija, le mot de référence est la transcription latine (cahier §6.4 : « khobz »,
 * « bab », « chems »…), accompagnée de l'écriture arabe pour l'affichage. L'arabe standard utilise
 * provisoirement la banque darija (écriture arabe). Liste à relire avec des locuteurs (EF-VO-05).
 */
public final class WordBank {

    public static final int PROPOSITIONS = 9;
    public static final int MIN_WORDS = 3;
    public static final int MAX_WORDS = 5;

    /** @param mot forme de référence (stockée dans le résultat brut) ; {@code ecritureArabe} nulle en français */
    public record Word(String mot, String ecritureArabe) {
    }

    /** Tirage : mots à mémoriser et 9 propositions mélangées (les mots tirés + des distracteurs). */
    public record Draw(List<Word> motsPresentes, List<Word> propositions) {
    }

    private static final List<Word> FRANCAIS = words(
            "pain", "porte", "soleil", "eau", "verre", "maison", "huile", "rose", "lune", "chat",
            "pomme", "chaise", "livre", "clé", "arbre", "mer", "lait", "sucre", "tapis", "oiseau",
            "montre", "fleur", "bateau", "cheval");

    private static final List<Word> DARIJA = List.of(
            new Word("khobz", "خبز"), new Word("bab", "باب"), new Word("chems", "شمس"), new Word("ma", "ما"),
            new Word("kas", "كاس"), new Word("dar", "دار"), new Word("zit", "زيت"), new Word("ward", "ورد"),
            new Word("qmar", "قمر"), new Word("mech", "مش"), new Word("teffaha", "تفاحة"),
            new Word("korsi", "كرسي"), new Word("ktab", "كتاب"), new Word("sarut", "ساروت"),
            new Word("chajra", "شجرة"), new Word("bhar", "بحر"), new Word("hlib", "حليب"),
            new Word("sukkar", "سكر"), new Word("zerbiya", "زربية"), new Word("ttir", "طير"),
            new Word("magana", "مكانة"), new Word("atay", "أتاي"), new Word("flouka", "فلوكة"),
            new Word("bechkir", "بشكير"));

    private static final Map<Language, List<Word>> BANKS = Map.of(
            Language.FR, FRANCAIS,
            Language.DARIJA, DARIJA,
            Language.AR, DARIJA);

    private WordBank() {
    }

    public static List<Word> wordsFor(Language language) {
        return BANKS.get(language);
    }

    public static Optional<Word> find(Language language, String mot) {
        return wordsFor(language).stream().filter(w -> w.mot().equals(mot)).findFirst();
    }

    public static Draw draw(Language language, int count, Random random) {
        if (count < MIN_WORDS || count > MAX_WORDS) {
            throw new IllegalArgumentException("Entre 3 et 5 mots");
        }
        List<Word> pool = new ArrayList<>(wordsFor(language));
        Collections.shuffle(pool, random);
        List<Word> presented = List.copyOf(pool.subList(0, count));
        List<Word> propositions = new ArrayList<>(pool.subList(0, PROPOSITIONS));
        Collections.shuffle(propositions, random);
        return new Draw(presented, List.copyOf(propositions));
    }

    private static List<Word> words(String... values) {
        return java.util.Arrays.stream(values).map(v -> new Word(v, null)).toList();
    }
}
