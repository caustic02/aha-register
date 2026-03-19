import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';

interface AhaLogoProps {
  width?: number;
  height?: number;
  /** Logo color — defaults to black, pass parchment for dark backgrounds */
  color?: string;
}

/**
 * aha! Register brand mark.
 *
 * Four viewfinder bracket corners forming a square frame,
 * with "aha!" bold condensed italic inside and "REGISTER"
 * in lighter weight below.
 */
export function AhaLogo({ width = 180, height = 80, color = '#1A1A1A' }: AhaLogoProps) {
  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox="0 0 180 80">
        {/* Viewfinder bracket corners */}
        <G stroke={color} strokeWidth={3} strokeLinecap="square" fill="none">
          {/* Top-left */}
          <Path d="M12 28V12h16" />
          {/* Top-right */}
          <Path d="M152 12h16v16" />
          {/* Bottom-left */}
          <Path d="M12 52v16h16" />
          {/* Bottom-right */}
          <Path d="M152 68h16v-16" />
        </G>

        {/* "aha!" text — bold condensed italic */}
        <SvgText
          x="90"
          y="48"
          textAnchor="middle"
          fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
          fontSize="32"
          fontWeight="800"
          fontStyle="italic"
          fill={color}
        >
          aha!
        </SvgText>

        {/* "REGISTER" — lighter weight, tracked */}
        <SvgText
          x="90"
          y="74"
          textAnchor="middle"
          fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
          fontSize="10"
          fontWeight="400"
          letterSpacing={4}
          fill={color}
        >
          REGISTER
        </SvgText>
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
