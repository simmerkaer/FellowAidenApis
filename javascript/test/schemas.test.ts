import { describe, it, expect } from 'vitest';
import { CoffeeProfileSchema } from '../src/schemas/profile.js';
import { CoffeeScheduleSchema } from '../src/schemas/schedule.js';
import { range, RATIO_VALUES, TEMPERATURE_VALUES } from '../src/enums.js';

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

describe('range', () => {
  it('generates inclusive half steps without float drift', () => {
    expect(range(1, 3, 0.5)).toEqual([1, 1.5, 2, 2.5, 3]);
    expect(RATIO_VALUES[0]).toBe(14);
    expect(RATIO_VALUES.at(-1)).toBe(20);
    expect(TEMPERATURE_VALUES).toContain(98.5);
    expect(TEMPERATURE_VALUES).not.toContain(99);
    // no drift
    expect(TEMPERATURE_VALUES.every((v) => Number.isInteger(v * 2))).toBe(true);
  });
});

describe('CoffeeProfileSchema', () => {
  it('accepts a valid profile', () => {
    expect(CoffeeProfileSchema.parse(validProfile)).toMatchObject({ title: 'Morning Blend' });
  });

  it('strips unknown (server-managed) fields rather than rejecting', () => {
    const parsed = CoffeeProfileSchema.parse({ ...validProfile, id: 'p7', createdAt: 'x' });
    expect(parsed).not.toHaveProperty('id');
    expect(parsed).not.toHaveProperty('createdAt');
  });

  it('rejects an out-of-range ratio', () => {
    expect(() => CoffeeProfileSchema.parse({ ...validProfile, ratio: 13 })).toThrow();
  });

  it('rejects a temperature off the half-step grid', () => {
    expect(() => CoffeeProfileSchema.parse({ ...validProfile, bloomTemperature: 96.2 })).toThrow();
  });

  it('rejects a title that is too long', () => {
    expect(() => CoffeeProfileSchema.parse({ ...validProfile, title: 'x'.repeat(51) })).toThrow();
  });

  it('rejects unsupported title characters', () => {
    expect(() => CoffeeProfileSchema.parse({ ...validProfile, title: 'Bad\ttitle' })).toThrow();
  });

  it('rejects a pulse temperature off-grid', () => {
    expect(() =>
      CoffeeProfileSchema.parse({ ...validProfile, ssPulseTemperatures: [96, 200] }),
    ).toThrow();
  });
});

const validSchedule = {
  days: [false, true, true, true, true, true, false],
  secondFromStartOfTheDay: 7 * 3600,
  enabled: true,
  amountOfWater: 300,
  profileId: 'p3',
};

describe('CoffeeScheduleSchema', () => {
  it('accepts a valid schedule', () => {
    expect(CoffeeScheduleSchema.parse(validSchedule)).toMatchObject({ amountOfWater: 300 });
  });

  it('accepts a plocal profile id', () => {
    expect(CoffeeScheduleSchema.parse({ ...validSchedule, profileId: 'plocal12' })).toBeTruthy();
  });

  it('rejects a wrong-length days array', () => {
    expect(() =>
      CoffeeScheduleSchema.parse({ ...validSchedule, days: [true, false] }),
    ).toThrow();
  });

  it('rejects water out of range', () => {
    expect(() => CoffeeScheduleSchema.parse({ ...validSchedule, amountOfWater: 100 })).toThrow();
    expect(() => CoffeeScheduleSchema.parse({ ...validSchedule, amountOfWater: 2000 })).toThrow();
  });

  it('rejects a bad profile id', () => {
    expect(() => CoffeeScheduleSchema.parse({ ...validSchedule, profileId: 'x9' })).toThrow();
  });

  it('rejects a second-of-day out of range', () => {
    expect(() =>
      CoffeeScheduleSchema.parse({ ...validSchedule, secondFromStartOfTheDay: 86400 }),
    ).toThrow();
  });
});
