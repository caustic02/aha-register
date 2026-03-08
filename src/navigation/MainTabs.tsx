import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { ObjectListScreen } from '../screens/ObjectListScreen';
import { CaptureScreen } from '../screens/CaptureScreen';
import { CollectionsScreen } from '../screens/CollectionsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = {
  Objects: '\u25CE',     // ◎
  Capture: '\u2295',     // ⊕
  Collections: '\u25C8', // ◈
  Settings: '\u2699',    // ⚙
};

export function MainTabs() {
  return (
    <Tab.Navigator
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
      <Tab.Screen name="Objects" component={ObjectListScreen} />
      <Tab.Screen name="Capture" component={CaptureScreen} />
      <Tab.Screen name="Collections" component={CollectionsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
