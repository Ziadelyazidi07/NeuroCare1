package ma.neurocare.voice.domain;

import ma.neurocare.common.domain.Language;

/**
 * Gabarit du message vocal de rappel (cahier §10.3, étape 4) :
 * « {surnom}, c'est l'heure de ton médicament {nom}. Appuie sur le gros bouton quand c'est fait. »
 *
 * <p>Aucune posologie, aucun reproche. Les versions darija et arabe doivent être relues par un
 * locuteur avant mise en production (EF-VO-05).
 */
public final class ReminderMessageTemplate {

    static final int MAX_LENGTH = 300; // audio_assets.texte

    private ReminderMessageTemplate() {
    }

    public static String render(Language language, String surnom, String nomMedicament) {
        String text = switch (language) {
            case FR -> "%s, c'est l'heure de ton médicament %s. Appuie sur le gros bouton quand c'est fait.";
            case DARIJA -> "%s، هادي ساعة الدوا ديالك %s. ورك على البوطونة الكبيرة ملي تسالي.";
            case AR -> "%s، حان وقت دوائك %s. اضغط على الزر الكبير عندما تنتهي.";
        };
        String rendered = text.formatted(clean(surnom), clean(nomMedicament));
        return rendered.length() <= MAX_LENGTH ? rendered : rendered.substring(0, MAX_LENGTH);
    }

    private static String clean(String value) {
        return value == null ? "" : value.strip().replaceAll("\\s+", " ");
    }
}
