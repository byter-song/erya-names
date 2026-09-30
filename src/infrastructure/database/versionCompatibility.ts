const DEXIE_NATIVE_VERSION_FACTOR = 10;

export function isFutureDexieDatabaseVersion(
  nativeVersion: number,
  supportedDexieVersion: number,
): boolean {
  return nativeVersion > supportedDexieVersion * DEXIE_NATIVE_VERSION_FACTOR;
}
