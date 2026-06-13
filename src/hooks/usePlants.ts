import { db } from '../db/database';
import type { Plant } from '../db/schema';
import { useLiveQuery } from './useLiveQuery';

export function usePlants() {
  return useLiveQuery(() => db.plants.orderBy('commonName').toArray(), []);
}

export function usePlant(id: string | undefined) {
  return useLiveQuery(
    () => (id ? db.plants.get(id) : Promise.resolve(undefined)),
    [id],
  );
}

export async function addPlant(
  data: Omit<Plant, 'id' | 'createdAt'>,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.plants.add({
    ...data,
    id,
    createdAt: new Date().toISOString().slice(0, 10),
  });
  return id;
}

export async function updatePlant(id: string, data: Partial<Plant>): Promise<void> {
  await db.plants.update(id, data);
}

export async function deletePlant(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.plants,
      db.bloomRecords,
      db.wateringSchedules,
      db.photoEntries,
      db.pruningNotes,
      db.mapPlacements,
    ],
    async () => {
      await db.bloomRecords.where('plantId').equals(id).delete();
      await db.wateringSchedules.where('plantId').equals(id).delete();
      await db.photoEntries.where('plantId').equals(id).delete();
      await db.pruningNotes.where('plantId').equals(id).delete();
      await db.mapPlacements.where('plantId').equals(id).delete();
      await db.plants.delete(id);
    },
  );
}
