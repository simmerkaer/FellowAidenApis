import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FellowAiden } from '../src/index.js';
import { AuthError, ValidationError, FellowAidenError } from '../src/errors.js';

const BASE = 'https://api.test/v1';

const validProfile = {
  profileType: 0,
  title: 'Morning Blend',
  ratio: 16,
  bloomEnabled: true,
  bloomRatio: 2,
  bloomDuration: 30,
  bloomTemperature: 96,
  ssPulsesEnabled: true,
  ssPulsesNumber: 3,
  ssPulsesInterval: 20,
  ssPulseTemperatures: [96, 96.5],
  batchPulsesEnabled: false,
  batchPulsesNumber: 1,
  batchPulsesInterval: 10,
  batchPulseTemperatures: [95],
};

interface Recorded {
  method: string;
  path: string;
  body: any;
}

/**
 * Build a fake API. `handlers` maps "METHOD /path" (path without query) to a
 * handler returning [status, body]. Records every call.
 */
function fakeServer(handlers: Record<string, (body: any, path: string) => [number, unknown]>) {
  const calls: Recorded[] = [];
  const fetchImpl = vi.fn(async (urlStr: string, init?: RequestInit) => {
    const url = new URL(urlStr);
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace('/v1', '');
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method, path, body });
    const handler = handlers[`${method} ${path}`];
    if (!handler) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    const [status, respBody] = handler(body, path);
    return new Response(respBody === undefined ? '' : JSON.stringify(respBody), { status });
  });
  return { fetchImpl: fetchImpl as unknown as typeof globalThis.fetch, calls };
}

const authOk = (): [number, unknown] => [200, { accessToken: 'tok', refreshToken: 'ref' }];
const deviceList = (extra: Record<string, unknown> = {}): [number, unknown] => [
  200,
  [{ id: 'dev-1', displayName: 'Kitchen Aiden', ...extra }],
];

async function makeClient(handlers: Record<string, (body: any, path: string) => [number, unknown]>) {
  const base = {
    'POST /auth/login': authOk,
    'GET /devices': () => deviceList(),
  };
  const { fetchImpl, calls } = fakeServer({ ...base, ...handlers });
  const client = await FellowAiden.create({
    email: 'a@b.c',
    password: 'pw',
    baseUrl: BASE,
    fetch: fetchImpl,
  });
  return { client, calls };
}

describe('FellowAiden.create + auth', () => {
  it('authenticates, loads device, exposes name and id', async () => {
    const { client, calls } = await makeClient({});
    expect(client.getBrewerId()).toBe('dev-1');
    expect(client.getDisplayName()).toBe('Kitchen Aiden');
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/auth/login' });
    expect(calls[1]).toMatchObject({ method: 'GET', path: '/devices' });
  });

  it('throws AuthError on bad credentials', async () => {
    const { fetchImpl } = fakeServer({ 'POST /auth/login': () => [401, { error: 'bad' }] });
    await expect(
      FellowAiden.create({ email: 'a@b.c', password: 'pw', baseUrl: BASE, fetch: fetchImpl }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('throws when account has no devices', async () => {
    const { fetchImpl } = fakeServer({ 'POST /auth/login': authOk, 'GET /devices': () => [200, []] });
    await expect(
      FellowAiden.create({ email: 'a@b.c', password: 'pw', baseUrl: BASE, fetch: fetchImpl }),
    ).rejects.toThrow(/No devices/);
  });
});

describe('profiles', () => {
  it('lists and caches profiles (single network call)', async () => {
    const { client, calls } = await makeClient({
      'GET /devices/dev-1/profiles': () => [200, [{ id: 'p1', title: 'House' }]],
    });
    await client.getProfiles();
    await client.getProfiles();
    const profileCalls = calls.filter((c) => c.path === '/devices/dev-1/profiles' && c.method === 'GET');
    expect(profileCalls).toHaveLength(1);
  });

  it('finds a profile by exact title (case-insensitive) and fuzzy', async () => {
    const { client } = await makeClient({
      'GET /devices/dev-1/profiles': () => [
        200,
        [
          { id: 'p1', title: 'Morning Blend' },
          { id: 'p2', title: 'Cold Brewer' },
        ],
      ],
    });
    expect((await client.getProfileByTitle('morning blend'))?.id).toBe('p1');
    expect(await client.getProfileByTitle('nope')).toBeNull();
    expect((await client.getProfileByTitle('cold brew', { fuzzy: true }))?.id).toBe('p2');
    expect(await client.getProfileByTitle('cold brew', { fuzzy: false })).toBeNull();
  });

  it('creates a profile, stripping unknown fields and posting clean body', async () => {
    const { client, calls } = await makeClient({
      'POST /devices/dev-1/profiles': () => [200, { id: 'p9', title: 'Morning Blend' }],
    });
    const created = await client.createProfile({ ...validProfile, extra: 'x' } as any);
    expect(created.id).toBe('p9');
    const post = calls.find((c) => c.method === 'POST' && c.path === '/devices/dev-1/profiles');
    expect(post!.body).not.toHaveProperty('extra');
    expect(post!.body).toMatchObject({ title: 'Morning Blend', ratio: 16 });
  });

  it('rejects creating a profile that already has an id', async () => {
    const { client } = await makeClient({});
    await expect(client.createProfile({ ...validProfile, id: 'p1' } as any)).rejects.toThrow(
      /already has an id/,
    );
  });

  it('rejects an invalid profile with ValidationError', async () => {
    const { client } = await makeClient({});
    await expect(client.createProfile({ ...validProfile, ratio: 99 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('deletes a profile by id', async () => {
    const { client, calls } = await makeClient({
      'DELETE /devices/dev-1/profiles/p1': () => [200, undefined],
    });
    await client.deleteProfileById('p1');
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/devices/dev-1/profiles/p1')).toBe(
      true,
    );
  });

  it('generates a share link', async () => {
    const { client } = await makeClient({
      'POST /devices/dev-1/profiles/p1/share': () => [200, { link: 'https://brew.link/p/abc123' }],
    });
    await expect(client.generateShareLink('p1')).resolves.toBe('https://brew.link/p/abc123');
  });
});

describe('shared links', () => {
  it('parses a brew link, fetches the shared profile, strips server fields', async () => {
    const { client } = await makeClient({
      'GET /shared/abc123': () => [200, { ...validProfile, id: 'p5', createdAt: 'x', folder: 'f' }],
    });
    const data = await client.parseBrewLinkUrl('https://brew.link/p/abc123');
    expect(data).not.toHaveProperty('id');
    expect(data).not.toHaveProperty('createdAt');
    expect(data).not.toHaveProperty('folder');
    expect(data).toMatchObject({ title: 'Morning Blend' });
  });

  it('parses a bare id', async () => {
    const { client } = await makeClient({
      'GET /shared/xyz': () => [200, { ...validProfile }],
    });
    await expect(client.parseBrewLinkUrl('xyz')).resolves.toMatchObject({ title: 'Morning Blend' });
  });

  it('creates a profile from a link end-to-end', async () => {
    const { client, calls } = await makeClient({
      'GET /shared/abc123': () => [200, { ...validProfile, id: 'p5' }],
      'POST /devices/dev-1/profiles': () => [200, { id: 'p10', title: 'Morning Blend' }],
    });
    const created = await client.createProfileFromLink('https://brew.link/p/abc123');
    expect(created.id).toBe('p10');
    const post = calls.find((c) => c.method === 'POST' && c.path === '/devices/dev-1/profiles');
    expect(post!.body).not.toHaveProperty('id');
  });
});

describe('schedules', () => {
  const validSchedule = {
    days: [false, true, true, true, true, true, false],
    secondFromStartOfTheDay: 25200,
    enabled: true,
    amountOfWater: 300,
    profileId: 'p3',
  };

  it('creates a schedule', async () => {
    const { client } = await makeClient({
      'POST /devices/dev-1/schedules': () => [200, { id: 's1' }],
    });
    await expect(client.createSchedule(validSchedule)).resolves.toMatchObject({ id: 's1' });
  });

  it('rejects an invalid schedule', async () => {
    const { client } = await makeClient({});
    await expect(client.createSchedule({ ...validSchedule, amountOfWater: 5 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('toggles an existing schedule and rejects unknown ones', async () => {
    const { client, calls } = await makeClient({
      'GET /devices/dev-1/schedules': () => [200, [{ id: 's1' }]],
      'PATCH /devices/dev-1/schedules/s1': () => [200, undefined],
    });
    await client.toggleSchedule('s1', false);
    const patch = calls.find((c) => c.method === 'PATCH' && c.path === '/devices/dev-1/schedules/s1');
    expect(patch!.body).toEqual({ enabled: false });
    await expect(client.toggleSchedule('does-not-exist', true)).rejects.toThrow(/does not exist/);
  });

  it('deletes an existing schedule', async () => {
    const { client, calls } = await makeClient({
      'GET /devices/dev-1/schedules': () => [200, [{ id: 's1' }]],
      'DELETE /devices/dev-1/schedules/s1': () => [200, undefined],
    });
    await client.deleteScheduleById('s1');
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/devices/dev-1/schedules/s1')).toBe(
      true,
    );
  });
});

describe('adjustSetting', () => {
  it('PATCHes the device with a single setting', async () => {
    const { client, calls } = await makeClient({
      'PATCH /devices/dev-1': () => [200, undefined],
    });
    await client.adjustSetting('displayName', 'New Name');
    const patch = calls.find((c) => c.method === 'PATCH' && c.path === '/devices/dev-1');
    expect(patch!.body).toEqual({ displayName: 'New Name' });
  });
});

describe('construction', () => {
  it('requires email and password', () => {
    expect(() => new FellowAiden({ email: '', password: '' })).toThrow(FellowAidenError);
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
