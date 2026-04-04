import React, { useCallback, useRef, useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { useDatabase } from '../contexts/DatabaseContext';
import { BackIcon } from '../theme/icons';
import { Share2, Printer } from 'lucide-react-native';
import { radii, spacing, touch, typography } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import type { RootStackParamList } from '../navigation/RootStack';

type Props = NativeStackScreenProps<RootStackParamList, 'QRCode'>;

const QR_BASE_URL = 'https://register.arthausauction.com/objects';

export function QRCodeScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { objectId } = route.params;
  const db = useDatabase();
  const [title, setTitle] = useState<string>('');
  const [inventoryNumber, setInventoryNumber] = useState<string | null>(null);
  const qrRef = useRef<QRCode>(null);

  const qrValue = `${QR_BASE_URL}/${objectId}`;

  useFocusEffect(
    useCallback(() => {
      db.getFirstAsync<{ title: string; inventory_number: string | null }>(
        'SELECT title, inventory_number FROM objects WHERE id = ?',
        [objectId],
      ).then((row) => {
        if (row) {
          setTitle(row.title);
          setInventoryNumber(row.inventory_number);
        }
      });
    }, [db, objectId]),
  );

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `${title}\n${qrValue}`,
        url: qrValue,
      });
    } catch {
      // User cancelled or share failed
    }
  }, [title, qrValue]);

  const handlePrint = useCallback(() => {
    Alert.alert('Print', 'Printing coming soon');
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          hitSlop={touch.hitSlop}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <BackIcon size={24} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>QR Code</Text>
        <View style={{ width: touch.minTarget }} />
      </View>

      <View style={s.content}>
        <View style={s.card}>
          <View style={s.qrWrap}>
            <QRCode
              value={qrValue}
              size={200}
              color={colors.text}
              backgroundColor={colors.white}
              ref={qrRef}
            />
          </View>

          <Text style={s.objectTitle} numberOfLines={2}>
            {title || 'Untitled'}
          </Text>
          {inventoryNumber && (
            <Text style={s.inventoryNum}>#{inventoryNumber}</Text>
          )}
          <Text style={s.url} numberOfLines={1}>
            {qrValue}
          </Text>

          <View style={s.actions}>
            <Pressable
              style={s.actionBtn}
              onPress={handleShare}
              accessibilityLabel="Share"
              accessibilityRole="button"
            >
              <Share2 size={18} color={colors.heroGreen} />
              <Text style={s.actionText}>Share</Text>
            </Pressable>
            <View style={s.divider} />
            <Pressable
              style={s.actionBtn}
              onPress={handlePrint}
              accessibilityLabel="Print"
              accessibilityRole="button"
            >
              <Printer size={18} color={colors.heroGreen} />
              <Text style={s.actionText}>Print</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: touch.minTarget,
    height: touch.minTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: typography.weight.semibold,
    color: c.text,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: c.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  qrWrap: {
    padding: spacing.lg,
    backgroundColor: c.white,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  objectTitle: {
    fontSize: 16,
    fontWeight: typography.weight.semibold,
    color: c.text,
    textAlign: 'center',
  },
  inventoryNum: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 4,
  },
  url: {
    fontSize: 11,
    color: c.textTertiary,
    marginTop: spacing.sm,
    fontFamily: 'monospace',
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: touch.minTarget,
  },
  actionText: {
    fontSize: 13,
    fontWeight: typography.weight.semibold,
    color: c.heroGreen,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
  },
}); }
