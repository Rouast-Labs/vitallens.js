/**
 * Whether an HRV metric may be shown. HRV is only shown when it is confident itself and
 * heart rate is confident too: users should not see an HRV without a heart rate.
 * Keep this rule in sync with the other VitalLens SDKs.
 * @param hrvConf - Confidence of the HRV metric.
 * @param hrConf - Confidence of the heart rate.
 * @param hrvThreshold - Minimum HRV confidence.
 * @param hrThreshold - Minimum heart rate confidence.
 * @returns `true` if the HRV metric may be shown.
 */
export function isHrvShown(
  hrvConf: number | undefined,
  hrConf: number | undefined,
  hrvThreshold: number,
  hrThreshold: number
): boolean {
  if (hrvConf === undefined || hrConf === undefined) return false;
  return hrvConf >= hrvThreshold && hrConf >= hrThreshold;
}
