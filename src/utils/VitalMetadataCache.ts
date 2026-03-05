import { getCoreSync } from '../core/wasmProvider';

export interface VitalMetadata {
  id?: string;
  shortName?: string;
  short_name?: string;
  displayName?: string;
  display_name?: string;
  unit?: string;
  emoji?: string;
  color?: string;
}

export class VitalMetadataCache {
  private static cache: Record<string, VitalMetadata> = {};

  public static getMeta(id: string): VitalMetadata | null {
    if (this.cache[id]) return this.cache[id];
    try {
      const core = getCoreSync();
      const meta = core.getVitalInfo(id) as VitalMetadata;
      if (meta) {
        this.cache[id] = meta;
        return meta;
      }
    } catch {
      // ignore
    }
    return null;
  }
}
