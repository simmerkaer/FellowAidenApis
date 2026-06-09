export { FellowAiden } from './client.js';

export {
  FellowAidenError,
  AuthError,
  ApiError,
  ValidationError,
} from './errors.js';

export { CoffeeProfileSchema } from './schemas/profile.js';
export { CoffeeScheduleSchema } from './schemas/schedule.js';

export {
  RATIO_VALUES,
  BLOOM_RATIO_VALUES,
  TEMPERATURE_VALUES,
  DAYS_OF_WEEK,
  SERVER_SIDE_PROFILE_FIELDS,
  range,
} from './enums.js';

export type { DayOfWeek } from './enums.js';
export type {
  FellowAidenOptions,
  RefreshOptions,
  CoffeeProfile,
  CoffeeSchedule,
  DeviceConfig,
  Profile,
  Schedule,
  LoginResponse,
} from './types.js';
