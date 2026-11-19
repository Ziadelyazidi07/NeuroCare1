import { useEffect, useRef } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider, useSession } from '../auth/SessionContext';
import { onReminderOpened } from '../senior/reminders';
import { HomeButton } from '../ui/HomeButton';
import { aidantColours } from '../ui/theme';

/** En-tête des écrans aidant : titre et bouton « ← Accueil Modules » à droite. */
const aidant = (title: string) => ({ title, headerRight: () => <HomeButton variant="header" /> });

/**
 * Un appui sur une alarme ramène le téléphone senior sur son écran de rappel, quel que soit le module
 * ouvert ; l'écran senior lit ensuite l'alarme et joue la voix (Module 1 inchangé).
 */
function ReminderTapRouter() {
  const { session } = useSession();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const isSenior = session?.kind === 'senior';

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!isSenior) return undefined;
    return onReminderOpened(() => {
      if (pathnameRef.current !== '/senior') router.navigate('/senior');
    });
  }, [isSenior]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="auto" />
        <ReminderTapRouter />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: aidantColours.card },
            headerTintColor: aidantColours.text,
            headerTitleStyle: { fontWeight: '700' },
            headerBackTitle: 'Retour',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="observance-role" options={{ headerShown: false }} />
          <Stack.Screen name="modules/saturation" options={{ headerShown: false }} />
          <Stack.Screen name="modules/mental" options={{ headerShown: false }} />
          <Stack.Screen name="modules/metabolic" options={{ headerShown: false }} />
          <Stack.Screen name="modules/cardio" options={{ headerShown: false }} />
          <Stack.Screen name="senior/pair" options={{ headerShown: false }} />
          <Stack.Screen name="senior/index" options={{ headerShown: false }} />
          <Stack.Screen name="senior/exercise" options={{ headerShown: false }} />
          <Stack.Screen name="aidant/login" options={aidant('Connexion aidant')} />
          <Stack.Screen name="aidant/index" options={aidant('Mes proches')} />
          <Stack.Screen name="aidant/new-senior" options={aidant('Nouveau profil senior')} />
          <Stack.Screen name="aidant/[seniorId]/index" options={aidant('Tableau de bord')} />
          <Stack.Screen name="aidant/[seniorId]/medications" options={aidant('Traitements')} />
          <Stack.Screen name="aidant/[seniorId]/consents" options={aidant('Consentements')} />
          <Stack.Screen name="aidant/[seniorId]/voice" options={aidant('Voix des rappels')} />
          <Stack.Screen name="aidant/[seniorId]/report" options={aidant('Rapport hebdomadaire')} />
          <Stack.Screen name="aidant/[seniorId]/pairing" options={aidant('Appairer le téléphone')} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
