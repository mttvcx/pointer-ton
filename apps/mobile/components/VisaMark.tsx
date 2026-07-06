import React from 'react';
import { Text, View, type ViewStyle } from 'react-native';

/**
 * Visa wordmark for the card mocks. Styled to read like the real logo (bold,
 * forward-slant italic, tight tracking). For production, swap this for Visa's
 * licensed brand asset (transparent PNG/SVG from their brand kit).
 */
export function VisaMark({ color = '#FFFFFF', size = 22, style }: { color?: string; size?: number; style?: ViewStyle }) {
  return (
    <View style={style}>
      <Text
        style={{
          color,
          fontSize: size,
          fontWeight: '900',
          fontStyle: 'italic',
          letterSpacing: -0.5,
          includeFontPadding: false,
        }}
      >
        VISA
      </Text>
    </View>
  );
}
