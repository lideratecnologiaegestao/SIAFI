/**
 * Adds N months to a date, clamping to the last valid day of the target month.
 *
 * Native JS Date.setMonth() overflows: Jan 31 + 1 month = Mar 3 (not Feb 28).
 * This function avoids that by resetting to day 1, advancing the month,
 * then restoring the original day clamped to the last day of the target month.
 */
export function addMonthsSafe(base: Date, months: number): Date {
  const result = new Date(base);
  const targetMonth = result.getMonth() + months;
  const targetYear = result.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const day = Math.min(base.getDate(), lastDayOfTargetMonth);

  result.setFullYear(targetYear, normalizedMonth, day);
  return result;
}
