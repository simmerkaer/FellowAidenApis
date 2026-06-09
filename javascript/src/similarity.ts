/**
 * Port of Python's `difflib.SequenceMatcher(None, a, b).ratio()` — the
 * Ratcliff/Obershelp "gestalt pattern matching" ratio used by the Python
 * `fellow-aiden` library for fuzzy title matching.
 *
 * Returns a value in [0, 1]: 2 * (total matched chars) / (len(a) + len(b)).
 * The autojunk heuristic (only relevant for sequences ≥ 200 elements) is
 * omitted, which does not affect short strings like profile titles.
 */
export function ratio(a: string, b: string): number {
  const total = a.length + b.length;
  if (total === 0) return 1;

  // Map each character in b to the list of indices where it occurs.
  const b2j = new Map<string, number[]>();
  for (let j = 0; j < b.length; j++) {
    const ch = b[j]!;
    const list = b2j.get(ch);
    if (list) list.push(j);
    else b2j.set(ch, [j]);
  }

  const matched = countMatches(a, b2j, 0, a.length, 0, b.length);
  return (2 * matched) / total;
}

function findLongestMatch(
  a: string,
  b2j: Map<string, number[]>,
  alo: number,
  ahi: number,
  blo: number,
  bhi: number,
): { besti: number; bestj: number; bestsize: number } {
  let besti = alo;
  let bestj = blo;
  let bestsize = 0;
  let j2len = new Map<number, number>();

  for (let i = alo; i < ahi; i++) {
    const newj2len = new Map<number, number>();
    const indices = b2j.get(a[i]!);
    if (indices) {
      for (const j of indices) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) ?? 0) + 1;
        newj2len.set(j, k);
        if (k > bestsize) {
          besti = i - k + 1;
          bestj = j - k + 1;
          bestsize = k;
        }
      }
    }
    j2len = newj2len;
  }

  return { besti, bestj, bestsize };
}

function countMatches(
  a: string,
  b2j: Map<string, number[]>,
  alo: number,
  ahi: number,
  blo: number,
  bhi: number,
): number {
  const { besti, bestj, bestsize } = findLongestMatch(a, b2j, alo, ahi, blo, bhi);
  if (bestsize === 0) return 0;
  return (
    bestsize +
    countMatches(a, b2j, alo, besti, blo, bestj) +
    countMatches(a, b2j, besti + bestsize, ahi, bestj + bestsize, bhi)
  );
}
