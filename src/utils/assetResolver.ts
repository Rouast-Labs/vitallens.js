export function resolveAsset(assetPath: string): string {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      // Resolves the asset relative to the currently executing script
      return new URL(assetPath, import.meta.url).href;
    }
  } catch {
    // Ignore and proceed to fallback
  }

  // Fallback for environments lacking import.meta.url
  return `https://cdn.jsdelivr.net/npm/vitallens/dist/${assetPath}`;
}
