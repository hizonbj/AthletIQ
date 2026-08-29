import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from '@/ui/AppState';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Today' }} />
          <Stack.Screen name="log" options={{ title: 'Log session' }} />
          <Stack.Screen name="patterns" options={{ title: 'Patterns' }} />
          <Stack.Screen
            name="paywall"
            options={{ title: 'AthletIQ Pro', presentation: 'modal' }}
          />
        </Stack>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
