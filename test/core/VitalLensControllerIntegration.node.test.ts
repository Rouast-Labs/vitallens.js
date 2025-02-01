import path from 'path';
import fs from 'fs';
import { VitalLensController } from '../../src/core/VitalLensController.node';
import { VitalLensOptions, VitalLensResult } from '../../src/types/core';
import { CALC_HR_MAX, CALC_HR_MIN, CALC_RR_MAX, CALC_RR_MIN } from '../../src/config/constants';
import dotenv from 'dotenv';

dotenv.config();

describe('VitalLensController Integration (Node)', () => {
  let controller: VitalLensController;
  const SAMPLE_VIDEO = path.resolve(__dirname, '../../examples/sample_video_1.mp4');
  const API_KEY = process.env.VITALLENS_DEV_API_KEY;

  beforeAll(async () => {
    if (!fs.existsSync(SAMPLE_VIDEO)) {
      throw new Error(`Sample video not found: ${SAMPLE_VIDEO}`);
    }

    const options: VitalLensOptions = {
      apiKey: API_KEY,
      method: 'vitallens',
      requestMode: 'rest',
    };

    controller = new VitalLensController(options);
  });

  it('should process a real video file and return structured vital sign results', async () => {
    const result: VitalLensResult = await controller.processFile(SAMPLE_VIDEO);

    // Ensure result structure
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');

    // Check `face` properties
    expect(result).toHaveProperty('face');
    expect(result.face).toHaveProperty('coordinates');
    expect(result.face).toHaveProperty('confidence');
    expect(result.face.confidence).toBeInstanceOf(Array);
    expect(result.face.confidence?.length).toBeGreaterThan(0);

    // Check `vital_signs` properties
    expect(result).toHaveProperty('vital_signs');

    // Heart rate validation
    expect(result.vital_signs).toHaveProperty('heart_rate');
    expect(result.vital_signs.heart_rate).toHaveProperty('value');
    expect(result.vital_signs.heart_rate).toHaveProperty('confidence');
    expect(typeof result.vital_signs.heart_rate!.value).toBe('number');
    expect(result.vital_signs.heart_rate!.value).toBeGreaterThan(CALC_HR_MIN);
    expect(result.vital_signs.heart_rate!.value).toBeLessThan(CALC_HR_MAX);
    expect(result.vital_signs.heart_rate!.confidence).toBeGreaterThanOrEqual(0);
    expect(result.vital_signs.heart_rate!.confidence).toBeLessThanOrEqual(1);

    // Respiratory rate validation
    expect(result.vital_signs).toHaveProperty('respiratory_rate');
    expect(result.vital_signs.respiratory_rate).toHaveProperty('value');
    expect(result.vital_signs.respiratory_rate).toHaveProperty('confidence');
    expect(typeof result.vital_signs.respiratory_rate!.value).toBe('number');
    expect(result.vital_signs.respiratory_rate!.value).toBeGreaterThan(CALC_RR_MIN);
    expect(result.vital_signs.respiratory_rate!.value).toBeLessThan(CALC_RR_MAX);
    expect(result.vital_signs.respiratory_rate!.confidence).toBeGreaterThanOrEqual(0);
    expect(result.vital_signs.respiratory_rate!.confidence).toBeLessThanOrEqual(1);

    // Ensure `ppg_waveform` and `respiratory_waveform` have data arrays
    expect(result.vital_signs).toHaveProperty('ppg_waveform');
    expect(result.vital_signs).toHaveProperty('respiratory_waveform');
    expect(Array.isArray(result.vital_signs.ppg_waveform!.data)).toBe(true);
    expect(Array.isArray(result.vital_signs.respiratory_waveform!.data)).toBe(true);
    expect(result.vital_signs.ppg_waveform!.data.length).toBeGreaterThan(0);
    expect(result.vital_signs.respiratory_waveform!.data.length).toBeGreaterThan(0);

    // Ensure `time` array is valid
    expect(result).toHaveProperty('time');
    expect(Array.isArray(result.time)).toBe(true);
    expect(result.time.length).toBeGreaterThan(0);
    expect(result.time[result.time.length - 1]).toBeGreaterThan(result.time[0]);

    // Ensure `message` and `fps` exist
    expect(result).toHaveProperty('message');
    expect(typeof result.message).toBe('string');
    expect(result).toHaveProperty('fps');
    expect(typeof result.fps).toBe('number');
    expect(result.fps).toBeGreaterThan(0);
  }, 30000);
});
