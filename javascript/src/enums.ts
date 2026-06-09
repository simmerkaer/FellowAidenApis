/**
 * Allowed-value sets for profile parameters, generated to mirror the
 * constraints enforced by the Python `fellow-aiden` Pydantic models.
 */

/**
 * Build an inclusive list of values from `min` to `max` in `step` increments.
 * Floating point is rounded to avoid representation drift (e.g. 50.50000001).
 */
export function range(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  const decimals = (step.toString().split('.')[1] ?? '').length;
  const factor = 10 ** decimals;
  for (let v = min; v <= max + step / 2; v += step) {
    values.push(Math.round(v * factor) / factor);
  }
  return values;
}

/** Brew-to-water ratios: 14 → 20 in 0.5 steps. */
export const RATIO_VALUES = range(14, 20, 0.5);

/** Bloom ratios: 1, 1.5, 2, 2.5, 3. */
export const BLOOM_RATIO_VALUES = range(1, 3, 0.5);

/** Temperatures in °C: 50 → 98.5 in 0.5 steps. */
export const TEMPERATURE_VALUES = range(50, 98.5, 0.5);

/** Days of the week, in the order the API expects (Sunday first). */
export const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

/** Fields the server manages; stripped from profile payloads before send. */
export const SERVER_SIDE_PROFILE_FIELDS = [
  'id',
  'createdAt',
  'deletedAt',
  'lastUsedTime',
  'sharedFrom',
  'isDefaultProfile',
  'instantBrew',
  'folder',
  'duration',
  'lastGBQuantity',
] as const;
