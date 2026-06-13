import { format, subDays } from 'date-fns';
import { db } from './database';
import type { Bed, BloomRecord, GardenMap, MapPlacement, Plant, WateringSchedule } from './schema';
import { newId } from '../utils/id';

const SEED_KEY = 'botanist-notebook-seeded';

export async function seedDatabaseIfEmpty(): Promise<void> {
  if (localStorage.getItem(SEED_KEY)) return;

  const count = await db.plants.count();
  if (count > 0) {
    localStorage.setItem(SEED_KEY, 'true');
    return;
  }

  const today = format(new Date(), 'yyyy-MM-dd');

  const plants: Plant[] = [
    {
      id: newId(),
      commonName: 'Apothecary Rose',
      botanicalName: 'Rosa gallica',
      family: 'Rosaceae',
      location: 'East border bed',
      plantedDate: '1884-04-12',
      notes: 'Deep crimson blooms; prized for attar of roses.',
      createdAt: today,
    },
    {
      id: newId(),
      commonName: 'Foxglove',
      botanicalName: 'Digitalis purpurea',
      family: 'Plantaginaceae',
      location: 'Shaded north wall',
      plantedDate: '1885-05-03',
      notes: 'Biennial; self-seeds freely along the stone path.',
      createdAt: today,
    },
    {
      id: newId(),
      commonName: 'English Lavender',
      botanicalName: 'Lavandula angustifolia',
      family: 'Lamiaceae',
      location: 'Herb parterre',
      plantedDate: '1883-06-18',
      notes: 'Trim after flowering to maintain compact habit.',
      createdAt: today,
    },
    {
      id: newId(),
      commonName: 'Peony',
      botanicalName: 'Paeonia officinalis',
      family: 'Paeoniaceae',
      location: 'Central rose bed',
      plantedDate: '1882-09-22',
      notes: 'Herbaceous; supports required when in full bloom.',
      createdAt: today,
    },
  ];

  await db.plants.bulkAdd(plants);

  const bloomRecords: BloomRecord[] = [
    {
      id: newId(),
      plantId: plants[0].id,
      date: subDays(new Date(), 5).toISOString().slice(0, 10),
      intensity: 'peak',
      notes: 'Fragrant, fully open.',
    },
    {
      id: newId(),
      plantId: plants[1].id,
      date: subDays(new Date(), 12).toISOString().slice(0, 10),
      intensity: 'light',
      notes: 'Lower spikes opening first.',
    },
    {
      id: newId(),
      plantId: plants[2].id,
      date: subDays(new Date(), 2).toISOString().slice(0, 10),
      intensity: 'peak',
    },
  ];

  await db.bloomRecords.bulkAdd(bloomRecords);

  const wateringSchedules: WateringSchedule[] = plants.map((plant, i) => ({
    id: newId(),
    plantId: plant.id,
    intervalDays: [3, 5, 4, 7][i],
    lastWatered: subDays(new Date(), [2, 6, 1, 3][i]).toISOString().slice(0, 10),
    enabled: true,
  }));

  await db.wateringSchedules.bulkAdd(wateringSchedules);

  const beds: Bed[] = [
    {
      id: newId(),
      label: 'East Border',
      shape: 'rect',
      coords: [40, 40, 280, 120],
    },
    {
      id: newId(),
      label: 'Herb Parterre',
      shape: 'rect',
      coords: [40, 180, 200, 320],
    },
    {
      id: newId(),
      label: 'Central Bed',
      shape: 'rect',
      coords: [240, 180, 480, 320],
    },
  ];

  const gardenMap: GardenMap = {
    id: newId(),
    name: 'Kitchen Garden, 1887',
    width: 520,
    height: 380,
    beds,
  };

  await db.gardenMaps.add(gardenMap);

  const placements: MapPlacement[] = [
    { id: newId(), mapId: gardenMap.id, plantId: plants[0].id, x: 160, y: 80 },
    { id: newId(), mapId: gardenMap.id, plantId: plants[1].id, x: 420, y: 250 },
    { id: newId(), mapId: gardenMap.id, plantId: plants[2].id, x: 120, y: 250 },
    { id: newId(), mapId: gardenMap.id, plantId: plants[3].id, x: 360, y: 250 },
  ];

  await db.mapPlacements.bulkAdd(placements);

  localStorage.setItem(SEED_KEY, 'true');
}
