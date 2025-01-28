import * as fs from 'fs';
import * as path from 'path';
import * as tf from '@tensorflow/tfjs-node';
import { Frame } from '../../src/processing/Frame';

/**
 * Loads the test.png file from disk and returns a Frame instance.
 * @returns A Frame instance with the loaded test image.
 */
export function getTestImageFrame(): Frame {
  const filePath = path.resolve(__dirname, '../../examples/test.png');
  const buffer = fs.readFileSync(filePath);
  const imageTensor = tf.node.decodeImage(new Uint8Array(buffer), 3);
  const frame = Frame.fromTensor(imageTensor, [0]);
  imageTensor.dispose();
  return frame;
}
