import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { VerifiedBadge } from './VerifiedBadge';
import { colors } from '../src/theme';

const FALLBACK_COLORS = ['#6E56CF', '#1E63B5', '#2E7D32', '#B5521E', '#C9A21E', '#B53A6E', '#2A8C8C'];
function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
}

/** Real token logo (from the API's image_url) with a colored-initial fallback for
 * loading/missing images. */
export function CoinIcon({
  uri,
  symbol,
  size = 44,
  verified = false,
}: {
  uri?: string | null;
  symbol?: string | null;
  size?: number;
  verified?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(uri) && !failed;
  const letter = (symbol ?? '?').replace(/^\$/, '').slice(0, 1).toUpperCase();
  const r = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          style={{ width: size, height: size, borderRadius: r, backgroundColor: colors.bgRaised2 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[s.fallback, { width: size, height: size, borderRadius: r, backgroundColor: hashColor(symbol ?? '?') }]}>
          <Text style={[s.letter, { fontSize: Math.round(size * 0.42) }]}>{letter}</Text>
        </View>
      )}
      {verified ? (
        <View style={s.badge}>
          <VerifiedBadge size={16} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: '#fff', fontWeight: '700' },
  badge: { position: 'absolute', right: -3, bottom: -2 },
});
