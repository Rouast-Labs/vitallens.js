import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CameraSettingsLock } from '../../src/utils/cameraLock';

type Caps = Record<string, unknown>;

const makeTrack = (caps: Caps, settings: Caps, rejects = false) =>
  ({
    getCapabilities: () => caps,
    getSettings: () => settings,
    applyConstraints: vi.fn(() =>
      rejects
        ? Promise.reject(new Error('OverconstrainedError'))
        : Promise.resolve()
    ),
  }) as unknown as MediaStreamTrack & {
    applyConstraints: ReturnType<typeof vi.fn>;
  };

const fullCaps = {
  exposureMode: ['continuous', 'manual'],
  whiteBalanceMode: ['continuous', 'manual'],
};
const settings = { exposureTime: 33, colorTemperature: 4500 };

describe('CameraSettingsLock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('locks exposure and white balance at their current values', async () => {
    const track = makeTrack(fullCaps, settings);
    const lock = new CameraSettingsLock(track, 1500);

    expect(await lock.lock()).toBe(true);
    expect(track.applyConstraints).toHaveBeenCalledWith({
      advanced: [
        {
          exposureMode: 'manual',
          exposureTime: 33,
          whiteBalanceMode: 'manual',
          colorTemperature: 4500,
        },
      ],
    });
    expect(lock.isLocked).toBe(true);
  });

  it('locks only what the camera supports', async () => {
    const track = makeTrack({ exposureMode: ['manual'] }, settings);
    const lock = new CameraSettingsLock(track, 1500);

    expect(await lock.lock()).toBe(true);
    expect(track.applyConstraints).toHaveBeenCalledWith({
      advanced: [{ exposureMode: 'manual', exposureTime: 33 }],
    });
  });

  it('does nothing when the camera supports no manual control', async () => {
    const track = makeTrack({}, settings);
    const lock = new CameraSettingsLock(track, 1500);

    expect(await lock.lock()).toBe(false);
    expect(track.applyConstraints).not.toHaveBeenCalled();
    expect(lock.isLocked).toBe(false);
  });

  it('does nothing when there is no track or no capability API', async () => {
    expect(await new CameraSettingsLock(undefined, 1500).lock()).toBe(false);
    const noApi = {
      getSettings: () => settings,
    } as unknown as MediaStreamTrack;
    expect(await new CameraSettingsLock(noApi, 1500).lock()).toBe(false);
  });

  it('ignores a rejected constraint change', async () => {
    const track = makeTrack(fullCaps, settings, true);
    const lock = new CameraSettingsLock(track, 1500);

    expect(await lock.lock()).toBe(false);
    expect(lock.isLocked).toBe(false);
  });

  it('unlocks by restoring continuous modes', async () => {
    const track = makeTrack(fullCaps, settings);
    const lock = new CameraSettingsLock(track, 1500);
    await lock.lock();
    track.applyConstraints.mockClear();

    await lock.unlock();

    expect(track.applyConstraints).toHaveBeenCalledWith({
      advanced: [
        { exposureMode: 'continuous', whiteBalanceMode: 'continuous' },
      ],
    });
    expect(lock.isLocked).toBe(false);
  });

  it('does not unlock when it never locked', async () => {
    const track = makeTrack(fullCaps, settings);
    const lock = new CameraSettingsLock(track, 1500);

    await lock.unlock();

    expect(track.applyConstraints).not.toHaveBeenCalled();
  });

  it('locks once the face has been present for the delay', async () => {
    const track = makeTrack(fullCaps, settings);
    const lock = new CameraSettingsLock(track, 1500);

    lock.onFace(true);
    await vi.advanceTimersByTimeAsync(1400);
    expect(track.applyConstraints).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(track.applyConstraints).toHaveBeenCalledTimes(1);
    expect(lock.isLocked).toBe(true);
  });

  it('does not lock if the face is lost before the delay', async () => {
    const track = makeTrack(fullCaps, settings);
    const lock = new CameraSettingsLock(track, 1500);

    lock.onFace(true);
    await vi.advanceTimersByTimeAsync(1000);
    lock.onFace(false);
    await vi.advanceTimersByTimeAsync(2000);

    expect(track.applyConstraints).not.toHaveBeenCalled();
  });

  it('restarts the delay when repeated face events arrive', async () => {
    const track = makeTrack(fullCaps, settings);
    const lock = new CameraSettingsLock(track, 1500);

    lock.onFace(true);
    await vi.advanceTimersByTimeAsync(1000);
    lock.onFace(true); // must not postpone or duplicate the lock
    await vi.advanceTimersByTimeAsync(600);

    expect(track.applyConstraints).toHaveBeenCalledTimes(1);
  });

  it('unlocks when the face is lost and locks again when it returns', async () => {
    const track = makeTrack(fullCaps, settings);
    const lock = new CameraSettingsLock(track, 1500);

    lock.onFace(true);
    await vi.advanceTimersByTimeAsync(1600);
    expect(lock.isLocked).toBe(true);

    lock.onFace(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(lock.isLocked).toBe(false);

    lock.onFace(true);
    await vi.advanceTimersByTimeAsync(1600);
    expect(lock.isLocked).toBe(true);
  });

  it('dispose cancels a pending lock and releases a held lock', async () => {
    const track = makeTrack(fullCaps, settings);
    const pending = new CameraSettingsLock(track, 1500);
    pending.onFace(true);
    pending.dispose();
    await vi.advanceTimersByTimeAsync(3000);
    expect(track.applyConstraints).not.toHaveBeenCalled();

    const held = new CameraSettingsLock(track, 1500);
    await held.lock();
    track.applyConstraints.mockClear();
    held.dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(track.applyConstraints).toHaveBeenCalledTimes(1);
    expect(held.isLocked).toBe(false);
  });
});
