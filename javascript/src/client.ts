import { HttpClient } from './http.js';
import { ApiError, AuthError, FellowAidenError, ValidationError } from './errors.js';
import { SERVER_SIDE_PROFILE_FIELDS } from './enums.js';
import { ratio } from './similarity.js';
import { CoffeeProfileSchema } from './schemas/profile.js';
import { CoffeeScheduleSchema } from './schemas/schedule.js';
import {
  LoginResponseSchema,
  DeviceListSchema,
  ProfileListSchema,
  ScheduleListSchema,
  ShareLinkResponseSchema,
  type DeviceConfig,
  type Profile,
  type Schedule,
} from './schemas/device.js';
import type { CoffeeProfile } from './schemas/profile.js';
import type { CoffeeSchedule } from './schemas/schedule.js';
import type { FellowAidenOptions, RefreshOptions } from './types.js';

const DEFAULT_BASE_URL = 'https://l8qtmnc692.execute-api.us-west-2.amazonaws.com/v1';
const DEFAULT_USER_AGENT = 'Fellow/5 CFNetwork/1568.300.101 Darwin/24.2.0';

const API = {
  auth: '/auth/login',
  devices: '/devices',
  device: (id: string) => `/devices/${id}`,
  profiles: (id: string) => `/devices/${id}/profiles`,
  profile: (id: string, pid: string) => `/devices/${id}/profiles/${pid}`,
  profileShare: (id: string, pid: string) => `/devices/${id}/profiles/${pid}/share`,
  sharedProfile: (bid: string) => `/shared/${bid}`,
  schedules: (id: string) => `/devices/${id}/schedules`,
  schedule: (id: string, sid: string) => `/devices/${id}/schedules/${sid}`,
} as const;

const FUZZY_THRESHOLD = 0.65;

/** Fuzzy/exact title match, mirroring the Python `difflib.SequenceMatcher` ratio. */
function similar(a: string, b: string): number {
  return ratio(a, b);
}

/**
 * Client for the Fellow Aiden coffee brewer cloud API.
 *
 * Because authentication is asynchronous, construct instances with the static
 * {@link FellowAiden.create} factory rather than `new`:
 *
 * ```ts
 * const aiden = await FellowAiden.create({ email, password });
 * console.log(aiden.getDisplayName());
 * ```
 */
export class FellowAiden {
  private readonly email: string;
  private readonly password: string;
  private readonly http: HttpClient;

  private token: string | null = null;
  private refreshToken: string | null = null;
  private deviceConfig: DeviceConfig | null = null;
  private brewerId: string | null = null;
  private profileCache: Profile[] | null = null;
  private scheduleCache: Schedule[] | null = null;

  constructor(options: FellowAidenOptions) {
    if (!options?.email || !options?.password) {
      throw new FellowAidenError('Both email and password are required.');
    }
    this.email = options.email;
    this.password = options.password;
    this.http = new HttpClient({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
      getToken: () => this.token,
      // On a 401, only re-acquire the token — do NOT reload the device, which
      // would issue another request that could 401 and recurse.
      reauthenticate: () => this.login(),
      maxRetries: options.maxRetries,
      fetch: options.fetch,
    });
  }

  /** Authenticate and load the brewer, returning a ready-to-use client. */
  static async create(options: FellowAidenOptions): Promise<FellowAiden> {
    const client = new FellowAiden(options);
    await client.authenticate();
    return client;
  }

  /** Log in (or re-authenticate) and refresh the bound device. */
  async authenticate(): Promise<void> {
    await this.login();
    await this.loadDevice();
  }

  /** Acquire (or refresh) the access token without touching device state. */
  private async login(): Promise<void> {
    let raw: unknown;
    try {
      raw = await this.http.post(API.auth, {
        body: { email: this.email, password: this.password },
        skipReauth: true,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        throw new AuthError('Email or password incorrect.');
      }
      throw err;
    }
    const parsed = LoginResponseSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.accessToken) {
      throw new AuthError('Email or password incorrect.');
    }
    this.token = parsed.data.accessToken;
    this.refreshToken = parsed.data.refreshToken ?? null;
  }

  /** Fetch the device list and bind to the first (single-brewer assumption). */
  private async loadDevice(): Promise<void> {
    const raw = await this.http.get(API.devices, { query: { dataType: 'real' } });
    const devices = DeviceListSchema.parse(raw);
    const device = devices[0];
    if (!device) {
      throw new FellowAidenError('No devices found on this account.');
    }
    this.deviceConfig = device;
    this.brewerId = device.id;
    this.profileCache = null;
    this.scheduleCache = null;
  }

  private requireBrewerId(): string {
    if (!this.brewerId) {
      throw new FellowAidenError('Not authenticated. Call authenticate() or use FellowAiden.create().');
    }
    return this.brewerId;
  }

  // --- Device ---------------------------------------------------------------

  /** The bound device's display name, or null if unset. */
  getDisplayName(): string | null {
    return this.deviceConfig?.displayName ?? null;
  }

  /** The bound device's id. */
  getBrewerId(): string | null {
    return this.brewerId;
  }

  /** The cached device config, optionally re-fetching first. */
  async getDeviceConfig(options: RefreshOptions = {}): Promise<DeviceConfig> {
    if (options.refresh || !this.deviceConfig) {
      await this.loadDevice();
    }
    return this.deviceConfig!;
  }

  /** Apply a single device setting via PATCH. Returns the raw response body. */
  async adjustSetting(setting: string, value: unknown): Promise<unknown> {
    const id = this.requireBrewerId();
    return this.http.patch(API.device(id), { body: { [setting]: value }, raw: true });
  }

  // --- Profiles -------------------------------------------------------------

  /** All profiles (lazy-loaded and cached). */
  async getProfiles(options: RefreshOptions = {}): Promise<Profile[]> {
    const id = this.requireBrewerId();
    if (options.refresh || this.profileCache === null) {
      const raw = await this.http.get(API.profiles(id));
      this.profileCache = ProfileListSchema.parse(raw);
    }
    return this.profileCache;
  }

  /**
   * Find a profile by title. Exact (case-insensitive) by default; with
   * `fuzzy: true`, returns the first profile whose similarity ratio exceeds
   * 0.65 (matching the Python library).
   */
  async getProfileByTitle(
    title: string,
    options: { fuzzy?: boolean } = {},
  ): Promise<Profile | null> {
    const target = title.toLowerCase();
    for (const profile of await this.getProfiles()) {
      const current = profile.title.toLowerCase();
      if (options.fuzzy && similar(current, target) > FUZZY_THRESHOLD) {
        return profile;
      }
      if (current === target) {
        return profile;
      }
    }
    return null;
  }

  /** Create a new profile. Validates input and strips server-managed fields. */
  async createProfile(data: CoffeeProfile | Record<string, unknown>): Promise<Profile> {
    if (isRecord(data) && 'id' in data) {
      throw new FellowAidenError('Cannot create a profile from data that already has an id.');
    }
    const id = this.requireBrewerId();
    const body = this.validateProfile(data);
    const raw = await this.http.post(API.profiles(id), { body });
    this.profileCache = null;
    return assertProfileResponse(raw);
  }

  /** Update an existing profile by id. */
  async updateProfile(
    profileId: string,
    data: CoffeeProfile | Record<string, unknown>,
  ): Promise<Profile> {
    const id = this.requireBrewerId();
    if (!(await this.isValidProfileId(profileId))) {
      throw new FellowAidenError(
        `Profile does not exist. Valid profiles: ${await this.profileIdList()}`,
      );
    }
    const body = this.validateProfile(data);
    const raw = await this.http.patch(API.profile(id, profileId), { body });
    await this.loadDevice();
    return assertProfileResponse(raw);
  }

  /** Delete a profile by id. */
  async deleteProfileById(profileId: string): Promise<void> {
    const id = this.requireBrewerId();
    await this.http.delete(API.profile(id, profileId), { raw: true });
    this.profileCache = null;
  }

  /** Generate a shareable link for a profile. */
  async generateShareLink(profileId: string): Promise<string> {
    const id = this.requireBrewerId();
    const raw = await this.http.post(API.profileShare(id, profileId));
    const parsed = ShareLinkResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new FellowAidenError(`Error generating share link: ${JSON.stringify(raw)}`);
    }
    return parsed.data.link;
  }

  /**
   * Extract a profile from a shared brew link (or bare id) and return its data
   * with server-managed fields removed. Does not create anything.
   */
  async parseBrewLinkUrl(link: string): Promise<Record<string, unknown>> {
    const match = /(?:.*?\/p\/)?([a-zA-Z0-9]+)\/?$/.exec(link);
    if (!match) {
      throw new FellowAidenError('Invalid profile URL or ID format.');
    }
    const brewId = match[1]!;
    const raw = await this.http.get(API.sharedProfile(brewId));
    if (!isRecord(raw)) {
      throw new FellowAidenError(`Failed to fetch profile (ID: ${brewId}).`);
    }
    return stripServerFields(raw);
  }

  /** Import a shared brew link and create it as a new profile. */
  async createProfileFromLink(link: string): Promise<Profile> {
    const data = await this.parseBrewLinkUrl(link);
    return this.createProfile(data);
  }

  // --- Schedules ------------------------------------------------------------

  /** All schedules (lazy-loaded and cached). */
  async getSchedules(options: RefreshOptions = {}): Promise<Schedule[]> {
    const id = this.requireBrewerId();
    if (options.refresh || this.scheduleCache === null) {
      const raw = await this.http.get(API.schedules(id));
      this.scheduleCache = ScheduleListSchema.parse(raw);
    }
    return this.scheduleCache;
  }

  /** Create a new schedule. */
  async createSchedule(data: CoffeeSchedule | Record<string, unknown>): Promise<Schedule> {
    if (isRecord(data) && 'id' in data) {
      throw new FellowAidenError('Cannot create a schedule from data that already has an id.');
    }
    const id = this.requireBrewerId();
    const body = this.validateSchedule(data);
    const raw = await this.http.post(API.schedules(id), { body });
    this.scheduleCache = null;
    return assertScheduleResponse(raw);
  }

  /** Enable or disable a schedule. */
  async toggleSchedule(scheduleId: string, enabled: boolean): Promise<unknown> {
    const id = this.requireBrewerId();
    if (!(await this.isValidScheduleId(scheduleId))) {
      throw new FellowAidenError(
        `Schedule does not exist. Valid schedules: ${await this.scheduleIdList()}`,
      );
    }
    const result = await this.http.patch(API.schedule(id, scheduleId), {
      body: { enabled },
      raw: true,
    });
    this.scheduleCache = null;
    return result;
  }

  /** Delete a schedule by id. */
  async deleteScheduleById(scheduleId: string): Promise<void> {
    const id = this.requireBrewerId();
    if (!(await this.isValidScheduleId(scheduleId))) {
      throw new FellowAidenError(
        `Schedule does not exist. Valid schedules: ${await this.scheduleIdList()}`,
      );
    }
    await this.http.delete(API.schedule(id, scheduleId), { raw: true });
    this.scheduleCache = null;
  }

  // --- Internals ------------------------------------------------------------

  private validateProfile(data: unknown): CoffeeProfile {
    const result = CoffeeProfileSchema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(result.error, 'Invalid coffee profile');
    }
    return result.data;
  }

  private validateSchedule(data: unknown): CoffeeSchedule {
    const result = CoffeeScheduleSchema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(result.error, 'Invalid schedule');
    }
    return result.data;
  }

  private async isValidProfileId(pid: string): Promise<boolean> {
    return (await this.getProfiles()).some((p) => p.id === pid);
  }

  private async profileIdList(): Promise<string> {
    return (await this.getProfiles()).map((p) => `${p.id} (${p.title})`).join(', ');
  }

  private async isValidScheduleId(sid: string): Promise<boolean> {
    return (await this.getSchedules()).some((s) => s.id === sid);
  }

  private async scheduleIdList(): Promise<string> {
    return (await this.getSchedules()).map((s) => s.id).join(', ');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripServerFields(data: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...data };
  for (const field of SERVER_SIDE_PROFILE_FIELDS) {
    delete copy[field];
  }
  return copy;
}

function assertProfileResponse(raw: unknown): Profile {
  if (!isRecord(raw) || typeof raw.id !== 'string') {
    throw new FellowAidenError(`Error creating/updating profile: ${JSON.stringify(raw)}`);
  }
  return raw as Profile;
}

function assertScheduleResponse(raw: unknown): Schedule {
  if (!isRecord(raw) || typeof raw.id !== 'string') {
    throw new FellowAidenError(`Error creating schedule: ${JSON.stringify(raw)}`);
  }
  return raw as Schedule;
}
