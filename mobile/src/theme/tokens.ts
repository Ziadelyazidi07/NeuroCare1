/**
 * Thème médical « clean » (inspiration Dokterian) : fond gris-bleuté doux, cartes blanches très arrondies,
 * bleu médical vif pour l'action, bleu profond pour les titres. Texte courant ≥ 16, titres et boutons 20-24.
 */
import type { ViewStyle } from 'react-native';

export const colours = {
  background: '#F5F8FC',
  card: '#FFFFFF',
  /** Titres. */
  title: '#112950',
  /** Texte courant (contraste ≥ 12:1 sur le fond). */
  text: '#1C2B45',
  /** Texte secondaire (contraste ≥ 5:1 sur blanc). */
  muted: '#55657E',
  primary: '#246BFD',
  primarySoft: '#EBF2FF',
  primaryText: '#FFFFFF',
  border: '#E6EEF8',
  inputBorder: '#C9D6E8',
  shadow: '#0F3D6E',
  danger: '#C62828',
  dangerSoft: '#FEE2E2',
  success: '#167A45',
  successSoft: '#DCFCE7',
  warning: '#9A5B00',
  warningSoft: '#FEF3C7',
  warningBg: '#FFF8E6',
  warningBorder: '#F1C66B',
};

/** Couleurs des niveaux d'alerte (texte foncé sur fond pastel, ou blanc sur rouge pour l'urgence). */
export const levelColours = {
  VERT: { bg: '#DCFCE7', fg: '#14653A' },
  ORANGE: { bg: '#FEF3C7', fg: '#8A4600' },
  ROUGE: { bg: '#C62828', fg: '#FFFFFF' },
} as const;

export const pillColours = { VERT: '#167A45', ORANGE: '#B45309', GRIS: '#6B7280' } as const;

export const radius = { card: 20, control: 14, pill: 999 };

export const shadow: ViewStyle = {
  shadowColor: colours.shadow,
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

export const font = { body: 17, small: 16, label: 16, title: 22, header: 28, button: 20 };

/**
 * Espace senior (ENF-08) : police ≥ 24 sp, boutons ≥ 64 dp, contraste ≥ 7:1. Thème normal aux couleurs
 * médicales, thème « contraste élevé » noir / jaune conservé.
 */
export const seniorColours = {
  high: { background: '#000000', text: '#FFFFFF', muted: '#E0E0E0', action: '#FFD60A', actionText: '#000000', card: '#1A1A1A', danger: '#FF8A80' },
  normal: { background: '#F5F8FC', text: '#112950', muted: '#33415C', action: '#1847B8', actionText: '#FFFFFF', card: '#FFFFFF', danger: '#B00020' },
};

/** Taille minimale des cibles tactiles (dp). */
export const MIN_TOUCH = 64;
/** Taille minimale du texte senior (sp). */
export const SENIOR_MIN_FONT = 24;
