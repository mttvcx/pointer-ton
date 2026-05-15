/**
 * Global user preferences (display layout).
 *
 * Mirror of the theme system: schema + defaults + localStorage key + a guard
 * helper. Persisted under a single JSON blob so a future migration can ship
 * new keys without invalidating existing storage (see {@link withDefaults}).
 *
 * Defaults INTENTIONALLY enable the three layered-row toggles. Users who
 * never open the Display popover see the new layered rows; density and
 * avatar size stay neutral so dimensional layout is unchanged.
 */

import { z } from 'zod';

export const RowDensitySchema = z.enum(['compact', 'default', 'spaced']);
export type RowDensity = z.infer<typeof RowDensitySchema>;

export const AvatarSizeSchema = z.enum(['small', 'default', 'large']);
export type AvatarSize = z.infer<typeof AvatarSizeSchema>;

export const PreferencesSchema = z.object({
  rowDensity: RowDensitySchema,
  rowSeparators: z.boolean(),
  rowElevation: z.boolean(),
  actionZoneDivider: z.boolean(),
  avatarSize: AvatarSizeSchema,
});

export type Preferences = z.infer<typeof PreferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  rowDensity: 'default',
  rowSeparators: true,
  rowElevation: true,
  actionZoneDivider: true,
  avatarSize: 'default',
};

export const PREFERENCES_STORAGE_KEY = 'pointer.preferences';

export function isPreferences(value: unknown): value is Preferences {
  return PreferencesSchema.safeParse(value).success;
}

/**
 * Merge a partial/unknown payload with {@link DEFAULT_PREFERENCES}. Used when
 * reading localStorage because a previous build may have stored fewer keys
 * or stored an old shape — unknown keys are tolerated, missing keys fall back.
 */
export function withDefaults(input: Partial<Preferences> | null | undefined): Preferences {
  return { ...DEFAULT_PREFERENCES, ...(input ?? {}) };
}
