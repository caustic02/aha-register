import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Box } from 'lucide-react-native';
import { BackIcon } from '../theme/icons';
import { spacing, touch, typography } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import type { RootStackParamList } from '../navigation/RootStack';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan3D'>;

export function Scan3DScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.back} hitSlop={touch.hitSlop}>
          <BackIcon size={24} color={colors.text} />
        </Pressable>
        <Text style={s.title}>3D Scanning</Text>
        <View style={{ width: touch.minTarget }} />
      </View>
      <View style={s.center}>
        <Box size={64} color={colors.textTertiary} />
        <Text style={s.heading}>3D Scanning</Text>
        <Text style={s.sub}>
          Create photogrammetry scans of objects using multiple camera angles.
        </Text>
        <Text style={s.badge}>Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { width: touch.minTarget, height: touch.minTarget, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: typography.weight.semibold, color: c.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  heading: { fontSize: 20, fontWeight: typography.weight.bold, color: c.text, marginTop: spacing.lg },
  sub: { fontSize: 14, color: c.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  badge: { fontSize: 12, fontWeight: typography.weight.semibold, color: c.heroGreen, backgroundColor: c.greenLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: spacing.lg, overflow: 'hidden' },
}); }
