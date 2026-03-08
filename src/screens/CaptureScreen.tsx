import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/MainTabs';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import {
  captureFromCamera,
  pickFromLibrary,
  type CaptureResult,
} from '../services/capture';
import { extractMetadata, type CaptureMetadata } from '../services/metadata';
import { createDraftObject } from '../services/draftObject';
import { computeSHA256 } from '../utils/hash';

type Phase = 'idle' | 'extracting' | 'preview' | 'saving' | 'done';

export function CaptureScreen() {
  const db = useDatabase();
  const { t } = useAppTranslation();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  const [phase, setPhase] = useState<Phase>('idle');
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [metadata, setMetadata] = useState<CaptureMetadata | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const processCapture = useCallback(
    async (result: CaptureResult) => {
      setCapture(result);
      setPhase('extracting');
      const meta = await extractMetadata(result.exif);
      setMetadata(meta);
      const fileHash = await computeSHA256(result.uri);
      setHash(fileHash);
      setPhase('preview');
    },
    [],
  );

  const handleCamera = useCallback(async () => {
    const result = await captureFromCamera();
    if (result) await processCapture(result);
  }, [processCapture]);

  const handleLibrary = useCallback(async () => {
    const results = await pickFromLibrary();
    if (results.length > 0) await processCapture(results[0]);
  }, [processCapture]);

  const handleSave = useCallback(async () => {
    if (!capture || !metadata) return;
    setPhase('saving');
    try {
      const objectId = await createDraftObject(db, {
        imageUri: capture.uri,
        fileName: capture.fileName,
        fileSize: capture.fileSize,
        mimeType: capture.mimeType,
        metadata,
      });
      setSavedId(objectId);
      setPhase('done');
    } catch (err) {
      setPhase('preview');
    }
  }, [capture, metadata, db]);

  const handleRetake = useCallback(() => {
    setCapture(null);
    setMetadata(null);
    setHash(null);
    setSavedId(null);
    setPhase('idle');
  }, []);

  const handleViewObjects = useCallback(() => {
    handleRetake();
    navigation.navigate('Objects');
  }, [navigation, handleRetake]);

  // --- Extracting / Saving spinners ---
  if (phase === 'extracting') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#74B9FF" />
        <Text style={styles.spinnerText}>{t('capture.securing')}</Text>
      </View>
    );
  }

  if (phase === 'saving') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#74B9FF" />
        <Text style={styles.spinnerText}>{t('capture.save_draft')}...</Text>
      </View>
    );
  }

  // --- Success ---
  if (phase === 'done') {
    return (
      <View style={styles.center}>
        <Text style={styles.checkmark}>{'\u2713'}</Text>
        <Text style={styles.doneTitle}>{t('common.success')}</Text>
        <Text style={styles.doneId}>ID: {savedId?.slice(0, 8)}...</Text>
        <Pressable style={styles.primaryBtn} onPress={handleViewObjects}>
          <Text style={styles.primaryBtnText}>{t('capture.view_objects')}</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={handleRetake}>
          <Text style={styles.secondaryBtnText}>{t('capture.capture_another')}</Text>
        </Pressable>
      </View>
    );
  }

  // --- Preview ---
  if (phase === 'preview' && capture && metadata) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <Image source={{ uri: capture.uri }} style={styles.preview} />

        <View style={styles.metaSection}>
          <Text style={styles.metaLabel}>{t('capture.coordinates')}</Text>
          <Text style={styles.metaValue}>
            {metadata.latitude != null
              ? `${metadata.latitude.toFixed(6)}, ${metadata.longitude?.toFixed(6)}`
              : t('capture.coordinates_unavailable')}
            {metadata.coordinateSource ? ` (${metadata.coordinateSource})` : ''}
          </Text>

          <Text style={styles.metaLabel}>{t('capture.timestamp')}</Text>
          <Text style={styles.metaValue}>{metadata.timestamp ?? '—'}</Text>

          <Text style={styles.metaLabel}>{t('capture.dimensions')}</Text>
          <Text style={styles.metaValue}>
            {capture.width} x {capture.height}
          </Text>

          {hash && (
            <>
              <Text style={styles.metaLabel}>{t('capture.sha256')}</Text>
              <Text style={styles.metaValue}>{hash.slice(0, 16)}...</Text>
            </>
          )}
        </View>

        <Pressable style={styles.primaryBtn} onPress={handleSave}>
          <Text style={styles.primaryBtnText}>{t('capture.save_draft')}</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={handleRetake}>
          <Text style={styles.secondaryBtnText}>{t('capture.retake')}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // --- Idle: two capture buttons ---
  return (
    <View style={styles.container}>
      <View style={styles.buttonsContainer}>
        <Pressable style={styles.cameraCard} onPress={handleCamera}>
          <Text style={styles.cardIcon}>{'\u2295'}</Text>
          <Text style={styles.cardTitle}>{t('capture.take_photo')}</Text>
        </Pressable>

        <Pressable style={styles.libraryCard} onPress={handleLibrary}>
          <Text style={styles.cardIcon}>{'\u25A3'}</Text>
          <Text style={styles.cardTitle}>
            {t('capture.choose_from_library')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080F',
  },
  center: {
    flex: 1,
    backgroundColor: '#08080F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  cameraCard: {
    backgroundColor: '#0984E3',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  libraryCard: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.3)',
    padding: 32,
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 40,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  preview: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#1A1A2E',
  },
  metaSection: {
    padding: 20,
  },
  metaLabel: {
    color: '#636E72',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 12,
  },
  metaValue: {
    color: '#FFFFFF',
    fontSize: 15,
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: '#0984E3',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.3)',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryBtnText: {
    color: '#74B9FF',
    fontSize: 16,
    fontWeight: '600',
  },
  spinnerText: {
    color: '#74B9FF',
    fontSize: 16,
    marginTop: 16,
  },
  checkmark: {
    color: '#00B894',
    fontSize: 64,
    marginBottom: 16,
  },
  doneTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  doneId: {
    color: '#636E72',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 32,
  },
});
