/**
 * Illustrations des appareils de mesure, dessinées en composants natifs (aucune dépendance SVG, donc aucune
 * nouvelle version native) : tensiomètre électronique au bras, oxymètre de pouls au doigt, pèse-personne +
 * mètre ruban + lecteur de glycémie. Les écrans digitaux affichent des valeurs d'exemple ; la couleur de
 * chaque repère (SYS, DIA, PUL…) est reprise dans la légende du guide pour savoir quel chiffre recopier où.
 *
 * Le dessin garde l'orientation physique de l'appareil (gauche-droite) quelle que soit la langue ; il est
 * annoncé comme une seule image (libellé traduit) aux lecteurs d'écran.
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { useLanguage } from '../i18n';

export type DeviceKind = 'tensiometer' | 'oximeter' | 'metabolic';

/** Couleurs des repères d'écran, dans l'ordre des lignes de légende du guide. */
export const READING_COLOURS: Record<DeviceKind, string[]> = {
  tensiometer: ['#C62828', '#1D4ED8', '#167A45'],
  oximeter: ['#0284C7', '#167A45'],
  metabolic: ['#1D4ED8', '#55657E', '#B45309'],
};

const CANVAS = { width: 280, height: 170 };
const SKIN = '#F1C7A4';
const SKIN_EDGE = '#D9A27F';
const LCD = '#E3F0E8';
const LED = '#0B1220';
const INK = '#10243F';

export function DeviceIllustration({ kind }: { kind: DeviceKind }) {
  const { t } = useLanguage();
  const [scale, setScale] = useState(1);
  const onLayout = (event: LayoutChangeEvent) => setScale(Math.min(1, event.nativeEvent.layout.width / CANVAS.width));

  return (
    <View
      onLayout={onLayout}
      style={[styles.frame, { height: CANVAS.height * scale }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t.shared.devices[kind]}
      testID={`device-${kind}`}
    >
      <View style={[styles.canvas, { transform: [{ scale }] }]}>
        {kind === 'tensiometer' ? <Tensiometer /> : kind === 'oximeter' ? <Oximeter /> : <Metabolic />}
      </View>
    </View>
  );
}

/** Rectangle positionné dans le canevas. */
function Box({ x, y, w, h, style, children }: { x: number; y: number; w: number; h: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return <View style={[{ position: 'absolute', left: x, top: y, width: w, height: h }, style]}>{children}</View>;
}

function Digits({ value, size, colour = INK, style }: { value: string; size: number; colour?: string; style?: TextStyle }) {
  return <Text style={[styles.digits, { fontSize: size, color: colour }, style]}>{value}</Text>;
}

function Tensiometer() {
  const { t } = useLanguage();
  const s = t.shared.devices.screen;
  const [sysColour, diaColour, pulColour] = READING_COLOURS.tensiometer;
  const rows = [
    { label: s.sys, value: '120', colour: sysColour },
    { label: s.dia, value: '80', colour: diaColour },
    { label: s.pul, value: '72', colour: pulColour },
  ];
  return (
    <>
      {/* Avant-bras posé, puis bras (de l'épaule au coude). */}
      <Box x={110} y={84} w={44} h={86} style={styles.skinRound} />
      <Box x={0} y={62} w={152} h={50} style={[styles.skin, { borderTopRightRadius: 25, borderBottomRightRadius: 25 }]} />
      {/* Tuyau souple du brassard vers le boîtier. */}
      <Box x={60} y={18} w={112} h={40} style={styles.tube} />
      <Box x={56} y={44} w={14} h={12} style={{ backgroundColor: '#5B6B82', borderRadius: 3 }} />
      {/* Brassard enroulé autour du bras. */}
      <Box x={22} y={52} w={82} h={70} style={styles.cuff}>
        <Box x={6} y={8} w={70} h={12} style={{ backgroundColor: '#3B5BB5', borderRadius: 4 }} />
        <Box x={6} y={46} w={70} h={4} style={{ backgroundColor: '#2D4A9E', borderRadius: 2 }} />
        <Box x={34} y={54} w={14} h={10} style={styles.arteryMark} />
      </Box>
      {/* Boîtier avec grand écran digital. */}
      <Box x={160} y={2} w={118} h={166} style={styles.monitor}>
        <Box x={8} y={10} w={98} h={108} style={styles.lcd}>
          {rows.map((row) => (
            <View key={row.label} style={styles.lcdRow}>
              <View style={[styles.codeBar, { backgroundColor: row.colour }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.lcdLabel, { color: row.colour }]}>{row.label}</Text>
                {row.label === s.pul ? null : <Text style={styles.unit}>{s.mmHg}</Text>}
              </View>
              <Digits value={row.value} size={25} />
            </View>
          ))}
        </Box>
        <Box x={43} y={126} w={30} h={30} style={styles.startButton} />
        <Box x={14} y={136} w={20} h={9} style={styles.smallButton} />
        <Box x={82} y={136} w={20} h={9} style={styles.smallButton} />
      </Box>
    </>
  );
}

function Oximeter() {
  const { t } = useLanguage();
  const s = t.shared.devices.screen;
  return (
    <>
      {/* Main : index tendu (ongle au bout), paume et doigts repliés par-dessus sa base. */}
      <Box x={0} y={80} w={240} h={46} style={[styles.skin, { borderTopRightRadius: 23, borderBottomRightRadius: 23 }]} />
      <Box x={214} y={84} w={20} h={14} style={styles.nail} />
      <Box x={-12} y={66} w={64} h={104} style={[styles.skin, { borderRadius: 22 }]} />
      <Box x={30} y={126} w={118} h={26} style={styles.skinRound} />
      <Box x={30} y={148} w={100} h={22} style={styles.skinRound} />
      {/* Pince : charnière, coque inférieure blanche, coque supérieure bleue avec écran LED. */}
      <Box x={64} y={66} w={14} h={58} style={{ backgroundColor: '#93A4BF', borderRadius: 7 }} />
      <Box x={72} y={112} w={138} h={26} style={styles.lowerShell} />
      <Box x={68} y={14} w={146} h={78} style={styles.upperShell}>
        <Box x={7} y={8} w={128} h={52} style={styles.led}>
          <View style={styles.ledRow}>
            <View>
              <Text style={[styles.ledLabel, { color: '#38BDF8' }]}>{s.spo2}</Text>
              <Text style={[styles.ledLabel, { color: '#38BDF8' }]}>{s.percent}</Text>
            </View>
            <Digits value="98" size={26} colour="#7DD3FC" />
            <View style={{ width: 6 }} />
            <View>
              <Text style={[styles.ledLabel, { color: '#4ADE80' }]}>{s.pr}</Text>
              <Text style={[styles.ledLabel, { color: '#4ADE80' }]}>{s.bpm}</Text>
            </View>
            <Digits value="72" size={20} colour="#86EFAC" />
          </View>
        </Box>
        <Box x={64} y={66} w={16} h={6} style={{ backgroundColor: '#BFDBFE', borderRadius: 3 }} />
      </Box>
    </>
  );
}

function Metabolic() {
  const { t } = useLanguage();
  const s = t.shared.devices.screen;
  const [weightColour, , waistColour] = READING_COLOURS.metabolic;
  const ticks = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <>
      {/* Pèse-personne digital. */}
      <Box x={0} y={52} w={100} h={112} style={styles.scale}>
        <Box x={16} y={10} w={64} h={28} style={[styles.led, styles.ledCentered]}>
          <Digits value="70.0" size={16} colour="#7DD3FC" />
          <Text style={[styles.ledLabel, { color: '#7DD3FC', marginLeft: 3 }]}>{s.kg}</Text>
        </Box>
        <Box x={14} y={48} w={30} h={50} style={styles.footPad} />
        <Box x={54} y={48} w={30} h={50} style={styles.footPad} />
        <Box x={0} y={0} w={6} h={112} style={{ backgroundColor: weightColour, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 }} />
      </Box>
      {/* Taille avec mètre ruban au niveau du nombril. */}
      <Box x={110} y={8} w={76} h={156} style={styles.torso}>
        <Box x={36} y={88} w={5} h={5} style={{ backgroundColor: SKIN_EDGE, borderRadius: 3 }} />
      </Box>
      <Box x={104} y={74} w={88} h={16} style={[styles.tape, { borderColor: waistColour }]}>
        {ticks.map((i) => (
          <View key={i} style={[styles.tick, { left: 6 + i * 10, height: i % 2 ? 5 : 8 }]} />
        ))}
      </Box>
      <Box x={170} y={86} w={14} h={30} style={[styles.tape, { borderColor: waistColour, borderRadius: 2 }]}>
        <Text style={styles.tapeText}>{s.cm}</Text>
      </Box>
      {/* Lecteur de glycémie : bandelette (goutte de sang au bout) insérée dans le boîtier. */}
      <Box x={230} y={10} w={16} h={34} style={styles.strip}>
        <Box x={0} y={0} w={14} h={9} style={{ backgroundColor: '#F59E0B', borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
      </Box>
      <Box x={232} y={0} w={11} h={11} style={{ backgroundColor: '#DC2626', borderRadius: 6, borderTopLeftRadius: 1 }} />
      <Box x={198} y={40} w={80} h={124} style={styles.meter}>
        <Box x={8} y={14} w={60} h={48} style={[styles.lcd, styles.ledCentered, { flexDirection: 'column' }]}>
          <Digits value="0.95" size={18} />
          <Text style={[styles.lcdLabel, { color: INK }]}>{s.gl}</Text>
        </Box>
        <Box x={24} y={78} w={28} h={28} style={styles.startButton} />
      </Box>
    </>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden' },
  canvas: { width: CANVAS.width, height: CANVAS.height, transformOrigin: 'top' },
  skin: { backgroundColor: SKIN, borderWidth: 1, borderColor: SKIN_EDGE },
  skinRound: { backgroundColor: SKIN, borderWidth: 1, borderColor: SKIN_EDGE, borderRadius: 22 },
  nail: { backgroundColor: '#F8DCD5', borderWidth: 1, borderColor: '#E5B5AC', borderRadius: 7 },
  tube: { borderTopWidth: 5, borderLeftWidth: 5, borderColor: '#5B6B82', borderTopLeftRadius: 30 },
  cuff: { backgroundColor: '#1E3A8A', borderRadius: 12, borderWidth: 1, borderColor: '#172B66' },
  arteryMark: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  monitor: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#C9D6E8',
    shadowColor: '#0F3D6E',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  lcd: { backgroundColor: LCD, borderRadius: 8, borderWidth: 2, borderColor: '#1C2B45', paddingVertical: 2 },
  lcdRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 6 },
  codeBar: { width: 5, alignSelf: 'stretch', marginVertical: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  lcdLabel: { fontSize: 12, fontWeight: '800', writingDirection: 'ltr' },
  unit: { fontSize: 8, color: '#55657E', writingDirection: 'ltr' },
  digits: { fontWeight: '800', fontVariant: ['tabular-nums'], writingDirection: 'ltr', includeFontPadding: false },
  startButton: { backgroundColor: '#246BFD', borderRadius: 15, borderWidth: 3, borderColor: '#BFD3FE' },
  smallButton: { backgroundColor: '#C9D6E8', borderRadius: 5 },
  lowerShell: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#C9D6E8', borderRadius: 10 },
  upperShell: { backgroundColor: '#1D4ED8', borderRadius: 18, borderWidth: 2, borderColor: '#1E40AF' },
  led: { backgroundColor: LED, borderRadius: 8, justifyContent: 'center' },
  ledRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  ledCentered: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ledLabel: { fontSize: 10, fontWeight: '800', writingDirection: 'ltr' },
  scale: { backgroundColor: '#F8FAFC', borderRadius: 18, borderWidth: 2, borderColor: '#C9D6E8', overflow: 'hidden' },
  footPad: { backgroundColor: '#E2E8F0', borderRadius: 14, borderWidth: 1, borderColor: '#CBD5E1' },
  torso: {
    backgroundColor: SKIN,
    borderWidth: 1,
    borderColor: SKIN_EDGE,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  tape: { backgroundColor: '#FACC15', borderWidth: 1, borderRadius: 3 },
  tick: { position: 'absolute', top: 0, width: 1.5, backgroundColor: '#1C2B45' },
  tapeText: { fontSize: 8, fontWeight: '800', color: '#1C2B45', textAlign: 'center', marginTop: 12, writingDirection: 'ltr' },
  meter: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 2, borderColor: '#C9D6E8' },
  strip: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#94A3B8', borderRadius: 2 },
});
