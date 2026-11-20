/**
 * Bandeau d'aide à la mesure affiché en haut d'un module : illustration de l'appareil requis, lecture de son
 * écran (repères colorés comme sur le dessin), alternative en pharmacie et conditions de mesure (ou conseils
 * de passation pour les questionnaires). Tout le texte vient du dictionnaire du module.
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useLanguage, type Dictionary } from '../i18n';
import { Card, Row, Text, colours as c, radius } from '../theme';
import { DeviceIllustration, READING_COLOURS, type DeviceKind } from './DeviceIllustration';
import type { ModuleDefinition } from './types';

export interface MeasurementGuide {
  title: string;
  /** Appareil à utiliser (absent pour les questionnaires). */
  device?: string;
  /** Lecture de l'écran : une ligne par repère, dans l'ordre de `READING_COLOURS`. */
  readings?: string[];
  /** Alternative sans appareil : la pharmacie. */
  pharmacy?: string;
  conditions: string[];
}

export function MeasurementGuideCard({
  module,
  guide: select,
  device,
}: {
  module: ModuleDefinition;
  guide: (t: Dictionary) => MeasurementGuide;
  device?: DeviceKind;
}) {
  const { t } = useLanguage();
  const guide = select(t);
  const g = t.shared.guide;
  const colours = device ? READING_COLOURS[device] : [];

  return (
    <Card title={guide.title} icon={device ? 'information-circle' : 'bulb'}>
      {device ? (
        <View style={[styles.illustration, { backgroundColor: module.tint }]}>
          <DeviceIllustration kind={device} />
        </View>
      ) : null}

      {guide.device ? (
        <View style={styles.section}>
          <Heading icon="hardware-chip" colour={module.colour} label={g.device} />
          <Text style={styles.text}>{guide.device}</Text>
          {guide.readings?.map((reading, index) => (
            <Row key={reading} style={styles.reading}>
              <View style={[styles.swatch, { backgroundColor: colours[index] ?? module.colour }]} />
              <Text style={[styles.text, styles.readingText]}>{reading}</Text>
            </Row>
          ))}
        </View>
      ) : null}

      {guide.pharmacy ? (
        <Row style={styles.pharmacy}>
          <Ionicons name="medkit" size={24} color={c.success} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.pharmacyTitle}>{g.pharmacy}</Text>
            <Text style={styles.text}>{guide.pharmacy}</Text>
          </View>
        </Row>
      ) : null}

      <View style={styles.section}>
        <Heading icon={device ? 'time' : 'happy'} colour={module.colour} label={device ? g.conditions : g.tips} />
        {guide.conditions.map((condition) => (
          <Row key={condition} style={styles.condition}>
            <Ionicons name="checkmark-circle" size={22} color={module.colour} />
            <Text style={[styles.text, styles.readingText]}>{condition}</Text>
          </Row>
        ))}
      </View>
    </Card>
  );
}

function Heading({ icon, colour, label }: { icon: 'hardware-chip' | 'time' | 'happy'; colour: string; label: string }) {
  return (
    <Row style={styles.heading}>
      <Ionicons name={icon} size={20} color={colour} />
      <Text style={styles.headingText}>{label}</Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  illustration: { borderRadius: radius.card, paddingVertical: 12, paddingHorizontal: 8 },
  section: { gap: 8 },
  heading: { gap: 8, alignItems: 'center' },
  headingText: { fontSize: 18, fontWeight: '800', color: c.title },
  text: { fontSize: 16, lineHeight: 23, color: c.text },
  reading: { gap: 10, alignItems: 'center' },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  readingText: { flex: 1 },
  condition: { gap: 8, alignItems: 'flex-start' },
  pharmacy: { gap: 10, alignItems: 'flex-start', backgroundColor: c.successSoft, borderRadius: radius.control, padding: 12 },
  pharmacyTitle: { fontSize: 17, fontWeight: '800', color: c.success },
});
