import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../src/theme';

/** Official X (Twitter) glyph in a subtle rounded square — shown only when a
 * trader has connected their X account. */
export function XBadge({ size = 24 }: { size?: number }) {
  const inner = Math.round(size * 0.46);
  return (
    <View style={[s.box, { width: size, height: size, borderRadius: Math.round(size * 0.3) }]}>
      <Svg width={inner} height={inner} viewBox="0 0 24 24">
        <Path
          d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
          fill={colors.fg}
        />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: colors.bgRaised2, alignItems: 'center', justifyContent: 'center' },
});
