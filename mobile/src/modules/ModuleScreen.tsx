/**
 * Cadre commun des modules de pré-dépistage : retour à l'accueil, en-tête du module (badge pastel), champ
 * facultatif du nom du patient, contenu, puis mention de non-diagnostic.
 */
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLanguage } from '../i18n';
import { ModuleHeader, Notice, styles as ui } from '../theme';
import { HomeButton } from '../ui/HomeButton';
import { PatientNameField, displayName, usePatientName } from './PatientName';
import type { ModuleDefinition } from './types';

export function ModuleScreen({ module, children }: { module: ModuleDefinition; children: (patient: string) => ReactNode }) {
  const { t } = useLanguage();
  const [name, setName] = usePatientName();
  const text = t.home.modules[module.id];
  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <HomeButton />
        <ModuleHeader title={text.title} subtitle={text.subtitle} icon={module.icon} colour={module.colour} tint={module.tint} />
        <PatientNameField value={name} onChange={setName} />
        {children(displayName(name, t))}
        <Notice>{t.shared.notADiagnosis}</Notice>
      </ScrollView>
    </SafeAreaView>
  );
}
