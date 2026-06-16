import { Link } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { db } from '../../db/database';
import type { Plant } from '../../db/schema';
import { Card } from '../ui/Card';
import { DateBadge } from '../ui/DateBadge';
import { formatWateringStatus } from '../../utils/watering';

interface PlantDetailPanelProps {
  plant: Plant;
}

export function PlantDetailPanel({ plant }: PlantDetailPanelProps) {
  const related = useLiveQuery(
    async () => {
      // Gather the plant's notebook trail in parallel for the detail page.
      const [blooms, photos, pruning, watering] = await Promise.all([
        db.bloomRecords.where('plantId').equals(plant.id).reverse().sortBy('date'),
        db.photoEntries.where('plantId').equals(plant.id).reverse().sortBy('date'),
        db.pruningNotes.where('plantId').equals(plant.id).reverse().sortBy('date'),
        db.wateringSchedules.where('plantId').equals(plant.id).first(),
      ]);
      return { blooms, photos, pruning, watering };
    },
    [plant.id],
  );

  return (
    <div className="plant-detail">
      <header className="page-header">
        <h1>{plant.commonName}</h1>
        <p className="botanical-name">{plant.botanicalName}</p>
      </header>

      <div className="grid-2">
        <Card>
          <h3>Specimen Details</h3>
          {plant.family && (
            <p>
              <strong>Family:</strong> {plant.family}
            </p>
          )}
          {plant.location && (
            <p>
              <strong>Location:</strong> {plant.location}
            </p>
          )}
          {plant.plantedDate && (
            <p>
              <strong>Planted:</strong> {plant.plantedDate}
            </p>
          )}
          {plant.notes && <p>{plant.notes}</p>}
          {related?.watering && (
            <p>
              <strong>Watering:</strong>{' '}
              <span className="tag">{formatWateringStatus(related.watering)}</span>
            </p>
          )}
        </Card>

        <Card>
          <h3>Linked Records</h3>
          <ul className="linked-records">
            <li>
              <Link to="/blooms">Bloom records</Link>: {related?.blooms.length ?? 0}
            </li>
            <li>
              <Link to="/photos">Photos</Link>: {related?.photos.length ?? 0}
            </li>
            <li>
              <Link to="/pruning">Pruning notes</Link>: {related?.pruning.length ?? 0}
            </li>
            <li>
              <Link to="/maps">Garden map</Link>
            </li>
          </ul>
        </Card>
      </div>

      {related && related.blooms.length > 0 && (
        <>
          <div className="divider-botanical">Recent blooms</div>
          <div className="grid-2">
            {related.blooms.slice(0, 3).map((bloom) => (
              <Card key={bloom.id} className={bloom.intensity === 'peak' ? 'card--peak' : ''}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <DateBadge date={bloom.date} />
                  <div>
                    {bloom.intensity && (
                      <span className={`tag ${bloom.intensity === 'peak' ? 'tag--peak' : ''}`}>
                        {bloom.intensity}
                      </span>
                    )}
                    {bloom.notes && <p>{bloom.notes}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
