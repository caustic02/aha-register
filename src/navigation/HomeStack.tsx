import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { ObjectListScreen } from '../screens/ObjectListScreen';
import { ObjectDetailScreen } from '../screens/ObjectDetailScreen';

export type HomeStackParamList = {
  Home: undefined;
  ObjectList: { filterReviewStatus?: string } | undefined;
  ObjectDetail: { objectId: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="ObjectList" component={ObjectListScreen} />
      <Stack.Screen name="ObjectDetail" component={ObjectDetailScreen} />
    </Stack.Navigator>
  );
}
