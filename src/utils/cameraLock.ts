/**
 * Locks the camera's automatic exposure and white balance while a measurement runs.
 *
 * Automatic adjustments change the brightness and colour of the whole image, which the
 * pulse estimation reads as signal. Support in browsers is limited (some Chrome cameras;
 * not Safari), so locking is best effort: anything unsupported or rejected is ignored.
 */

type ModeCapabilities = MediaTrackCapabilities & {
  exposureMode?: string[];
  whiteBalanceMode?: string[];
};

type ModeSettings = MediaTrackSettings & {
  exposureTime?: number;
  colorTemperature?: number;
};

export class CameraSettingsLock {
  private locked = false;
  private lockedExposure = false;
  private lockedWhiteBalance = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param track - The video track of the camera stream.
   * @param delayMs - How long a face must be present before locking, so that the
   *   automatic mode has settled on the face first.
   */
  constructor(
    private track: MediaStreamTrack | undefined,
    private delayMs: number
  ) {}

  get isLocked(): boolean {
    return this.locked;
  }

  /**
   * Reports whether a face is currently detected. Locks after the face has been
   * present for the delay, and releases the lock when the face is lost so that the
   * camera can adapt before the next lock.
   */
  onFace(present: boolean): void {
    if (present) {
      if (this.locked || this.timer) return;
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.lock();
      }, this.delayMs);
    } else {
      this.cancelTimer();
      void this.unlock();
    }
  }

  /**
   * Locks exposure and white balance at their current values.
   * @returns `true` if anything was locked.
   */
  async lock(): Promise<boolean> {
    const track = this.track;
    if (!track || typeof track.getCapabilities !== 'function') return false;

    const caps = track.getCapabilities() as ModeCapabilities;
    const settings = track.getSettings() as ModeSettings;
    const advanced: Record<string, unknown> = {};
    const exposure =
      caps.exposureMode?.includes('manual') &&
      settings.exposureTime !== undefined;
    const whiteBalance =
      caps.whiteBalanceMode?.includes('manual') &&
      settings.colorTemperature !== undefined;

    if (exposure) {
      advanced.exposureMode = 'manual';
      advanced.exposureTime = settings.exposureTime;
    }
    if (whiteBalance) {
      advanced.whiteBalanceMode = 'manual';
      advanced.colorTemperature = settings.colorTemperature;
    }
    if (!exposure && !whiteBalance) return false;

    try {
      await track.applyConstraints({ advanced: [advanced] });
    } catch (e) {
      console.debug('Could not lock the camera settings:', e);
      return false;
    }
    this.locked = true;
    this.lockedExposure = !!exposure;
    this.lockedWhiteBalance = !!whiteBalance;
    return true;
  }

  /** Restores automatic exposure and white balance, if they were locked. */
  async unlock(): Promise<void> {
    if (!this.locked || !this.track) return;
    this.locked = false;

    const advanced: Record<string, unknown> = {};
    if (this.lockedExposure) advanced.exposureMode = 'continuous';
    if (this.lockedWhiteBalance) advanced.whiteBalanceMode = 'continuous';

    try {
      await this.track.applyConstraints({ advanced: [advanced] });
    } catch (e) {
      console.debug('Could not unlock the camera settings:', e);
    }
  }

  /** Cancels a pending lock and releases a held one. Call when the session ends. */
  dispose(): void {
    this.cancelTimer();
    void this.unlock();
  }

  private cancelTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
