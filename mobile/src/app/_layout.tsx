import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '../auth/SessionContext';
import { aidantColours } from '../ui/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: aidantColours.card },
            headerTintColor: aidantColours.text,
            headerTitleStyle: { fontWeight: '700' },
            headerBackTitle: 'Retour',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="senior/pair" options={{ headerShown: false }} />
          <Stack.Screen name="senior/index" options={{ headerShown: false }} />
          <Stack.Screen name="senior/exercise" options={{ headerShown: false }} />
          <Stack.Screen name="aidant/login" options={{ title: 'Connexion aidant' }} />
          <Stack.Screen name="aidant/index" options={{ title: 'Mes proches' }} />
          <Stack.Screen name="aidant/new-senior" options={{ title: 'Nouveau profil senior' }} />
          <Stack.Screen name="aidant/[seniorId]/index" options={{ title: 'Tableau de bord' }} />
          <Stack.Screen name="aidant/[seniorId]/medications" options={{ title: 'Traitements' }} />
          <Stack.Screen name="aidant/[seniorId]/consents" options={{ title: 'Consentements' }} />
          <Stack.Screen name="aidant/[seniorId]/voice" options={{ title: 'Voix des rappels' }} />
          <Stack.Screen name="aidant/[seniorId]/report" options={{ title: 'Rapport hebdomadaire' }} />
          <Stack.Screen name="aidant/[seniorId]/pairing" options={{ title: 'Appairer le téléphone' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
