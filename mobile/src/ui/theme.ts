/**
 * Thèmes visuels. Senior (ENF-08) : police ≥ 24 sp, boutons ≥ 64 dp, contraste ≥ 7:1 (noir / blanc /
 * jaune). Aidant : interface classique lisible.
 */
export const seniorColours = {
  // Contraste élevé : texte blanc sur fond noir (21:1), bouton jaune avec texte noir (19:1).
  high: { background: '#000000', text: '#FFFFFF', muted: '#E0E0E0', action: '#FFD60A', actionText: '#000000', card: '#1A1A1A', danger: '#FF8A80' },
  // Contraste standard : texte quasi noir sur fond clair (≥ 15:1), bouton bleu foncé (≥ 8:1).
  normal: { background: '#FFFFFF', text: '#111111', muted: '#333333', action: '#0B3D91', actionText: '#FFFFFF', card: '#F2F4F7', danger: '#B00020' },
};

export const pillColours = { VERT: '#1E8E3E', ORANGE: '#E8710A', GRIS: '#80868B' } as const;

export const aidantColours = {
  background: '#F6F8FB',
  card: '#FFFFFF',
  text: '#1B1F24',
  muted: '#5F6368',
  primary: '#0B57D0',
  primaryText: '#FFFFFF',
  border: '#DADCE0',
  danger: '#B3261E',
  warningBg: '#FFF8E1',
  warningBorder: '#CC9900',
};

/** Taille minimale des cibles tactiles (dp). */
export const MIN_TOUCH = 64;
/** Taille minimale du texte senior (sp). */
export const SENIOR_MIN_FONT = 24;
