import { z } from 'zod';

/**
 * Brew schedule. Mirrors the Python `CoffeeSchedule` Pydantic model.
 */
export const CoffeeScheduleSchema = z.object({
  /** Exactly 7 booleans, Sunday → Saturday. */
  days: z
    .array(z.boolean())
    .length(7, 'days must contain exactly 7 booleans (Sunday → Saturday)'),
  /** Seconds since the start of the day the brew should begin (0–86399). */
  secondFromStartOfTheDay: z.number().int().min(0).max(86399),
  enabled: z.boolean(),
  /** Water amount in millilitres (150–1500). */
  amountOfWater: z.number().int().min(150).max(1500),
  /** Profile id: `p<number>` (cloud) or `plocal<number>` (local). */
  profileId: z
    .string()
    .regex(/^p(local)?\d+$/, "profileId must match 'p<number>' or 'plocal<number>'"),
});

export type CoffeeSchedule = z.infer<typeof CoffeeScheduleSchema>;
