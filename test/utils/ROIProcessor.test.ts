import { ROIProcessor } from '../../src/utils/ROIProcessor';
import sharp from 'sharp';

jest.mock('sharp');

describe('ROIProcessor', () => {
  const roi = { x: 50, y: 50, width: 100, height: 100 };

  let roiProcessor: ROIProcessor;

  beforeEach(() => {
    roiProcessor = new ROIProcessor();
  });

  it('should crop and resize a frame in Node.js', async () => {
    const mockBuffer = Buffer.from('mock-buffer-data');
    const resizedBuffer = Buffer.from('resized-buffer-data');

    const extractMock = jest.fn().mockReturnThis();
    const resizeMock = jest.fn().mockReturnThis();
    const toBufferMock = jest.fn().mockResolvedValue(resizedBuffer);

    (sharp as jest.Mock).mockImplementation(() => ({
      extract: extractMock,
      resize: resizeMock,
      toBuffer: toBufferMock,
    }));

    const result = await roiProcessor.cropAndResize(mockBuffer, roi, 40, 40);

    expect(sharp).toHaveBeenCalledWith(mockBuffer);
    expect(extractMock).toHaveBeenCalledWith({
      left: roi.x,
      top: roi.y,
      width: roi.width,
      height: roi.height,
    });
    expect(resizeMock).toHaveBeenCalledWith(40, 40);
    expect(toBufferMock).toHaveBeenCalled();
    expect(result).toEqual(resizedBuffer);
  });

  it('should throw an error if sharp fails', async () => {
    const mockBuffer = Buffer.from('mock-buffer-data');

    (sharp as jest.Mock).mockImplementation(() => ({
      extract: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockRejectedValue(new Error('Test Error')),
    }));

    await expect(roiProcessor.cropAndResize(mockBuffer, roi, 40, 40)).rejects.toThrow('Test Error');
  });

  it('should throw an error if used in a browser context', () => {
    // Simulate browser environment
    jest.spyOn(global, 'document', 'get').mockImplementation(() => ({} as Document));

    expect(() =>
      roiProcessor.cropAndResize('mock-base64-data', roi, 40, 40)
    ).toThrow('Browser context detected. Use the browser-specific implementation.');
  });
});
