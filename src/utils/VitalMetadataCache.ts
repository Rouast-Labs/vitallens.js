import { getCoreSync } from '../core/wasmProvider';

export interface VitalMetadata {
  id?: string;
  short_name?: string;
  display_name?: string;
  unit?: string;
  emoji?: string;
  color?: string;
  min_value?: number;
  max_value?: number;
  min_window_seconds?: number;
  preferred_window_seconds?: number;
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
