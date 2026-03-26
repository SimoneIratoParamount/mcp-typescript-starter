/**
 * Rush hour heuristics for the "Popular times" chart (no external API).
 */

export interface RushStatus {
  level: 'low' | 'medium' | 'high';
  label: string;
  color: string;
  bg: string;
}

/**
 * Returns relative busyness (0–10) for a given hour of the day (0–23)
 * based on a typical sit-down restaurant pattern.
 */
export function busynessAt(hour: number, isWeekend: boolean): number {
  const weekday: Record<number, number> = {
    9: 1,
    10: 2,
    11: 4,
    12: 9,
    13: 10,
    14: 7,
    15: 3,
    16: 2,
    17: 4,
    18: 8,
    19: 10,
    20: 9,
    21: 6,
    22: 3,
  };
  const weekend: Record<number, number> = {
    9: 2,
    10: 4,
    11: 6,
    12: 8,
    13: 9,
    14: 8,
    15: 6,
    16: 4,
    17: 5,
    18: 7,
    19: 10,
    20: 10,
    21: 7,
    22: 4,
  };
  return (isWeekend ? weekend : weekday)[hour] ?? 0;
}

export function getRushStatus(): RushStatus {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const t = h + m / 60;

  const lunchStart = isWeekend ? 12 : 11.5;
  const lunchEnd = isWeekend ? 14.5 : 14;
  if (t >= lunchStart && t < lunchEnd)
    return { level: 'high', label: 'Lunch rush', color: '#c5221f', bg: '#fce8e6' };
  if (t >= 18 && t < 21)
    return { level: 'high', label: 'Dinner rush', color: '#c5221f', bg: '#fce8e6' };
  if ((t >= 11 && t < lunchStart) || (t >= 17 && t < 18))
    return { level: 'medium', label: 'Getting busier', color: '#b45309', bg: '#fef3c7' };

  return { level: 'low', label: 'Usually not busy', color: '#188038', bg: '#e6f4ea' };
}
