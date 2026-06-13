import { useMemo, useState } from 'react';
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
  addMonths,
} from 'date-fns';
import { db } from '../db/database';
import type { BloomIntensity, BloomRecord } from '../db/schema';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { usePlants } from '../hooks/usePlants';
import { newId } from '../utils/id';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DateBadge } from '../components/ui/DateBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PlantPicker, getPlantLabel } from '../components/ui/PlantPicker';
import './BloomTracker.css';

export function BloomTracker() {
  const plants = usePlants() ?? [];
  const blooms =
    useLiveQuery(() => db.bloomRecords.orderBy('date').reverse().toArray(), []) ?? [];
  const [filterPlantId, setFilterPlantId] = useState('');
  const [month, setMonth] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    plantId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    intensity: 'peak' as BloomIntensity,
    notes: '',
  });

  const filtered = useMemo(() => {
    if (!filterPlantId) return blooms;
    return blooms.filter((b) => b.plantId === filterPlantId);
  }, [blooms, filterPlantId]);

  const monthDays = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const bloomsByDate = useMemo(() => {
    const map = new Map<string, BloomRecord[]>();
    for (const bloom of filtered) {
      const existing = map.get(bloom.date) ?? [];
      existing.push(bloom);
      map.set(bloom.date, existing);
    }
    return map;
  }, [filtered]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.plantId) return;
    await db.bloomRecords.add({
      id: newId(),
      plantId: form.plantId,
      date: form.date,
      intensity: form.intensity,
      notes: form.notes.trim() || undefined,
    });
    setModalOpen(false);
    setForm({
      plantId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      intensity: 'peak',
      notes: '',
    });
  };

  const deleteBloom = async (id: string) => {
    if (confirm('Remove this bloom record?')) {
      await db.bloomRecords.delete(id);
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>Bloom Tracker</h1>
        <p>Record flowering dates and intensity throughout the seasons</p>
      </header>

      <div className="page-actions">
        <Button onClick={() => setModalOpen(true)}>Log Bloom</Button>
      </div>

      <div className="bloom-filters">
        <PlantPicker
          value={filterPlantId}
          onChange={setFilterPlantId}
          allowEmpty
          emptyLabel="All specimens"
        />
      </div>

      {plants.length === 0 ? (
        <EmptyState
          title="No specimens to track"
          description="Catalogue plants in the herbarium before logging blooms."
        />
      ) : (
        <>
          <Card className="bloom-calendar">
            <div className="bloom-calendar__header">
              <Button variant="ghost" onClick={() => setMonth(subMonths(month, 1))}>
                ‹
              </Button>
              <h3>{format(month, 'MMMM yyyy')}</h3>
              <Button variant="ghost" onClick={() => setMonth(addMonths(month, 1))}>
                ›
              </Button>
            </div>
            <div className="bloom-calendar__grid">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d} className="bloom-calendar__dow">
                  {d}
                </div>
              ))}
              {Array.from({ length: monthDays[0].getDay() }).map((_, i) => (
                <div key={`pad-${i}`} className="bloom-calendar__day bloom-calendar__day--empty" />
              ))}
              {monthDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayBlooms = bloomsByDate.get(key) ?? [];
                const hasPeak = dayBlooms.some((b) => b.intensity === 'peak');
                return (
                  <div
                    key={key}
                    className={`bloom-calendar__day ${dayBlooms.length ? 'bloom-calendar__day--has-bloom' : ''} ${hasPeak ? 'bloom-calendar__day--peak' : ''}`}
                    title={dayBlooms.map((b) => getPlantLabel(plants, b.plantId)).join(', ')}
                  >
                    <span>{format(day, 'd')}</span>
                    {dayBlooms.length > 0 && (
                      <span className="bloom-dot">{dayBlooms.length}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="divider-botanical">Bloom records</div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No blooms recorded"
              description="Log your first flowering observation for the season."
              action={<Button onClick={() => setModalOpen(true)}>Log Bloom</Button>}
            />
          ) : (
            <div className="grid-2">
              {filtered.map((bloom) => (
                <Card
                  key={bloom.id}
                  className={bloom.intensity === 'peak' ? 'card--peak' : ''}
                >
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <DateBadge date={bloom.date} />
                    <div style={{ flex: 1 }}>
                      <h3>{getPlantLabel(plants, bloom.plantId)}</h3>
                      {bloom.intensity && (
                        <span
                          className={`tag ${bloom.intensity === 'peak' ? 'tag--peak' : ''}`}
                        >
                          {bloom.intensity}
                        </span>
                      )}
                      {bloom.notes && <p>{bloom.notes}</p>}
                      <Button variant="danger" onClick={() => deleteBloom(bloom.id)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Bloom">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Specimen</label>
            <PlantPicker
              value={form.plantId}
              onChange={(id) => setForm({ ...form, plantId: id })}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="bloomDate">Date</label>
            <Input
              id="bloomDate"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="intensity">Intensity</label>
            <Select
              id="intensity"
              value={form.intensity ?? 'peak'}
              onChange={(e) =>
                setForm({ ...form, intensity: e.target.value as BloomIntensity })
              }
            >
              <option value="light">Light</option>
              <option value="peak">Peak</option>
              <option value="fading">Fading</option>
            </Select>
          </div>
          <div className="form-row">
            <label htmlFor="bloomNotes">Notes</label>
            <Textarea
              id="bloomNotes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Record</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
