import { z } from 'zod';

/**
 * Response shapes from the Fellow API. These are intentionally lenient
 * (`.passthrough()`) — the API returns many fields we don't model, and we only
 * need to read a known subset while preserving the rest for callers.
 */

export const LoginResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
  })
  .passthrough();

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/** A single brewer device's configuration. */
export const DeviceConfigSchema = z
  .object({
    id: z.string(),
    displayName: z.string().nullish(),
  })
  .passthrough();

export type DeviceConfig = z.infer<typeof DeviceConfigSchema>;

export const DeviceListSchema = z.array(DeviceConfigSchema);

/** A profile as returned by the API (includes server-managed fields). */
export const ProfileSchema = z
  .object({
    id: z.string(),
    title: z.string(),
  })
  .passthrough();

export type Profile = z.infer<typeof ProfileSchema>;

export const ProfileListSchema = z.array(ProfileSchema);

/** A schedule as returned by the API. */
export const ScheduleSchema = z
  .object({
    id: z.string(),
  })
  .passthrough();

export type Schedule = z.infer<typeof ScheduleSchema>;

export const ScheduleListSchema = z.array(ScheduleSchema);

export const ShareLinkResponseSchema = z
  .object({
    link: z.string(),
  })
  .passthrough();
