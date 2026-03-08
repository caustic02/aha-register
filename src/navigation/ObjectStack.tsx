import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ObjectListScreen } from '../screens/ObjectListScreen';
import { ObjectDetailScreen } from '../screens/ObjectDetailScreen';

export type ObjectStackParamList = {
  ObjectList: undefined;
  ObjectDetail: { objectId: string };
};

const Stack = createNativeStackNavigator<ObjectStackParamList>();

export function ObjectStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ObjectList" component={ObjectListScreen} />
      <Stack.Screen name="ObjectDetail" component={ObjectDetailScreen} />
    </Stack.Navigator>
  );
}
