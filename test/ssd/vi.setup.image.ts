import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import { Frame } from '../../src/processing/Frame';

export function getTestImageFrame(): Frame {
  const filePath = path.resolve(__dirname, '../../examples/sample_image_1.png');
  const buffer = fs.readFileSync(filePath);

  // Pure JS decoding
  const png = PNG.sync.read(buffer);

  // Convert RGBA to RGB (dropping the alpha channel)
  const { width, height, data } = png;
  const rgbData = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    rgbData[i * 3] = data[i * 4]; // R
    rgbData[i * 3 + 1] = data[i * 4 + 1]; // G
    rgbData[i * 3 + 2] = data[i * 4 + 2]; // B
  }

  const imageTensor = tf.tensor3d(rgbData, [height, width, 3], 'int32');
  const frame = Frame.fromTensor(imageTensor, false, [0]);
  imageTensor.dispose();
  return frame;
}
