import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';

import { HomeStack } from './HomeStack';
import type { HomeStackParamList } from './HomeStack';
import { CaptureStack } from './CaptureStack';
import type { CaptureStackParamList } from './CaptureStack';
import { CollectionStack } from './CollectionStack';
import type { CollectionStackParamList } from './CollectionStack';
import { SettingsScreen } from '../screens/SettingsScreen';
import { tabBar } from '../theme';
import {
  HomeTabIcon,
  CaptureTabIcon,
  CollectionTabIcon,
  SettingsTabIcon,
} from '../theme/icons';
import type { LucideIcon } from 'lucide-react-native';

// ── Param list ───────────────────────────────────────────────────────────────

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Capture: NavigatorScreenParams<CaptureStackParamList> | undefined;
  Collection: NavigatorScreenParams<CollectionStackParamList> | undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// ── Icon config ──────────────────────────────────────────────────────────────

const TAB_ICONS: Record<string, LucideIcon> = {
  Home: HomeTabIcon,
  Capture: CaptureTabIcon,
  Collection: CollectionTabIcon,
  Settings: SettingsTabIcon,
};

// ── Active indicator pill ────────────────────────────────────────────────────

function TabIcon({
  route,
  focused,
  color,
}: {
  route: string;
  focused: boolean;
  color: string;
}) {
  const Icon = TAB_ICONS[route];
  return (
    <View style={styles.iconContainer}>
      {focused && <View style={styles.indicator} />}
      <Icon
        size={tabBar.iconSize}
        color={color}
        strokeWidth={focused ? tabBar.activeStrokeWidth : tabBar.inactiveStrokeWidth}
      />
    </View>
  );
}

// ── Navigator ────────────────────────────────────────────────────────────────

export function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => (
          <TabIcon route={route.name} focused={focused} color={color} />
        ),
        tabBarActiveTintColor: tabBar.activeColor,
        tabBarInactiveTintColor: tabBar.inactiveColor,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.bar,
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ tabBarAccessibilityLabel: 'Home tab' }}
      />
      <Tab.Screen
        name="Capture"
        component={CaptureStack}
        options={{ tabBarAccessibilityLabel: 'Capture tab' }}
      />
      <Tab.Screen
        name="Collection"
        component={CollectionStack}
        options={{ tabBarAccessibilityLabel: 'Collection tab' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarAccessibilityLabel: 'Settings tab' }}
      />
    </Tab.Navigator>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bar: {
    height: tabBar.height,
    backgroundColor: tabBar.backgroundColor,
    borderTopColor: tabBar.borderColor,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: tabBar.labelSize,
    fontWeight: '500',
  },
  iconContainer: {
    width: tabBar.indicatorWidth,
    height: tabBar.indicatorHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tabBar.indicatorColor,
    borderRadius: tabBar.indicatorRadius,
  },
});
