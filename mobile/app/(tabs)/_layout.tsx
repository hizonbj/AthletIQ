/**
 * Tab navigation.
 *
 * Today, history and the squad are peers, not places you reach by pushing
 * through Today. Pushing was the old structure and it buried the paid screens
 * two taps deep, which is the wrong place for the thing people pay for.
 */
import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useApp } from '@/ui/AppState';
import { useFirstRunRedirect } from '@/ui/FirstRunGate';
import { hasFeature } from '@/subscription/entitlements';
import { colors, type } from '@/ui/theme';

function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;
}

export default function TabsLayout() {
  const { tier } = useApp();
  useFirstRunRedirect();
  const showRoster = hasFeature(tier, 'roster');

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { ...type.heading },
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 88,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon glyph="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="patterns"
        options={{
          title: 'Patterns',
          tabBarIcon: ({ color }) => <TabIcon glyph="◪" color={color} />,
        }}
      />
      <Tabs.Screen
        name="roster"
        options={{
          title: 'Squad',
          // Hidden rather than shown-and-locked: an entry point that always
          // rejects you is worse than no entry point.
          href: showRoster ? undefined : null,
          tabBarIcon: ({ color }) => <TabIcon glyph="◈" color={color} />,
        }}
      />
    </Tabs>
  );
}
