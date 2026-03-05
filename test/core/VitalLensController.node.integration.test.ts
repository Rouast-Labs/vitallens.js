import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { VitalLensController } from '../../src/core/VitalLensController.node';
import { VitalLensOptions, VitalLensResult } from '../../src/types/core';
import { describe, expect, beforeAll, it } from 'vitest';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getTestDevApiKey(): string {
  const apiKey = process.env.VITALLENS_DEV_API_KEY;
  if (!apiKey) {
    throw new Error(
      'VITALLENS_DEV_API_KEY environment variable is not set. ' +
        'Please set this variable to a valid VitalLens API Key to run the tests.'
    );
  }
  return apiKey;
}

describe('VitalLensController Integration (Node)', () => {
  let controller: VitalLensController;
  const SAMPLE_VIDEO = path.resolve(
    __dirname,
    '../../examples/sample_video_1.mp4'
  );
  const API_KEY = getTestDevApiKey();

  beforeAll(async () => {
    if (!fs.existsSync(SAMPLE_VIDEO)) {
      throw new Error(`Sample video not found: ${SAMPLE_VIDEO}`);
    }

    const options: VitalLensOptions = {
      apiKey: API_KEY,
      method: 'vitallens',
      requestMode: 'rest',
      origin: 'test',
    };

    controller = new VitalLensController(options);
  });

  it('should process a real video file and return structured vital sign results', async () => {
    const result: VitalLensResult =
      await controller.processVideoFile(SAMPLE_VIDEO);
    // Ensure result structure
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');

    // Check `face` properties
    expect(result).toHaveProperty('face');
    expect(result.face).toHaveProperty('coordinates');
    expect(result.face).toHaveProperty('confidence');
    expect(result.face.confidence).toBeInstanceOf(Array);
    expect(result.face.confidence?.length).toBeGreaterThan(0);

    // Check `vitals`, `waveform` properties
    expect(result).toHaveProperty('vitals');
    expect(result).toHaveProperty('waveforms');

    // Heart rate validation
    expect(result.vitals).toHaveProperty('heart_rate');
    expect(result.vitals.heart_rate).toHaveProperty('value');
    expect(result.vitals.heart_rate).toHaveProperty('confidence');
    expect(typeof result.vitals.heart_rate!.value).toBe('number');
    expect(result.vitals.heart_rate!.value).toBeGreaterThan(40);
    expect(result.vitals.heart_rate!.value).toBeLessThan(220);
    expect(result.vitals.heart_rate!.confidence).toBeGreaterThanOrEqual(0);
    expect(result.vitals.heart_rate!.confidence).toBeLessThanOrEqual(1);

    // Respiratory rate validation
    expect(result.vitals).toHaveProperty('respiratory_rate');
    expect(result.vitals.respiratory_rate).toHaveProperty('value');
    expect(result.vitals.respiratory_rate).toHaveProperty('confidence');
    expect(typeof result.vitals.respiratory_rate!.value).toBe('number');
    expect(result.vitals.respiratory_rate!.value).toBeGreaterThan(4);
    expect(result.vitals.respiratory_rate!.value).toBeLessThan(40);
    expect(result.vitals.respiratory_rate!.confidence).toBeGreaterThanOrEqual(
      0
    );
    expect(result.vitals.respiratory_rate!.confidence).toBeLessThanOrEqual(1);

    // Ensure `ppg_waveform` and `respiratory_waveform` have data arrays
    expect(result.waveforms).toHaveProperty('ppg_waveform');
    expect(result.waveforms).toHaveProperty('respiratory_waveform');
    expect(Array.isArray(result.waveforms.ppg_waveform!.data)).toBe(true);
    expect(Array.isArray(result.waveforms.respiratory_waveform!.data)).toBe(
      true
    );
    expect(result.waveforms.ppg_waveform!.data.length).toBeGreaterThan(0);
    expect(result.waveforms.respiratory_waveform!.data.length).toBeGreaterThan(
      0
    );

    // Ensure `time` array is valid
    expect(result).toHaveProperty('time');
    expect(Array.isArray(result.time)).toBe(true);
    expect(result.time.length).toBeGreaterThan(0);
    expect(result.time[result.time.length - 1]).toBeGreaterThan(result.time[0]);

    // Ensure `message` and `fps` and `model_used` exist
    expect(result).toHaveProperty('message');
    expect(typeof result.message).toBe('string');
    expect(result).toHaveProperty('fps');
    expect(typeof result.fps).toBe('number');
    expect(result.fps).toBeGreaterThan(0);
    // expect(result).toHaveProperty('model_used');
    // expect(typeof result.model_used).toBe('string');

    controller.dispose();
  }, 60000);
});
