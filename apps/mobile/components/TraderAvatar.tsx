import React, { useState } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

/**
 * Trader avatar that shows the person's real X profile picture (fetched by handle
 * via unavatar), falling back to the colored initial circle if there's no handle
 * or the image fails. Used for the demo social people (top trades, leaderboard,
 * activity, traders-here) so they look real instead of blank letter circles.
 */
export function avatarUrlFor(handle?: string | null): string | null {
  if (!handle) return null;
  const h = handle.replace(/^@/, '').trim();
  return h ? `https://unavatar.io/x/${encodeURIComponent(h)}` : null;
}

export function TraderAvatar({
  handle,
  color,
  initial,
  name,
  size = 40,
  style,
}: {
  handle?: string | null;
  color?: string;
  initial?: string;
  name?: string;
  size?: number;
  style?: ViewStyle;
}) {
  const [failed, setFailed] = useState(false);
  const uri = avatarUrlFor(handle);
  const letter = (initial || name?.[0] || '?').toUpperCase();

  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? '#3A3F47', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      {uri && !failed ? (
        <Image source={{ uri }} style={{ width: size, height: size }} onError={() => setFailed(true)} />
      ) : (
        <Text style={{ color: '#fff', fontSize: Math.round(size * 0.42), fontWeight: '700' }}>{letter}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({});
