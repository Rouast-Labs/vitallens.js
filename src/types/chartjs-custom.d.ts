/* eslint-disable @typescript-eslint/no-unused-vars */
import 'chart.js';

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType = 'line'> {
    playbackDot?: {
      xValue: number;
      radius: number;
      lineWidth: number;
      strokeStyle: string;
    };
  }
}
