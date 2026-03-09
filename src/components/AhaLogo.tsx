import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Text as SvgText, TSpan } from 'react-native-svg';
import { colors } from '../theme';

interface AhaLogoProps {
  width?: number;
  height?: number;
}

export function AhaLogo({ width = 180, height = 56 }: AhaLogoProps) {
  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox="0 0 180 56">
        <SvgText
          x="90"
          y="44"
          textAnchor="middle"
          fontWeight="800"
          fontStyle="italic"
          fontSize="48"
          fill={colors.accent}
        >
          <TSpan>aha</TSpan>
          <TSpan fill={colors.warning}>!</TSpan>
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
