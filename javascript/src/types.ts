export type { CoffeeProfile } from './schemas/profile.js';
export type { CoffeeSchedule } from './schemas/schedule.js';
export type {
  DeviceConfig,
  Profile,
  Schedule,
  LoginResponse,
} from './schemas/device.js';

/** Options for constructing a {@link FellowAiden} client. */
export interface FellowAidenOptions {
  email: string;
  password: string;
  /** Override the API base URL (mainly for testing). */
  baseUrl?: string;
  /** Override the User-Agent header. */
  userAgent?: string;
  /** Max retries for transient HTTP failures. Default 3. */
  maxRetries?: number;
  /** Inject a fetch implementation (mainly for testing). */
  fetch?: typeof globalThis.fetch;
}

export interface RefreshOptions {
  /** Bypass the cache and re-fetch from the API. */
  refresh?: boolean;
}
