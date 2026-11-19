package ma.neurocare.metabolic.domain;

/** Réponses aux 8 questions du FINDRISC (le poids et la taille donnent l'IMC). */
public record FindriscAnswers(
        int age,
        Sex sexe,
        double poidsKg,
        double tailleCm,
        int tourTailleCm,
        boolean activitePhysique,
        boolean fruitsLegumesQuotidiens,
        boolean medicamentsHypertension,
        boolean glycemieEleveeAntecedent,
        FamilyHistory antecedentsFamiliaux) {

    public FindriscAnswers {
        if (age < 18 || age > 120) {
            throw new IllegalArgumentException("Âge invalide (18 à 120 ans)");
        }
        if (poidsKg < 20 || poidsKg > 350 || tailleCm < 100 || tailleCm > 250) {
            throw new IllegalArgumentException("Poids (20 à 350 kg) ou taille (100 à 250 cm) invalide");
        }
        if (tourTailleCm < 40 || tourTailleCm > 200) {
            throw new IllegalArgumentException("Tour de taille invalide (40 à 200 cm)");
        }
        if (sexe == null || antecedentsFamiliaux == null) {
            throw new IllegalArgumentException("Réponse manquante");
        }
    }

    /** IMC arrondi à 0,1 : c'est la valeur affichée qui est cotée. */
    public double imc() {
        double meters = tailleCm / 100.0;
        return Math.round(poidsKg / (meters * meters) * 10) / 10.0;
    }
}
