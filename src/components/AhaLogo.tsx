import React from 'react';
import { Image, ImageStyle } from 'react-native';
import logoSource from '../../assets/images/register-logo.png';

interface AhaLogoProps {
  width?: number;
  height?: number;
  color?: string; // kept for API compatibility, not used
  style?: ImageStyle;
}

export default function AhaLogo({ width = 200, height = 88, style }: AhaLogoProps) {
  return (
    <Image
      source={logoSource}
      style={[{ width, height }, style]}
      resizeMode="contain"
      accessibilityLabel="aha! Register logo"
    />
  );
}
