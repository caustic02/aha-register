import React, { useCallback } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { CaptureScreen } from '../screens/CaptureScreen';
import { AIProcessingScreen } from '../screens/AIProcessingScreen';
import { ReviewCardScreen } from '../screens/ReviewCardScreen';
import type { AIAnalysisResult } from '../services/ai-analysis';
import type { CaptureMetadata } from '../services/metadata';
import type { MainTabParamList } from './MainTabs';
import { useSettings } from '../hooks/useSettings';

// ── Param list ───────────────────────────────────────────────────────────────

export type CaptureStackParamList = {
  CaptureCamera: undefined;
  AIProcessing: {
    imageUri: string;
    imageBase64: string;
    mimeType: string;
    captureMetadata: CaptureMetadata;
    sha256Hash?: string;
  };
  ReviewCard: {
    imageUri: string;
    analysisResult: AIAnalysisResult;
    captureMetadata: CaptureMetadata;
    sha256Hash?: string;
  };
};

const Stack = createNativeStackNavigator<CaptureStackParamList>();

// ── Empty analysis result for "Skip AI" path ─────────────────────────────────

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

// ── Wrapper: AIProcessingScreen ──────────────────────────────────────────────

function AIProcessingWrapper({
  route,
  navigation,
}: NativeStackScreenProps<CaptureStackParamList, 'AIProcessing'>) {
  const { imageUri, imageBase64, mimeType, captureMetadata, sha256Hash } =
    route.params;
  const { collectionDomain } = useSettings();

  const handleComplete = useCallback(
    (result: AIAnalysisResult) => {
      navigation.replace('ReviewCard', {
        imageUri,
        analysisResult: result,
        captureMetadata,
        sha256Hash,
      });
    },
    [navigation, imageUri, captureMetadata, sha256Hash],
  );

  const handleSkip = useCallback(() => {
    navigation.replace('ReviewCard', {
      imageUri,
      analysisResult: EMPTY_ANALYSIS,
      captureMetadata,
      sha256Hash,
    });
  }, [navigation, imageUri, captureMetadata, sha256Hash]);

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

// ── Wrapper: ReviewCardScreen ────────────────────────────────────────────────

function ReviewCardWrapper({
  route,
  navigation,
}: NativeStackScreenProps<CaptureStackParamList, 'ReviewCard'>) {
  const { imageUri, analysisResult, captureMetadata, sha256Hash } =
    route.params;

  const tabNav = useNavigation<NavigationProp<MainTabParamList>>();

  const resetToCapture = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'CaptureCamera' }],
      }),
    );
  }, [navigation]);

  const handleSave = useCallback(
    (objectId: string) => {
      // Reset the capture stack so back-swipe doesn't return here
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'CaptureCamera' }],
        }),
      );
      // Navigate to the Home tab → ObjectDetail to view the saved object
      tabNav.navigate('Home', {
        screen: 'ObjectDetail',
        params: { objectId },
      });
    },
    [navigation, tabNav],
  );

  return (
    <ReviewCardScreen
      imageUri={imageUri}
      analysisResult={analysisResult}
      captureMetadata={captureMetadata}
      sha256Hash={sha256Hash}
      onSave={handleSave}
      onDiscard={resetToCapture}
    />
  );
}

// ── Stack navigator ──────────────────────────────────────────────────────────

export function CaptureStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CaptureCamera" component={CaptureScreen} />
      <Stack.Screen name="AIProcessing" component={AIProcessingWrapper} />
      <Stack.Screen name="ReviewCard" component={ReviewCardWrapper} />
    </Stack.Navigator>
  );
}
