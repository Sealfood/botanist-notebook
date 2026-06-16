import Dexie, { type EntityTable } from 'dexie';
import type {
  BloomRecord,
  GardenMap,
  MapPlacement,
  PhotoBlob,
  PhotoEntry,
  Plant,
  PruningNote,
  WateringSchedule,
} from './schema';

export class BotanistDatabase extends Dexie {
  plants!: EntityTable<Plant, 'id'>;
  gardenMaps!: EntityTable<GardenMap, 'id'>;
  mapPlacements!: EntityTable<MapPlacement, 'id'>;
  bloomRecords!: EntityTable<BloomRecord, 'id'>;
  wateringSchedules!: EntityTable<WateringSchedule, 'id'>;
  photoEntries!: EntityTable<PhotoEntry, 'id'>;
  photoBlobs!: EntityTable<PhotoBlob, 'key'>;
  pruningNotes!: EntityTable<PruningNote, 'id'>;

  constructor() {
    super('botanist-notebook');
    // Indexed fields mirror the queries used throughout the app.
    this.version(1).stores({
      plants: 'id, commonName, botanicalName, createdAt',
      gardenMaps: 'id, name',
      mapPlacements: 'id, mapId, plantId',
      bloomRecords: 'id, plantId, date',
      wateringSchedules: 'id, plantId, enabled',
      photoEntries: 'id, plantId, date, blobKey',
      photoBlobs: 'key',
      pruningNotes: 'id, plantId, date',
    });
  }
}

export const db = new BotanistDatabase();

export async function savePhotoBlob(file: File): Promise<string> {
  const key = crypto.randomUUID();
  // Keep photo binaries out of record tables so entries stay lightweight.
  await db.photoBlobs.put({ key, blob: file });
  return key;
}

export async function getPhotoUrl(blobKey: string): Promise<string | null> {
  const record = await db.photoBlobs.get(blobKey);
  if (!record) return null;
  // Callers own the returned object URL and should revoke it when done.
  return URL.createObjectURL(record.blob);
}

export async function deletePhotoBlob(blobKey: string): Promise<void> {
  await db.photoBlobs.delete(blobKey);
}
