import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { ObjectListScreen } from '../screens/ObjectListScreen';
import { ObjectDetailScreen } from '../screens/ObjectDetailScreen';
import { IsolationCompareScreen } from '../screens/IsolationCompareScreen';
import { DocumentReviewScreen } from '../screens/DocumentReviewScreen';
import { VideoRecordScreen } from '../screens/VideoRecordScreen';
import { ViewChecklistScreen } from '../screens/ViewChecklistScreen';

export type HomeStackParamList = {
  Home: undefined;
  ObjectList: { filterReviewStatus?: string; mode?: 'ai-analysis' | 'qr-assign' } | undefined;
  ObjectDetail: { objectId: string; autoAction?: 'ai-analysis' };
  IsolationCompare: { objectId: string; mediaId: string };
  DocumentReview: { mediaId: string };
  VideoRecord: { objectId: string };
  ViewChecklist: { objectId: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="ObjectList" component={ObjectListScreen} />
      <Stack.Screen name="ObjectDetail" component={ObjectDetailScreen} />
      <Stack.Screen
        name="IsolationCompare"
        component={IsolationCompareScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <Stack.Screen name="DocumentReview" component={DocumentReviewScreen} />
      <Stack.Screen
        name="VideoRecord"
        component={VideoRecordScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <Stack.Screen name="ViewChecklist" component={ViewChecklistScreen} />
    </Stack.Navigator>
  );
}
