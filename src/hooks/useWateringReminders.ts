import { useCallback, useEffect, useRef } from 'react';
import { db } from '../db/database';
import type { Plant, WateringSchedule } from '../db/schema';
import { isWateringDue } from '../utils/watering';
import { useLiveQuery } from './useLiveQuery';

export interface WateringReminder extends WateringSchedule {
  plant?: Plant;
  due: boolean;
}

export function useWateringSchedules() {
  return useLiveQuery(async () => {
    const schedules = await db.wateringSchedules.toArray();
    const plants = await db.plants.toArray();
    const plantMap = new Map(plants.map((p) => [p.id, p]));

    return schedules
      .map((schedule) => ({
        ...schedule,
        plant: plantMap.get(schedule.plantId),
        due: isWateringDue(schedule),
      }))
      .sort((a, b) => {
        if (a.due && !b.due) return -1;
        if (!a.due && b.due) return 1;
        return (a.plant?.commonName ?? '').localeCompare(b.plant?.commonName ?? '');
      }) as WateringReminder[];
  }, []);
}

export function useNotifications() {
  const notifiedRef = useRef<Set<string>>(new Set());

  const checkAndNotify = useCallback(async () => {
    if (Notification.permission !== 'granted') return;

    const schedules = await db.wateringSchedules.toArray();
    const plants = await db.plants.toArray();
    const plantMap = new Map(plants.map((p) => [p.id, p]));

    for (const schedule of schedules) {
      if (!isWateringDue(schedule)) continue;
      if (notifiedRef.current.has(schedule.id)) continue;

      const plant = plantMap.get(schedule.plantId);
      if (!plant) continue;

      new Notification('Watering reminder', {
        body: `${plant.commonName} (${plant.botanicalName}) is due for watering.`,
        icon: '/favicon.svg',
      });
      notifiedRef.current.add(schedule.id);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(checkAndNotify, 60_000);
    checkAndNotify();
    return () => clearInterval(interval);
  }, [checkAndNotify]);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'unsupported' as const;
    if (Notification.permission === 'granted') return 'granted' as const;
    if (Notification.permission === 'denied') return 'denied' as const;
    const result = await Notification.requestPermission();
    return result;
  }, []);

  return { requestPermission, checkAndNotify };
}

export async function markWatered(scheduleId: string): Promise<void> {
  await db.wateringSchedules.update(scheduleId, {
    lastWatered: new Date().toISOString().slice(0, 10),
  });
}

export async function upsertWateringSchedule(
  plantId: string,
  data: Partial<Pick<WateringSchedule, 'intervalDays' | 'enabled' | 'lastWatered'>>,
): Promise<void> {
  const existing = await db.wateringSchedules.where('plantId').equals(plantId).first();
  if (existing) {
    await db.wateringSchedules.update(existing.id, data);
  } else {
    await db.wateringSchedules.add({
      id: crypto.randomUUID(),
      plantId,
      intervalDays: data.intervalDays ?? 3,
      enabled: data.enabled ?? true,
      lastWatered: data.lastWatered,
    });
  }
}
