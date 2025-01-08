import { FrameUtils } from '../../src/utils/FrameUtils';
import { Frame } from '../../src/types/core';

describe('FrameUtils', () => {
  const mockBuffer = Buffer.from('mock-buffer-data');
  const mockBase64 = `data:image/jpeg;base64,${mockBuffer.toString('base64')}`;
  const mockFrames: Frame[] = [
    { data: 'frame1-data', timestamp: 1 },
    { data: 'frame2-data', timestamp: 2 },
  ];

  it('should encode a Buffer to a Base64 string', () => {
    const result = FrameUtils.encodeToBase64(mockBuffer);
    expect(result).toBe(mockBase64);
  });

  it('should decode a Base64 string to a Buffer', () => {
    const result = FrameUtils.decodeFromBase64(mockBase64);
    expect(result).toEqual(mockBuffer);
  });

  it('should concatenate frames into a single Base64 string', () => {
    const result = FrameUtils.concatenateFrames(mockFrames);
    expect(result).toBe('frame1-data,frame2-data');
  });

  it('should convert a Base64 string to a Blob in a browser environment', () => {
    const mockFrame: Frame = { data: mockBase64, timestamp: 123 };

    const result = FrameUtils.frameToBlob(mockFrame);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/jpeg');
  });

  it('should throw an error if frameToBlob is called in a Node.js environment', () => {
    const mockFrame: Frame = { data: mockBase64, timestamp: 123 };

    jest.spyOn(global, 'Blob').mockImplementationOnce(() => {
      throw new Error('Blob is not defined in Node.js');
    });

    expect(() => FrameUtils.frameToBlob(mockFrame)).toThrow('Blob is not defined in Node.js');
  });
});
