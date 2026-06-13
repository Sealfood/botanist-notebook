import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { NotebookShell } from './components/layout/NotebookShell';
import { seedDatabaseIfEmpty } from './db/seed';
import { BloomTracker } from './pages/BloomTracker';
import { Dashboard } from './pages/Dashboard';
import { GardenMaps } from './pages/GardenMaps';
import { PhotoTimeline } from './pages/PhotoTimeline';
import { PlantDatabase, PlantDetail } from './pages/PlantDatabase';
import { PruningNotes } from './pages/PruningNotes';
import { WateringReminders } from './pages/WateringReminders';

export default function App() {
  useEffect(() => {
    seedDatabaseIfEmpty().catch(console.error);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<NotebookShell />}>
          <Route index element={<Dashboard />} />
          <Route path="plants" element={<PlantDatabase />} />
          <Route path="plants/:id" element={<PlantDetail />} />
          <Route path="maps" element={<GardenMaps />} />
          <Route path="blooms" element={<BloomTracker />} />
          <Route path="watering" element={<WateringReminders />} />
          <Route path="photos" element={<PhotoTimeline />} />
          <Route path="pruning" element={<PruningNotes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
