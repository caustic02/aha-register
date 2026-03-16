import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';

import { HomeStack } from './HomeStack';
import type { HomeStackParamList } from './HomeStack';
import { CaptureStack } from './CaptureStack';
import type { CaptureStackParamList } from './CaptureStack';
import { CollectionStack } from './CollectionStack';
import type { CollectionStackParamList } from './CollectionStack';
import { SettingsScreen } from '../screens/SettingsScreen';

export type MainTabParamList = {
  Objects: NavigatorScreenParams<HomeStackParamList> | undefined;
  Capture: NavigatorScreenParams<CaptureStackParamList> | undefined;
  Collections: NavigatorScreenParams<CollectionStackParamList> | undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<string, string> = {
  Objects: '\u25CE',     // ◎
  Capture: '\u2295',     // ⊕
  Collections: '\u25C8', // ◈
  Settings: '\u2699',    // ⚙
};

export function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Objects"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarIcon: ({ color, size }) => (
          <Text
            style={{
              color,
              fontSize: route.name === 'Capture' ? size + 8 : size,
              lineHeight: route.name === 'Capture' ? size + 10 : size + 2,
            }}
          >
            {ICONS[route.name]}
          </Text>
        ),
        tabBarActiveTintColor: '#74B9FF',
        tabBarInactiveTintColor: '#636E72',
        tabBarStyle: {
          backgroundColor: '#0A0A14',
          borderTopColor: 'rgba(116,185,255,0.08)',
          borderTopWidth: 1,
        },
      })}
    >
      <Tab.Screen name="Objects" component={HomeStack} />
      <Tab.Screen name="Capture" component={CaptureStack} />
      <Tab.Screen name="Collections" component={CollectionStack} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
