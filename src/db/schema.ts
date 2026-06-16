export interface Plant {
  id: string;
  commonName: string;
  botanicalName: string;
  family?: string;
  location?: string;
  plantedDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Bed {
  id: string;
  label: string;
  shape: 'rect' | 'circle' | 'u' | 'polygon';
  coords: number[];
  rotation?: number;
}

export interface GardenMap {
  id: string;
  name: string;
  width: number;
  height: number;
  beds: Bed[];
  backgroundPhotoKey?: string;
}

export interface MapPlacement {
  id: string;
  mapId: string;
  plantId: string;
  x: number;
  y: number;
}

export interface BloomRecord {
  id: string;
  plantId: string;
  date: string;
  intensity?: 'light' | 'peak' | 'fading';
  notes?: string;
}

export interface WateringSchedule {
  id: string;
  plantId: string;
  intervalDays: number;
  lastWatered?: string;
  enabled: boolean;
}

export interface PhotoEntry {
  id: string;
  plantId: string;
  date: string;
  caption?: string;
  blobKey: string;
}

export interface PruningNote {
  id: string;
  plantId: string;
  date: string;
  action: string;
  notes?: string;
  beforePhotoKey?: string;
  afterPhotoKey?: string;
}

export interface PhotoBlob {
  key: string;
  blob: Blob;
}

export type BloomIntensity = BloomRecord['intensity'];
