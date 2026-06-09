import { z } from 'zod';
import { RATIO_VALUES, BLOOM_RATIO_VALUES, TEMPERATURE_VALUES } from '../enums.js';

const ratioSet = new Set(RATIO_VALUES);
const bloomRatioSet = new Set(BLOOM_RATIO_VALUES);
const temperatureSet = new Set(TEMPERATURE_VALUES);

const oneOf = (set: Set<number>, label: string) =>
  z.number().refine((v) => set.has(v), {
    message: `must be one of the allowed ${label} values`,
  });

const temperature = oneOf(temperatureSet, 'temperature');

/** Title: max 50 chars, restricted character set (mirrors the Python regex). */
const title = z
  .string()
  .max(50, 'title must be at most 50 characters')
  .regex(
    /^[A-Za-z0-9 !@#$%&*\-+?/.,:)(]+$/,
    'title contains unsupported characters',
  );

/**
 * Coffee brewing profile. Mirrors the Python `CoffeeProfile` Pydantic model;
 * all fields are required.
 */
export const CoffeeProfileSchema = z
  .object({
    profileType: z.number().int(),
    title,
    ratio: oneOf(ratioSet, 'ratio'),
    bloomEnabled: z.boolean(),
    bloomRatio: oneOf(bloomRatioSet, 'bloom ratio'),
    bloomDuration: z.number().int().min(1).max(120),
    bloomTemperature: temperature,
    ssPulsesEnabled: z.boolean(),
    ssPulsesNumber: z.number().int().min(1).max(10),
    ssPulsesInterval: z.number().int().min(5).max(60),
    ssPulseTemperatures: z.array(temperature),
    batchPulsesEnabled: z.boolean(),
    batchPulsesNumber: z.number().int().min(1).max(10),
    batchPulsesInterval: z.number().int().min(5).max(60),
    batchPulseTemperatures: z.array(temperature),
  });

export type CoffeeProfile = z.infer<typeof CoffeeProfileSchema>;
