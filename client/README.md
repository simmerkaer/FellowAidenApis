# fellow-aiden (JavaScript / TypeScript)

[![npm version](https://img.shields.io/npm/v/fellow-aiden.svg)](https://www.npmjs.com/package/fellow-aiden)
[![npm downloads](https://img.shields.io/npm/dm/fellow-aiden.svg)](https://www.npmjs.com/package/fellow-aiden)
[![license](https://img.shields.io/npm/l/fellow-aiden.svg)](./LICENSE)

A TypeScript client for the [Fellow Aiden](https://fellowproducts.com/) coffee
brewer's cloud API. A faithful port of the Python library
[`9b/fellow-aiden`](https://github.com/9b/fellow-aiden).

> Unofficial — not affiliated with or endorsed by Fellow.

## Other implementations

| Language | Package | Repository |
| --- | --- | --- |
| **TypeScript / JavaScript** (this package) | [`fellow-aiden`](https://www.npmjs.com/package/fellow-aiden) (npm) | [fellow-aiden-ts](https://github.com/simmerkaer/fellow-aiden-ts) |
| .NET | [`FellowAiden`](https://www.nuget.org/packages/FellowAiden) (NuGet) | [fellow-aiden-dotnet](https://github.com/simmerkaer/fellow-aiden-dotnet) |
| Python | _planned_ | — |

## Install

```sh
npm install fellow-aiden
```

Requires Node 18+ (uses the built-in global `fetch`). Ships ESM + CommonJS
builds and TypeScript declarations.

## Quick start

```ts
import { FellowAiden } from 'fellow-aiden';

// Authentication is async, so use the static factory:
const aiden = await FellowAiden.create({
  email: process.env.FELLOW_EMAIL!,
  password: process.env.FELLOW_PASSWORD!,
});

console.log(aiden.getDisplayName(), aiden.getBrewerId());

const profiles = await aiden.getProfiles();
```

## API

### Construction & auth
- `FellowAiden.create(options)` — construct, authenticate, and load the device.
- `new FellowAiden(options)` then `await client.authenticate()` — manual flow.
- `authenticate()` — (re)log in; also called automatically once on a `401`.

`options`: `{ email, password, baseUrl?, userAgent?, maxRetries?, fetch? }`.

### Device
- `getDisplayName(): string | null`
- `getBrewerId(): string | null`
- `getDeviceConfig({ refresh? }): Promise<DeviceConfig>`
- `adjustSetting(setting, value): Promise<unknown>`

### Profiles
- `getProfiles({ refresh? }): Promise<Profile[]>`
- `getProfileByTitle(title, { fuzzy? }): Promise<Profile | null>` — exact
  (case-insensitive) by default; `fuzzy` uses a difflib-equivalent ratio > 0.65.
- `createProfile(data): Promise<Profile>` — validated against `CoffeeProfileSchema`.
- `updateProfile(profileId, data): Promise<Profile>`
- `deleteProfileById(profileId): Promise<void>`
- `generateShareLink(profileId): Promise<string>`
- `parseBrewLinkUrl(link): Promise<Record<string, unknown>>`
- `createProfileFromLink(link): Promise<Profile>`

### Schedules
- `getSchedules({ refresh? }): Promise<Schedule[]>`
- `createSchedule(data): Promise<Schedule>` — validated against `CoffeeScheduleSchema`.
- `toggleSchedule(scheduleId, enabled): Promise<unknown>`
- `deleteScheduleById(scheduleId): Promise<void>`

### Validation

Profile and schedule inputs are validated with [Zod](https://zod.dev) schemas
that mirror the Python Pydantic models. Allowed `ratio`/temperature values are
exported (`RATIO_VALUES`, `TEMPERATURE_VALUES`, `BLOOM_RATIO_VALUES`). Invalid
input throws a `ValidationError`; API failures throw `ApiError`; auth failures
throw `AuthError`. All extend `FellowAidenError`.

### Profile fields

```ts
{
  profileType: number;            // int
  title: string;                  // ≤ 50 chars, restricted charset
  ratio: number;                  // 14–20 step 0.5
  bloomEnabled: boolean;
  bloomRatio: number;             // 1, 1.5, 2, 2.5, 3
  bloomDuration: number;          // 1–120
  bloomTemperature: number;       // 50–98.5 step 0.5 (°C)
  ssPulsesEnabled: boolean;
  ssPulsesNumber: number;         // 1–10
  ssPulsesInterval: number;       // 5–60
  ssPulseTemperatures: number[];  // each 50–98.5 step 0.5
  batchPulsesEnabled: boolean;
  batchPulsesNumber: number;      // 1–10
  batchPulsesInterval: number;    // 5–60
  batchPulseTemperatures: number[];
}
```

### Schedule fields

```ts
{
  days: boolean[];                // exactly 7, Sunday → Saturday
  secondFromStartOfTheDay: number;// 0–86399
  enabled: boolean;
  amountOfWater: number;          // 150–1500 (ml)
  profileId: string;              // "p<n>" or "plocal<n>"
}
```

## Development

```sh
npm install
npm test          # vitest (fully mocked, no network)
npm run typecheck # tsc --noEmit
npm run build     # tsup → dist/ (ESM + CJS + .d.ts)
```

See [`examples/basic-usage.ts`](./examples/basic-usage.ts) for a runnable example.

## Releasing

Releases are published to npm by CI via
[trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, no
token) when a `vX.Y.Z` tag is pushed. To cut one:

```sh
npm run release            # patch: 0.1.1 → 0.1.2
npm run release -- minor   # 0.1.1 → 0.2.0
npm run release -- major   # 0.1.1 → 1.0.0
```

This bumps the version, commits, tags `vX.Y.Z`, and pushes — which triggers
[`release.yml`](../.github/workflows/release.yml) to build, test, and publish
with provenance.

## License

MIT. Inspired by the GPL-3.0 Python project `9b/fellow-aiden`; this is an
independent reimplementation written against the observed HTTP API.
