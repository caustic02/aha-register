import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { colors } from '../theme';

interface AhaLogoProps {
  width?: number;
  height?: number;
}

/**
 * Path-based SVG logo for "aha!" brand mark.
 * Bold condensed italic letterforms rendered as vector paths (not text spans).
 * "aha" in accent green, "!" in warning gold.
 */
export function AhaLogo({ width = 180, height = 56 }: AhaLogoProps) {
  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox="0 0 200 68">
        <G transform="translate(20,0) skewX(-10)">
          {/* a (first) */}
          <Path
            d="M42 63L42 15C36 15 28 15 22 15C8 15 0 24 0 39C0 54 8 63 22 63Z M30 27L22 27C13 27 12 33 12 39C12 45 13 51 22 51L30 51Z"
            fill={colors.accent}
            fillRule="evenodd"
          />
          {/* h */}
          <Path
            d="M48 63L48 5L60 5L60 22C63 17 70 15 78 15C86 15 92 20 92 28L92 63L80 63L80 30C80 27 78 26 74 26C68 26 60 28 60 34L60 63Z"
            fill={colors.accent}
          />
          {/* a (second) */}
          <Path
            d="M138 63L138 15C132 15 124 15 118 15C104 15 96 24 96 39C96 54 104 63 118 63Z M126 27L118 27C109 27 108 33 108 39C108 45 109 51 118 51L126 51Z"
            fill={colors.accent}
            fillRule="evenodd"
          />
          {/* ! */}
          <Path
            d="M147 15L157 15L155 44L149 44Z M148 50L156 50L156 63L148 63Z"
            fill={colors.warning}
            fillRule="evenodd"
          />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
