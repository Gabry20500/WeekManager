import type { WeightEntry } from "../models/types";
import { shiftDate } from "../utils/helpers";

/** A weigh-in with the average of the `AVERAGE_DAYS` days ending on it. */
export type WeightPoint = WeightEntry & { average: number };

/**
 * Window of the moving average. Two weeks, because the weight is logged about
 * twice a week: a shorter window would average only one or two weigh-ins.
 */
export const AVERAGE_DAYS = 14;
export const MIN_KG = 20;
export const MAX_KG = 400;

/** Adds a weigh-in, replacing the one of the same day; result sorted by date. */
export function upsertWeight(entries: WeightEntry[], entry: WeightEntry): WeightEntry[] {
  return [...entries.filter((item) => item.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Pairs each weigh-in with the mean of the weigh-ins in the window ending on
 * it. Daily weight swings by a kilo or more, so the trend is read on this
 * average rather than on single values. `entries` must be sorted by date.
 */
export function withMovingAverage(entries: WeightEntry[]): WeightPoint[] {
  let start = 0;
  let sum = 0;
  return entries.map((entry, index) => {
    sum += entry.kg;
    const windowStart = shiftDate(entry.date, -(AVERAGE_DAYS - 1));
    while (entries[start]!.date < windowStart) sum -= entries[start++]!.kg;
    return { ...entry, average: sum / (index - start + 1) };
  });
}

/**
 * Change of the moving average over the last `days`, or `undefined` when
 * there is no weigh-in at least that old to compare with.
 */
export function averageChange(points: WeightPoint[], days: number): number | undefined {
  const latest = points.at(-1);
  if (!latest) return undefined;
  const cutoff = shiftDate(latest.date, -days);
  const reference = points.findLast((point) => point.date <= cutoff);
  return reference ? latest.average - reference.average : undefined;
}

/** Points from the last `days` days before the latest weigh-in; all of them when `days` is undefined. */
export function lastDays(points: WeightPoint[], days: number | undefined): WeightPoint[] {
  const latest = points.at(-1);
  if (!latest || days === undefined) return points;
  const cutoff = shiftDate(latest.date, -days);
  return points.filter((point) => point.date > cutoff);
}
