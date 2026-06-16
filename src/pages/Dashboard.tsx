import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { db } from '../db/database';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { useWateringSchedules } from '../hooks/useWateringReminders';
import { usePlants } from '../hooks/usePlants';
import { formatWateringStatus } from '../utils/watering';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DateBadge } from '../components/ui/DateBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { getPlantLabel } from '../components/ui/PlantPicker';

export function Dashboard() {
  const plants = usePlants() ?? [];
  const schedules = useWateringSchedules() ?? [];
  // Keep dashboard alerts focused on schedules that are both due and enabled.
  const dueWatering = schedules.filter((s) => s.due && s.enabled);

  // Dashboard strips intentionally show only the latest activity.
  const recentBlooms =
    useLiveQuery(() => db.bloomRecords.orderBy('date').reverse().limit(5).toArray(), []) ??
    [];

  const recentPhotos =
    useLiveQuery(() => db.photoEntries.orderBy('date').reverse().limit(5).toArray(), []) ??
    [];

  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  if (plants.length === 0) {
    return (
      <>
        <header className="page-header">
          <h1>Today&apos;s Field Observations</h1>
          <p>{today}</p>
        </header>
        <EmptyState
          title="Welcome, botanist"
          description="Your field notebook awaits. Begin by cataloguing the specimens in your garden."
          action={
            <Link to="/plants">
              <Button>Open Herbarium</Button>
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <h1>Today&apos;s Field Observations</h1>
        <p>{today}</p>
      </header>

      <div className="page-actions">
        <Link to="/plants">
          <Button variant="secondary">+ Specimen</Button>
        </Link>
        <Link to="/blooms">
          <Button variant="secondary">+ Bloom</Button>
        </Link>
        <Link to="/photos">
          <Button variant="secondary">+ Photo</Button>
        </Link>
        <Link to="/pruning">
          <Button variant="secondary">+ Pruning Note</Button>
        </Link>
        <Link to="/maps">
          <Button variant="secondary">Garden Maps</Button>
        </Link>
      </div>

      <div className="grid-2">
        <Card className={dueWatering.length > 0 ? 'card--due' : ''}>
          <h3>💧 Watering Due</h3>
          {dueWatering.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--color-ink-muted)' }}>
              All specimens sufficiently watered — well done.
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {dueWatering.map((s) => (
                <li key={s.id}>
                  <strong>{s.plant?.commonName}</strong>{' '}
                  <span className="tag tag--due">{formatWateringStatus(s)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="card-actions">
            <Link to="/watering">
              <Button variant="ghost">View All Schedules</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <h3>🌸 Herbarium</h3>
          <p>
            <strong>{plants.length}</strong> specimen{plants.length === 1 ? '' : 's'}{' '}
            catalogued
          </p>
          <div className="card-actions">
            <Link to="/plants">
              <Button variant="ghost">Browse Herbarium</Button>
            </Link>
          </div>
        </Card>
      </div>

      {recentBlooms.length > 0 && (
        <>
          <div className="divider-botanical">Recent blooms</div>
          <div className="timeline-strip">
            {recentBlooms.map((bloom) => (
              <Card key={bloom.id} className={`timeline-item ${bloom.intensity === 'peak' ? 'card--peak' : ''}`}>
                <DateBadge date={bloom.date} />
                <p style={{ margin: '0.5rem 0 0' }}>
                  <strong>{getPlantLabel(plants, bloom.plantId)}</strong>
                </p>
                {bloom.intensity && (
                  <span className={`tag ${bloom.intensity === 'peak' ? 'tag--peak' : ''}`}>
                    {bloom.intensity}
                  </span>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {recentPhotos.length > 0 && (
        <>
          <div className="divider-botanical">Latest photographs</div>
          <div className="timeline-strip">
            {recentPhotos.map((photo) => (
              <Card key={photo.id} className="timeline-item">
                <DateBadge date={photo.date} />
                <p style={{ margin: '0.5rem 0 0' }}>
                  <strong>{getPlantLabel(plants, photo.plantId)}</strong>
                </p>
                {photo.caption && <p className="handwritten">{photo.caption}</p>}
              </Card>
            ))}
          </div>
          <div className="card-actions" style={{ marginTop: '1rem' }}>
            <Link to="/photos">
              <Button variant="ghost">View Photo Timeline</Button>
            </Link>
          </div>
        </>
      )}
    </>
  );
}
