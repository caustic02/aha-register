import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CollectionsScreen } from '../screens/CollectionsScreen';
import { CollectionDetailScreen } from '../screens/CollectionDetailScreen';
import { CreateCollectionScreen } from '../screens/CreateCollectionScreen';
import { AddObjectsScreen } from '../screens/AddObjectsScreen';

export type CollectionStackParamList = {
  CollectionList: undefined;
  CollectionDetail: { collectionId: string };
  CreateCollection: undefined;
  AddObjects: { collectionId: string };
};

const Stack = createNativeStackNavigator<CollectionStackParamList>();

export function CollectionStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CollectionList" component={CollectionsScreen} />
      <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
      <Stack.Screen
        name="CreateCollection"
        component={CreateCollectionScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="AddObjects"
        component={AddObjectsScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
