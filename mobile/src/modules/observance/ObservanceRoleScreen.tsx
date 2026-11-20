/**
 * Entrée du module « Rappels & Suivi » : choix de l'espace (senior ou aidant). Un téléphone déjà
 * appairé ou un aidant déjà connecté va directement dans son espace.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../../auth/SessionContext';
import { useLanguage } from '../../i18n';
import { Loading, ModuleHeader, Row, Text, colours as c, radius, shadow, type IconName } from '../../theme';
import { DemoFallback } from '../../ui/DemoAccess';
import { HomeButton } from '../../ui/HomeButton';
import { observanceModule } from './module';

export default function ObservanceRoleScreen() {
  const { session, loading } = useSession();
  const { t } = useLanguage();

  if (loading) return <Loading />;
  if (session?.kind === 'senior') return <Redirect href="/senior" />;
  if (session?.kind === 'aidant') return <Redirect href="/aidant" />;

  return (
    <SafeAreaView style={styles.container}>
      <HomeButton />
      <View style={styles.body}>
        <ModuleHeader
          title={t.home.modules.observance.title}
          subtitle={t.role.subtitle}
          icon={observanceModule.icon}
          colour={observanceModule.colour}
          tint={observanceModule.tint}
        />
        <Choice icon="person" colour="#246BFD" tint="#EBF2FF" title={t.role.senior} hint={t.role.seniorHint} onPress={() => router.push('/senior/pair')} />
        <Choice icon="people" colour="#10B981" tint="#D1FAE5" title={t.role.aidant} hint={t.role.aidantHint} onPress={() => router.push('/aidant/login')} />
        <DemoFallback />
      </View>
    </SafeAreaView>
  );
}

function Choice({ icon, colour, tint, title, hint, onPress }: { icon: IconName; colour: string; tint: string; title: string; hint: string; onPress: () => void }) {
  const { isRTL } = useLanguage();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${hint}`} onPress={onPress} style={({ pressed }) => [styles.choice, pressed && { opacity: 0.75 }]}>
      <Row style={{ gap: 16 }}>
        <View style={[styles.icon, { backgroundColor: tint }]}>
          <Ionicons name={icon} size={34} color={colour} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.choiceTitle}>{title}</Text>
          <Text style={styles.choiceText}>{hint}</Text>
        </View>
        <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={26} color={c.muted} />
      </Row>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 16, gap: 12 },
  body: { flex: 1, gap: 18, justifyContent: 'center' },
  choice: { minHeight: 128, borderRadius: radius.card, padding: 20, justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, ...shadow },
  icon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  choiceTitle: { fontSize: 26, fontWeight: '800', color: c.title },
  choiceText: { fontSize: 18, lineHeight: 25, color: c.muted },
});
