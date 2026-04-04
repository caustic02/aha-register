/* eslint-disable react-native/no-color-literals */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Printer, Share2 } from 'lucide-react-native';
import { BackIcon } from '../theme/icons';
import { radii, spacing, touch, typography } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import type { RootStackParamList } from '../navigation/RootStack';

type Props = NativeStackScreenProps<RootStackParamList, 'ScaleReference'>;

/** ISO/IEC 7810 ID-1 credit card: 85.6 × 53.98 mm */
const CARD_W_MM = 85.6;
const CARD_H_MM = 53.98;

const SWATCHES = [
  { color: '#000000', label: 'Schwarz\nBlack', border: false },
  { color: '#FFFFFF', label: 'Weiß\nWhite', border: true },
  { color: '#FF0000', label: 'Rot\nRed', border: false },
  { color: '#0000FF', label: 'Blau\nBlue', border: false },
  { color: '#808080', label: 'Grau\nGray', border: false },
] as const;

function buildPrintHtml(): string {
  const swatchHtml = SWATCHES.map(
    (s) =>
      `<div class="swatch" style="background:${s.color};${s.border ? 'border:1px solid #aaa;' : ''}"></div>`,
  ).join('');
  const swatchLabels = SWATCHES.map(
    (s) => `<div class="sw-label">${s.label.replace('\n', ' / ')}</div>`,
  ).join('');
  const rulerTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80]
    .map((n) => `<div class="rtick">${n}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: ${CARD_W_MM}mm ${CARD_H_MM}mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${CARD_W_MM}mm; height: ${CARD_H_MM}mm;
    font-family: Helvetica, Arial, sans-serif;
    background: #fff; overflow: hidden;
  }
  .card {
    width: ${CARD_W_MM}mm; height: ${CARD_H_MM}mm;
    padding: 2.5mm; display: flex; flex-direction: column;
    justify-content: space-between;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { font-size: 5.5pt; font-weight: bold; color: #111; line-height: 1.3; }
  .brand-sub { font-size: 4pt; color: #555; margin-top: 0.5mm; }
  .dims-box { text-align: right; }
  .dims { font-size: 4pt; color: #555; line-height: 1.4; }
  .swatches-row { display: flex; flex-direction: row; gap: 2mm; margin-top: 2mm; align-items: flex-end; }
  .swatch { width: 10mm; height: 10mm; border-radius: 1.5mm; flex-shrink: 0; }
  .sw-labels { display: flex; flex-direction: row; gap: 2mm; margin-top: 0.5mm; }
  .sw-label { width: 10mm; font-size: 2.5pt; color: #666; text-align: center; line-height: 1.2; }
  .ruler-wrap { margin-top: 3mm; }
  .ruler {
    height: 3mm; width: 79mm;
    background: repeating-linear-gradient(to right, #000 0, #000 5mm, #fff 5mm, #fff 10mm);
    border: 0.3mm solid #000;
  }
  .rticks { display: flex; flex-direction: row; width: 79mm; justify-content: space-between; margin-top: 0.5mm; }
  .rtick { font-size: 2.5pt; color: #333; width: 9mm; text-align: center; }
  .rtick:first-child { text-align: left; }
  .rtick:last-child { text-align: right; }
  .ruler-unit { font-size: 2.5pt; color: #555; margin-top: 0.3mm; }
  .footer { font-size: 3pt; color: #888; line-height: 1.5; margin-top: 1mm; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div>
      <div class="brand">aha! Register</div>
      <div class="brand-sub">Messreferenz / Scale Reference</div>
    </div>
    <div class="dims-box">
      <div class="dims">${CARD_W_MM} × ${CARD_H_MM} mm<br>ISO/IEC 7810 ID-1</div>
    </div>
  </div>
  <div>
    <div class="swatches-row">${swatchHtml}</div>
    <div class="sw-labels">${swatchLabels}</div>
  </div>
  <div class="ruler-wrap">
    <div class="ruler"></div>
    <div class="rticks">${rulerTicks}</div>
    <div class="ruler-unit">mm</div>
  </div>
  <div class="footer">
    Karte neben das Objekt legen · Place card next to the object<br>
    KI erkennt Karte automatisch und berechnet Objektmaße · AI detects card and calculates dimensions
  </div>
</div>
</body>
</html>`;
}

export function ScaleReferenceScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [printing, setPrinting] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await Print.printAsync({ html: buildPrintHtml() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('did not complete') && !msg.includes('cancelled')) {
        Alert.alert('Druckfehler / Print Error', msg);
      }
    } finally {
      setPrinting(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildPrintHtml() });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch (err) {
      Alert.alert('Fehler / Error', err instanceof Error ? err.message : String(err));
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.back} hitSlop={touch.hitSlop}>
          <BackIcon size={24} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Messreferenz</Text>
        <View style={{ width: touch.minTarget }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.subtitle}>Scale Reference Card</Text>
        <Text style={s.desc}>
          Drucken Sie diese Karte in Originalgröße aus (Kreditkartenformat: 85,6 × 53,98 mm) und legen Sie sie beim Fotografieren neben das Objekt. Die KI erkennt die Karte automatisch und berechnet die tatsächlichen Maße.
        </Text>
        <Text style={s.descEn}>
          Print at actual size (credit card: 85.6 × 53.98 mm) and place next to the object when photographing. The AI automatically detects the card and calculates object dimensions.
        </Text>

        {/* ── Card preview ───────────────────────────────────────────────── */}
        <View style={s.previewWrap}>
          <View style={s.card}>
            <View style={s.cardTop}>
              <View>
                <Text style={s.cardBrand}>aha! Register</Text>
                <Text style={s.cardBrandSub}>Messreferenz / Scale Reference</Text>
              </View>
              <Text style={s.cardDims}>{CARD_W_MM} × {CARD_H_MM} mm{'\n'}ISO/IEC 7810</Text>
            </View>

            <View style={s.swatchRow}>
              {SWATCHES.map((sw) => (
                <View
                  key={sw.color}
                  style={[s.swatch, { backgroundColor: sw.color }, sw.border && s.swatchBorder]}
                >
                  <Text style={s.swatchLabel}>{sw.label}</Text>
                </View>
              ))}
            </View>

            <View>
              <View style={s.rulerStrip}>
                {Array.from({ length: 8 }, (_, i) => (
                  <View
                    key={i}
                    style={[s.rulerBlock, i % 2 === 0 ? s.rulerBlockDark : s.rulerBlockLight]}
                  />
                ))}
              </View>
              <View style={s.rulerLabels}>
                {[0, 10, 20, 30, 40, 50, 60, 70, 80].map((n) => (
                  <Text key={n} style={s.rulerTick}>{n}</Text>
                ))}
              </View>
              <Text style={s.rulerUnit}>mm</Text>
            </View>

            <Text style={s.cardFooter}>
              Karte neben das Objekt legen · Place card next to the object
            </Text>
          </View>
          <Text style={s.previewNote}>Vorschau · nicht maßstabsgetreu / Preview · not to scale</Text>
        </View>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <View style={s.actions}>
          <Pressable
            style={[s.btn, s.btnPrimary, (printing || sharing) && s.btnDisabled]}
            onPress={handlePrint}
            disabled={printing || sharing}
            accessibilityLabel="Drucken"
          >
            {printing
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Printer size={20} color={colors.white} />}
            <Text style={s.btnLabelPrimary}>Drucken / Print</Text>
          </Pressable>

          <Pressable
            style={[s.btn, s.btnSecondary, (printing || sharing) && s.btnDisabled]}
            onPress={handleShare}
            disabled={printing || sharing}
            accessibilityLabel="Als PDF teilen"
          >
            {sharing
              ? <ActivityIndicator color={colors.text} size="small" />
              : <Share2 size={20} color={colors.text} />}
            <Text style={s.btnLabelSecondary}>Teilen / Share PDF</Text>
          </Pressable>
        </View>

        <View style={s.infoBox}>
          <Text style={s.infoText}>
            Tipp: Die KI erkennt diese Karte im Foto automatisch und berechnet daraus die realen Abmessungen des Objekts — ohne manuelle Eingabe.
          </Text>
          <Text style={[s.infoText, s.infoTextEn]}>
            Tip: The AI detects this card in photos and automatically calculates the real-world dimensions of the object without manual input.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  // Preview card: 3px per mm for screen display
  const PX_PER_MM = 3;
  const CARD_W = Math.round(CARD_W_MM * PX_PER_MM);
  const CARD_H = Math.round(CARD_H_MM * PX_PER_MM);
  const SWATCH = Math.round(10 * PX_PER_MM);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    back: {
      width: touch.minTarget,
      height: touch.minTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 16, fontWeight: typography.weight.semibold, color: c.text },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    subtitle: {
      fontSize: typography.size.base,
      fontWeight: typography.weight.semibold,
      color: c.textSecondary,
      marginBottom: spacing.sm,
    },
    desc: { fontSize: typography.size.sm, color: c.text, lineHeight: 20, marginBottom: spacing.xs },
    descEn: { fontSize: typography.size.sm, color: c.textSecondary, lineHeight: 20, marginBottom: spacing.xl },

    // Card preview
    previewWrap: { alignItems: 'center', marginBottom: spacing.xl },
    card: {
      width: CARD_W,
      height: CARD_H,
      backgroundColor: c.white,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.border,
      padding: 7,
      justifyContent: 'space-between',
      shadowColor: c.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardBrand: { fontSize: 7, fontWeight: typography.weight.bold, color: c.text },
    cardBrandSub: { fontSize: 5, color: c.textSecondary, marginTop: 1 },
    cardDims: { fontSize: 5, color: c.textSecondary, textAlign: 'right', lineHeight: 7 },
    swatchRow: { flexDirection: 'row', gap: 4 },
    swatch: { width: SWATCH, height: SWATCH, borderRadius: 3, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 1 },
    swatchBorder: { borderWidth: 1, borderColor: c.border },
    swatchLabel: { fontSize: 4, color: c.textTertiary, textAlign: 'center', lineHeight: 5 },
    rulerStrip: {
      flexDirection: 'row',
      height: 7,
      width: CARD_W - 14,
      overflow: 'hidden',
      borderRadius: 1,
      borderWidth: 0.5,
      borderColor: c.text,
    },
    rulerBlock: { flex: 1, height: 7 },
    rulerBlockDark: { backgroundColor: c.text },
    rulerBlockLight: { backgroundColor: c.white },
    rulerLabels: {
      flexDirection: 'row',
      width: CARD_W - 14,
      justifyContent: 'space-between',
      marginTop: 1,
    },
    rulerTick: { fontSize: 4.5, color: c.textSecondary },
    rulerUnit: { fontSize: 4.5, color: c.textSecondary, marginTop: 1 },
    cardFooter: { fontSize: 5, color: c.textTertiary },
    previewNote: { fontSize: typography.size.xs, color: c.textTertiary, marginTop: spacing.sm },

    // Actions
    actions: { gap: spacing.md, marginBottom: spacing.xl },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radii.md,
      minHeight: touch.minTarget,
    },
    btnPrimary: { backgroundColor: c.accent },
    btnSecondary: { backgroundColor: c.surfaceContainer, borderWidth: 1, borderColor: c.border },
    btnDisabled: { opacity: 0.6 },
    btnLabelPrimary: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: c.white },
    btnLabelSecondary: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: c.text },

    // Info box
    infoBox: {
      backgroundColor: c.surfaceContainer,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      gap: spacing.xs,
    },
    infoText: { fontSize: typography.size.sm, color: c.text, lineHeight: 20 },
    infoTextEn: { color: c.textSecondary },
  });
}
