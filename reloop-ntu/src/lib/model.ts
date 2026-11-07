/*
  Simulation models used across the prototype.
  Every number produced here is ILLUSTRATIVE. The structure follows the group's slides;
  the constants are placeholders the pilot is meant to replace with measured values.
*/

export type Pool = 'halal' | 'general' | 'veg';

export const POOL_LABEL: Record<Pool, string> = {
  halal: 'Halal',
  general: 'Non-halal',
  veg: 'Vegetarian',
};

/** Safeguard timeline from the "Safeguards" slide (An Qi). */
export const RULES = {
  reminderHours: 48, // reminder on the NTU pass app 48 h after borrowing
  graceHours: 48, // 2 more days of grace
  fee: 20, // S$20 if still not returned
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------------ */
/* Break-even (LCA) model                                              */
/* ------------------------------------------------------------------ */

/**
 * Probability a container survives one full loop (comes back AND passes inspection).
 * returnRate: share of borrows that come back at all (0..1)
 * damageRate: share of returned containers retired at inspection (0..1)
 */
export const survivalPerLoop = (returnRate: number, damageRate: number) => returnRate * (1 - damageRate);

/** Expected number of uses before a container is lost or retired (geometric distribution). */
export const expectedLifetimeUses = (returnRate: number, damageRate: number) => {
  const s = survivalPerLoop(returnRate, damageRate);
  return s >= 0.99999 ? Infinity : 1 / (1 - s);
};

/** Share of containers that are still in service after k uses. */
export const shareSurviving = (k: number, returnRate: number, damageRate: number) =>
  Math.pow(survivalPerLoop(returnRate, damageRate), k);

export interface Material {
  id: string;
  name: string;
  breakEven: number; // uses needed to beat a disposable (illustrative, within the 4–200+ LCA range)
  unitCost: number; // S$ per container (illustrative)
}

export const MATERIALS: Material[] = [
  { id: 'pp', name: 'Light PP box', breakEven: 20, unitCost: 1.8 },
  { id: 'tritan', name: 'Heavy-duty PP', breakEven: 50, unitCost: 4.5 },
  { id: 'steel', name: 'Stainless steel', breakEven: 150, unitCost: 12 },
];

/** Return rate as a function of the number of return points (diminishing returns). Illustrative. */
export const returnRateForPoints = (points: number) => {
  const lo = 0.6;
  const hi = 0.975;
  return lo + (hi - lo) * (1 - Math.exp(-points / 3.1));
};

/** Pool split used when fleets are separated (halal / non-halal / vegetarian). */
export const POOL_SPLITS: Record<number, number[]> = {
  1: [1],
  2: [0.6, 0.4],
  3: [0.55, 0.33, 0.12],
};

export const WASH = {
  rack: 50, // containers per wash run (assumed batch washer)
  litresPerRun: 20,
  kwhPerRun: 2.6,
  collectionsPerDay: 3, // containers reach the hub in three waves (after lunch, afternoon, after dinner)
};

/** Wash runs per day when each pool must be washed in its own batch. */
export const washRunsPerDay = (dailyReturns: number, pools: number) => {
  const split = POOL_SPLITS[pools] ?? [1];
  const perWave = dailyReturns / WASH.collectionsPerDay;
  let runs = 0;
  for (const share of split) runs += Math.max(1, Math.ceil((perWave * share) / WASH.rack)) * WASH.collectionsPerDay;
  return runs;
};

/** Reserve stock grows with each separate pool, because each needs its own buffer. */
export const fleetSize = (dailyBorrows: number, pools: number) => {
  const turnaroundDays = 1.6; // borrow -> eat -> return -> collect -> wash -> back on shelf
  const inLoop = dailyBorrows * turnaroundDays;
  const reservePerPool = 0.22; // 22% buffer per pool
  const split = POOL_SPLITS[pools] ?? [1];
  return Math.round(split.reduce((acc, share) => acc + inLoop * share * (1 + reservePerPool) + 30, 0));
};

/* ------------------------------------------------------------------ */
/* Collection model ("Why collection breaks")                          */
/* ------------------------------------------------------------------ */

export const BIN_CAPACITY = 60; // containers per return-point bin

/** Collection trips per day for a given number of points. */
export const collectionTrips = (points: number, dailyReturns: number, mode: 'fixed' | 'full') => {
  if (mode === 'fixed') return points * 4; // 10:00, 13:00, 16:00, 19:00 rounds at every point
  // collect when full, but at least once a day per point (odour and pests: nothing sits overnight)
  const weights = Array.from({ length: points }, (_, i) => 1 / (i + 1.5)); // busier points first
  const wsum = weights.reduce((a, b) => a + b, 0);
  return weights.reduce((acc, w) => acc + Math.max(1, Math.ceil((dailyReturns * w) / wsum / (BIN_CAPACITY * 0.8))), 0);
};

/** Average fill of a bin at the moment it is emptied. */
export const avgFillAtPickup = (points: number, dailyReturns: number, mode: 'fixed' | 'full') =>
  clamp(dailyReturns / collectionTrips(points, dailyReturns, mode) / BIN_CAPACITY, 0, 1);

/* ------------------------------------------------------------------ */
/* Return-point fill over a day (operations console)                   */
/* ------------------------------------------------------------------ */

/** Cumulative share of a day's returns that have arrived by `hour` (8..20). Lunch and dinner peaks. */
export const cumulativeReturns = (hour: number) => {
  const pdf = (h: number) =>
    0.15 + 2.6 * Math.exp(-((h - 13.2) ** 2) / 1.4) + 1.3 * Math.exp(-((h - 18.6) ** 2) / 1.1) + 0.5 * Math.exp(-((h - 10) ** 2) / 1.2);
  let total = 0;
  let upto = 0;
  for (let h = 8; h <= 20; h += 0.05) {
    const v = pdf(h) * 0.05;
    total += v;
    if (h <= hour) upto += v;
  }
  return upto / total;
};

export const fmtHour = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm === 60 ? 0 : mm).padStart(2, '0')}`;
};

export const fmtMoney = (v: number) => `S$${v.toLocaleString('en-SG', { maximumFractionDigits: v < 100 ? 2 : 0, minimumFractionDigits: v < 100 ? 2 : 0 })}`;
