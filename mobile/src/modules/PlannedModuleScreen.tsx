/** Écran commun des modules en préparation : présentation, fonctions prévues et rappel éthique. */
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeButton } from '../ui/HomeButton';
import { Card, Notice, styles as ui } from '../ui/components';
import { aidantColours as c } from '../ui/theme';
import type { PlannedModule } from './types';

export function PlannedModuleScreen({ module }: { module: PlannedModule }) {
  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        <HomeButton />

        <View style={styles.hero}>
          <View style={[styles.icon, { backgroundColor: module.colour }]}>
            <Ionicons name={module.icon} size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {module.title}
          </Text>
          <Text style={styles.subtitle}>{module.subtitle}</Text>
        </View>

        <Card>
          <Text style={ui.text}>{module.description}</Text>
        </Card>

        <Card title="Prévu dans ce module">
          {module.planned.map((item) => (
            <View key={item} style={styles.item}>
              <Ionicons name="checkmark-circle-outline" size={22} color={module.colour} />
              <Text style={[ui.text, styles.itemText]}>{item}</Text>
            </View>
          ))}
        </Card>

        <View style={[styles.status, { borderColor: module.colour }]} accessibilityRole="text">
          <Ionicons name="construct-outline" size={22} color={module.colour} />
          <Text style={[ui.text, styles.itemText]}>Module en préparation : il sera disponible dans une prochaine version.</Text>
        </View>

        <Notice>
          NeuroCare est un outil de pré-dépistage et d’aide à la décision médicale. Il ne pose jamais de diagnostic :
          seul un professionnel de santé interprète les résultats.
        </Notice>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  icon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: c.text, textAlign: 'center' },
  subtitle: { fontSize: 16, color: c.muted, textAlign: 'center' },
  item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  itemText: { flex: 1 },
  status: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1.5, borderRadius: 12, padding: 12, backgroundColor: c.card },
});
