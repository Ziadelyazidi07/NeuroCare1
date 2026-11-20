import { useEffect, useRef } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider, useSession } from '../auth/SessionContext';
import { LanguageProvider, useLanguage } from '../i18n';
import { onReminderOpened } from '../senior/reminders';
import { colours } from '../theme';
import { HomeButton } from '../ui/HomeButton';

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

/** Pile de navigation : titres dans la langue choisie, bouton « Accueil Modules » dans l'en-tête des écrans aidant. */
function AppStack() {
  const { t } = useLanguage();
  const aidant = (title: string) => ({ title, headerRight: () => <HomeButton variant="header" /> });
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colours.card },
        headerTintColor: colours.title,
        headerTitleStyle: { fontWeight: '800', fontSize: 20 },
        headerShadowVisible: false,
        headerBackTitle: t.common.back,
        contentStyle: { backgroundColor: colours.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="observance-role" options={{ headerShown: false }} />
      <Stack.Screen name="modules/saturation" options={{ headerShown: false }} />
      <Stack.Screen name="modules/mental" options={{ headerShown: false }} />
      <Stack.Screen name="modules/metabolic" options={{ headerShown: false }} />
      <Stack.Screen name="modules/cardio" options={{ headerShown: false }} />
      <Stack.Screen name="modules/alzheimer" options={{ headerShown: false }} />
      <Stack.Screen name="senior/pair" options={{ headerShown: false }} />
      <Stack.Screen name="senior/index" options={{ headerShown: false }} />
      <Stack.Screen name="senior/exercise" options={{ headerShown: false }} />
      <Stack.Screen name="aidant/login" options={aidant(t.nav.aidantLogin)} />
      <Stack.Screen name="aidant/index" options={aidant(t.nav.aidantHome)} />
      <Stack.Screen name="aidant/new-senior" options={aidant(t.nav.newSenior)} />
      <Stack.Screen name="aidant/[seniorId]/index" options={aidant(t.nav.dashboard)} />
      <Stack.Screen name="aidant/[seniorId]/medications" options={aidant(t.nav.medications)} />
      <Stack.Screen name="aidant/[seniorId]/consents" options={aidant(t.nav.consents)} />
      <Stack.Screen name="aidant/[seniorId]/voice" options={aidant(t.nav.voice)} />
      <Stack.Screen name="aidant/[seniorId]/report" options={aidant(t.nav.report)} />
      <Stack.Screen name="aidant/[seniorId]/pairing" options={aidant(t.nav.pairing)} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <ReminderTapRouter />
          <AppStack />
        </SessionProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
