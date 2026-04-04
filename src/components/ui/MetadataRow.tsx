import { ChevronRight } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, touch, typography } from '../../theme';
import type { ColorPalette } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import { Badge } from './Badge';

interface MetadataRowProps {
  label: string;
  value?: string;
  variant?: 'stacked' | 'inline';
  aiGenerated?: boolean;
  confidence?: number;
  onPress?: () => void;
  placeholder?: string;
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    base: {
      minHeight: touch.minTarget,
      justifyContent: 'center',
      paddingVertical: spacing.sm,
    },
    pressed: {
      opacity: 0.7,
    },
    // Inline
    inlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    inlineLabel: {
      flex: 0.4,
      ...typography.bodySmall,
      color: c.textSecondary,
    },
    inlineValueArea: {
      flex: 0.6,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    inlineValue: {
      ...typography.body,
      color: c.text,
      textAlign: 'right',
      flexShrink: 1,
    },
    // Stacked
    stackedContainer: {
      flexDirection: 'column',
    },
    stackedLabel: {
      ...typography.bodySmall,
      color: c.textSecondary,
      marginBottom: spacing.xs,
    },
    stackedValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stackedValue: {
      ...typography.body,
      color: c.text,
      flexShrink: 1,
    },
    // Shared
    placeholder: {
      color: c.textTertiary,
    },
    badgeGap: {
      marginLeft: spacing.sm,
    },
    chevron: {
      marginLeft: spacing.xs,
    },
  });
}

export function MetadataRow({
  label,
  value,
  variant = 'inline',
  aiGenerated = false,
  onPress,
  placeholder = '-',
}: MetadataRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const displayValue = value && value.trim().length > 0 ? value : undefined;
  const a11yLabel = `${label}: ${displayValue || placeholder}`;

  const content =
    variant === 'stacked' ? (
      <StackedContent
        label={label}
        value={displayValue}
        placeholder={placeholder}
        aiGenerated={aiGenerated}
        hasPress={!!onPress}
        colors={colors}
        styles={styles}
      />
    ) : (
      <InlineContent
        label={label}
        value={displayValue}
        placeholder={placeholder}
        aiGenerated={aiGenerated}
        hasPress={!!onPress}
        colors={colors}
        styles={styles}
      />
    );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        style={({ pressed }) => [styles.base, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={a11yLabel} style={styles.base}>
      {content}
    </View>
  );
}

function InlineContent({
  label,
  value,
  placeholder,
  aiGenerated,
  hasPress,
  colors,
  styles,
}: {
  label: string;
  value?: string;
  placeholder: string;
  aiGenerated: boolean;
  hasPress: boolean;
  colors: ColorPalette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.inlineRow}>
      <Text style={styles.inlineLabel}>{label}</Text>
      <View style={styles.inlineValueArea}>
        <Text
          style={[
            styles.inlineValue,
            !value && styles.placeholder,
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        {aiGenerated && value && (
          <View style={styles.badgeGap}>
            <Badge label="AI" variant="ai" size="sm" />
          </View>
        )}
      </View>
      {hasPress && (
        <ChevronRight
          size={16}
          color={colors.textTertiary}
          style={styles.chevron}
        />
      )}
    </View>
  );
}

function StackedContent({
  label,
  value,
  placeholder,
  aiGenerated,
  hasPress,
  colors,
  styles,
}: {
  label: string;
  value?: string;
  placeholder: string;
  aiGenerated: boolean;
  hasPress: boolean;
  colors: ColorPalette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stackedContainer}>
      <Text style={styles.stackedLabel}>{label}</Text>
      <View style={styles.stackedValueRow}>
        <Text
          style={[
            styles.stackedValue,
            !value && styles.placeholder,
          ]}
        >
          {value || placeholder}
        </Text>
        {aiGenerated && value && (
          <View style={styles.badgeGap}>
            <Badge label="AI" variant="ai" size="sm" />
          </View>
        )}
        {hasPress && (
          <ChevronRight size={16} color={colors.textTertiary} style={styles.chevron} />
        )}
      </View>
    </View>
  );
}
