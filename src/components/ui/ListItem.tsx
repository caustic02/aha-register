import { ChevronRight } from 'lucide-react-native';
import React, { ReactNode } from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import { Badge } from './Badge';

interface BadgeProps {
  label: string;
  variant?: 'info' | 'success' | 'warning' | 'error' | 'ai' | 'neutral';
}

interface ListItemProps {
  title: string;
  onPress: () => void;
  subtitle?: string;
  thumbnail?: ImageSourcePropType;
  rightElement?: ReactNode;
  badge?: BadgeProps;
}

export function ListItem({
  title,
  onPress,
  subtitle,
  thumbnail,
  rightElement,
  badge,
}: ListItemProps) {
  const a11yLabel = subtitle ? `${title}, ${subtitle}` : title;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={({ pressed }) => [styles.base, pressed && styles.pressed]}
    >
      {thumbnail && (
        <Image source={thumbnail} style={styles.thumbnail} />
      )}
      <View style={styles.textArea}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {badge && (
            <View style={styles.badgeGap}>
              <Badge label={badge.label} variant={badge.variant} size="sm" />
            </View>
          )}
        </View>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement ?? (
        <ChevronRight size={20} color={colors.textTertiary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    marginRight: spacing.lg,
  },
  textArea: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    ...typography.bodyMedium,
    color: colors.text,
    flexShrink: 1,
  },
  badgeGap: {
    marginLeft: spacing.sm,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
