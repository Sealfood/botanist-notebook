import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import type { WateringSchedule } from '../db/schema';

export function getNextWaterDate(schedule: WateringSchedule): Date | null {
  if (!schedule.enabled) return null;
  // Unwatered schedules start counting from today instead of becoming overdue.
  const base = schedule.lastWatered
    ? startOfDay(parseISO(schedule.lastWatered))
    : startOfDay(new Date());
  return addDays(base, schedule.intervalDays);
}

export function getDaysUntilWatering(schedule: WateringSchedule): number {
  const next = getNextWaterDate(schedule);
  if (!next) return Infinity;
  return differenceInCalendarDays(startOfDay(next), startOfDay(new Date()));
}

export function isWateringDue(schedule: WateringSchedule): boolean {
  if (!schedule.enabled) return false;
  return getDaysUntilWatering(schedule) <= 0;
}

export function formatWateringStatus(schedule: WateringSchedule): string {
  if (!schedule.enabled) return 'Reminders off';
  const days = getDaysUntilWatering(schedule);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
