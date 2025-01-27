import * as tf from "@tensorflow/tfjs-core";
import {
  mergeFrames,
  uint8ArrayToBase64,
  float32ArrayToBase64,
  movingAverageSizeForResponse,
  applyMovingAverage,
  getActualSizeFromRawData,
} from "../../src/utils/arrayOps";
import { Frame } from "../../src/processing/Frame";

describe("mergeFrames", () => {
  it("throws an error when merging an empty array", async () => {
    await expect(mergeFrames([])).rejects.toThrow("Cannot merge an empty array of frames.");
  });

  it("merges frames correctly", async () => {
    const frame1 = await Frame.fromTensor(tf.tensor([1, 2]), [1], [{ x: 0, y: 0, width: 2, height: 2 }]);
    const frame2 = await Frame.fromTensor(tf.tensor([3, 4]), [2], [{ x: 1, y: 1, width: 2, height: 2 }]);

    const result = await mergeFrames([frame1, frame2]);

    expect(result.getTimestamp()).toEqual([1, 2]);
    expect(result.getROI()).toEqual([{ x: 0, y: 0, width: 2, height: 2 }, { x: 1, y: 1, width: 2, height: 2 }]);

    const resultTensor = result.getTensor();
    expect(resultTensor.arraySync()).toEqual([[1, 2], [3, 4]]);
    resultTensor.dispose();
  });
});

describe("uint8ArrayToBase64", () => {
  it("encodes a Uint8Array to Base64 correctly", () => {
    const input = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const base64 = uint8ArrayToBase64(input);
    expect(base64).toBe("SGVsbG8=");
  });
});

describe("float32ArrayToBase64", () => {
  it("encodes and decodes a Float32Array correctly", () => {
    const input = new Float32Array([1.23, -4.56, 7.89, 0]);
    const encoded = float32ArrayToBase64(input);
    expect(encoded.length).toBe(24);
  });
});

describe("movingAverageSizeForResponse", () => {
  it("calculates the correct moving average size", () => {
    const result = movingAverageSizeForResponse(30, 4);
    expect(result).toEqual(3);
  });

  it("throws an error for invalid cutoff frequency", () => {
    expect(() => movingAverageSizeForResponse(100, 0)).toThrow("Cutoff frequency must be greater than zero.");
  });
});

describe("applyMovingAverage", () => {
  it("returns the same array for window size 1", () => {
    const data = [1, 2, 3, 4, 5];
    const result = applyMovingAverage(data, 1);
    expect(result).toEqual(data);
  });

  it("applies moving average correctly", () => {
    const data = [1, 2, 3, 4, 5];
    const result = applyMovingAverage(data, 3);
    expect(result).toEqual([1, 1.5, 2, 3, 4]);
  });
});

describe("getActualSizeFromRawData", () => {
  it("calculates size for uint8 data", () => {
    const buffer = new ArrayBuffer(8);
    const result = getActualSizeFromRawData(buffer, "uint8" as tf.DataType);
    expect(result).toBe(8);
  });

  it("calculates size for int32 data", () => {
    const buffer = new ArrayBuffer(16);
    const result = getActualSizeFromRawData(buffer, "int32");
    expect(result).toBe(4);
  });

  it("calculates size for float32 data", () => {
    const buffer = new ArrayBuffer(16);
    const result = getActualSizeFromRawData(buffer, "float32");
    expect(result).toBe(4);
  });

  it("throws an error for unsupported dtype", () => {
    const buffer = new ArrayBuffer(8);
    expect(() => getActualSizeFromRawData(buffer, "unknown" as any)).toThrow("Unsupported dtype: unknown");
  });
});
