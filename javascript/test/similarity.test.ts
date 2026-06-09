import { describe, it, expect } from 'vitest';
import { ratio } from '../src/similarity.js';

// Expected values mirror Python's difflib.SequenceMatcher(None, a, b).ratio().
describe('ratio (difflib SequenceMatcher port)', () => {
  it('returns 1 for identical strings', () => {
    expect(ratio('morning blend', 'morning blend')).toBe(1);
  });

  it('returns 1 for two empty strings', () => {
    expect(ratio('', '')).toBe(1);
  });

  it('returns 0 for no overlap', () => {
    expect(ratio('abc', 'xyz')).toBe(0);
  });

  it('matches difflib canonical case abcd/bcde = 0.75', () => {
    // longest block "bcd" (3) → 2*3/8
    expect(ratio('abcd', 'bcde')).toBeCloseTo(0.75, 10);
  });

  it('matches difflib for a one-char insertion (26/27)', () => {
    // "morning blend" vs "morning blends": 13 matched of 27 total
    expect(ratio('morning blend', 'morning blends')).toBeCloseTo(26 / 27, 10);
  });

  it('crosses the 0.65 fuzzy threshold for a close title, not a distant one', () => {
    expect(ratio('cold brew', 'cold brewer')).toBeGreaterThan(0.65);
    expect(ratio('cold brew', 'espresso')).toBeLessThan(0.65);
  });
});
