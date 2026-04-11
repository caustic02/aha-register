/**
 * aha! Register — Root Stack Navigator
 *
 * Single flat stack. No tabs. HomeScreen is the root.
 * All screens are full-screen pushes.
 */
import React, { useCallback } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CommonActions, useNavigation } from '@react-navigation/native';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { NavigationProp } from '@react-navigation/native';

// ── Screen imports ──────────────────────────────────────────────────────────

import { HomeScreen } from '../screens/HomeScreen';
import { ObjectListScreen } from '../screens/ObjectListScreen';
import { ObjectDetailScreen } from '../screens/ObjectDetailScreen';
import { IsolationCompareScreen } from '../screens/IsolationCompareScreen';
import { DocumentReviewScreen } from '../screens/DocumentReviewScreen';
import { VideoRecordScreen } from '../screens/VideoRecordScreen';
import { ViewChecklistScreen } from '../screens/ViewChecklistScreen';
import { QuickIDScreen } from '../screens/QuickIDScreen';
import { CaptureScreen } from '../screens/CaptureScreen';
import { AIProcessingScreen } from '../screens/AIProcessingScreen';
import { ReviewCardScreen } from '../screens/ReviewCardScreen';
import { AIReviewScreen } from '../screens/AIReviewScreen';
import { CollectionsScreen } from '../screens/CollectionsScreen';
import { CollectionDetailScreen } from '../screens/CollectionDetailScreen';
import { CreateCollectionScreen } from '../screens/CreateCollectionScreen';
import { AddObjectsScreen } from '../screens/AddObjectsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { QRCodeScreen } from '../screens/QRCodeScreen';
import { FloorMapScreen } from '../screens/FloorMapScreen';
import { Scan3DScreen } from '../screens/Scan3DScreen';
import { Import3DScreen } from '../screens/Import3DScreen';
import { ChecklistOverviewScreen } from '../screens/ChecklistOverviewScreen';
import { CaptureReviewScreen } from '../screens/CaptureReviewScreen';
import { ScaleReferenceScreen } from '../screens/ScaleReferenceScreen';

// ── Service imports ─────────────────────────────────────────────────────────

import type { AIAnalysisResult } from '../services/ai-analysis';
import type { CaptureMetadata } from '../services/metadata';
import type { RegisterViewType } from '../db/types';
import type { ArchivalData, ImageTierData } from '../utils/image-processing';
import { updateReviewStatus } from '../services/objectService';
import { useDatabase } from '../contexts/DatabaseContext';
import { useSettings } from '../hooks/useSettings';

// ── Param list ──────────────────────────────────────────────────────────────

export type RootStackParamList = {
  // Dashboard
  Home: undefined;
  // Objects
  ObjectList: { filterReviewStatus?: string } | undefined;
  ObjectDetail: { objectId: string };
  IsolationCompare: { objectId: string; mediaId: string };
  DocumentReview: { mediaId: string };
  VideoRecord: { objectId: string };
  ViewChecklist: { objectId: string };
  // Capture
  QuickID: undefined;
  CaptureCamera: { viewType?: RegisterViewType; objectId?: string } | undefined;
  CaptureReview: {
    imageUri: string;
    mimeType: string;
    metadata: CaptureMetadata;
    sha256Hash: string;
    archival?: ArchivalData;
    tiers?: ImageTierData;
  };
  AIProcessing: {
    imageUri: string;
    imageBase64: string;
    mimeType: string;
    captureMetadata: CaptureMetadata;
    sha256Hash?: string;
    existingObjectId?: string;
  };
  ReviewCard: {
    imageUri: string;
    analysisResult: AIAnalysisResult;
    captureMetadata: CaptureMetadata;
    sha256Hash?: string;
    existingObjectId?: string;
  };
  AIReview: {
    objectId: string;
    photoUri: string;
  };
  // Collections
  CollectionList: undefined;
  CollectionDetail: { collectionId: string };
  CreateCollection: undefined;
  AddObjects: { collectionId: string };
  // Settings
  Settings: undefined;
  // Feature screens
  QRCode: { objectId: string };
  FloorMap: { objectId?: string; mapId?: string } | undefined;
  Scan3D: undefined;
  Import3D: undefined;
  ChecklistOverview: undefined;
  ScaleReference: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ── Empty analysis result for "Skip AI" path ────────────────────────────────

const EMPTY_FIELD = { value: null, confidence: 0 };

const EMPTY_ANALYSIS: AIAnalysisResult = {
  title: EMPTY_FIELD,
  object_type: EMPTY_FIELD,
  date_created: EMPTY_FIELD,
  medium: EMPTY_FIELD,
  dimensions_description: EMPTY_FIELD,
  description: EMPTY_FIELD,
  style_period: EMPTY_FIELD,
  culture_origin: EMPTY_FIELD,
  condition_summary: EMPTY_FIELD,
  suggested_artists: { value: [] },
  keywords: { value: null, confidence: 0 },
};

// ── Wrapper: AIProcessingScreen ─────────────────────────────────────────────

function AIProcessingWrapper({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'AIProcessing'>) {
  const { imageUri, imageBase64, mimeType, captureMetadata, sha256Hash, existingObjectId } =
    route.params;
  const { collectionDomain } = useSettings();

  const handleComplete = useCallback(
    (result: AIAnalysisResult) => {
      navigation.replace('ReviewCard', {
        imageUri,
        analysisResult: result,
        captureMetadata,
        sha256Hash,
        existingObjectId,
      });
    },
    [navigation, imageUri, captureMetadata, sha256Hash, existingObjectId],
  );

  const handleSkip = useCallback(() => {
    navigation.replace('ReviewCard', {
      imageUri,
      analysisResult: EMPTY_ANALYSIS,
      captureMetadata,
      sha256Hash,
      existingObjectId,
    });
  }, [navigation, imageUri, captureMetadata, sha256Hash, existingObjectId]);

  return (
    <AIProcessingScreen
      imageUri={imageUri}
      imageBase64={imageBase64}
      mimeType={mimeType}
      captureMetadata={captureMetadata}
      domain={collectionDomain}
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  );
}

// ── Wrapper: ReviewCardScreen ───────────────────────────────────────────────

function ReviewCardWrapper({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'ReviewCard'>) {
  const { imageUri, analysisResult, captureMetadata, sha256Hash, existingObjectId } =
    route.params;
  const db = useDatabase();

  const handleSave = useCallback(
    (objectId: string) => {
      // Navigate to ViewChecklist, replacing the capture screens
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: 'Home' },
            { name: 'ViewChecklist', params: { objectId } },
          ],
        }),
      );
    },
    [navigation],
  );

  const handleDiscard = useCallback(() => {
    if (existingObjectId) {
      updateReviewStatus(db, existingObjectId, 'needs_review').catch(() => {});
    }
    // Go back to Home
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      }),
    );
  }, [existingObjectId, db, navigation]);

  return (
    <ReviewCardScreen
      imageUri={imageUri}
      analysisResult={analysisResult}
      captureMetadata={captureMetadata}
      sha256Hash={sha256Hash}
      existingObjectId={existingObjectId}
      onSave={handleSave}
      onDiscard={handleDiscard}
    />
  );
}

// ── Wrapper: AIReviewScreen ─────────────────────────────────────────────────

function AIReviewWrapper({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'AIReview'>) {
  const { objectId, photoUri } = route.params;

  const handleSave = useCallback(
    (savedId: string) => {
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: 'Home' },
            { name: 'ObjectDetail', params: { objectId: savedId } },
          ],
        }),
      );
    },
    [navigation],
  );

  const handleBack = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      }),
    );
  }, [navigation]);

  return (
    <AIReviewScreen
      objectId={objectId}
      photoUri={photoUri}
      onSave={handleSave}
      onBack={handleBack}
    />
  );
}

// ── Root Stack Navigator ────────────────────────────────────────────────────

export function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Dashboard */}
      <Stack.Screen name="Home" component={HomeScreen} />

      {/* Objects */}
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

      {/* Capture */}
      <Stack.Screen name="QuickID" component={QuickIDScreen} />
      <Stack.Screen name="CaptureCamera" component={CaptureScreen} />
      <Stack.Screen name="CaptureReview" component={CaptureReviewScreen} />
      <Stack.Screen name="AIProcessing" component={AIProcessingWrapper} />
      <Stack.Screen name="ReviewCard" component={ReviewCardWrapper} />
      <Stack.Screen name="AIReview" component={AIReviewWrapper} />

      {/* Collections */}
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

      {/* Settings */}
      <Stack.Screen name="Settings" component={SettingsScreen} />

      {/* Feature screens */}
      <Stack.Screen name="QRCode" component={QRCodeScreen} />
      <Stack.Screen name="FloorMap" component={FloorMapScreen} />
      <Stack.Screen name="Scan3D" component={Scan3DScreen} />
      <Stack.Screen name="Import3D" component={Import3DScreen} />
      <Stack.Screen name="ChecklistOverview" component={ChecklistOverviewScreen} />
      <Stack.Screen name="ScaleReference" component={ScaleReferenceScreen} />
    </Stack.Navigator>
  );
}
