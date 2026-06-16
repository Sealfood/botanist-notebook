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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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

  // Calendar date selection narrows the records section without changing the plant filter.
  const visibleBloomGroups = useMemo(() => {
    if (!selectedDate) return Array.from(bloomsByDate.entries());
    const selectedBlooms = bloomsByDate.get(selectedDate);
    return selectedBlooms ? [[selectedDate, selectedBlooms] as [string, BloomRecord[]]] : [];
  }, [bloomsByDate, selectedDate]);

  const openLogBloomModal = (date = format(new Date(), 'yyyy-MM-dd')) => {
    // Seed plantId so the picker cannot look selected while form state is empty.
    setForm({
      plantId: filterPlantId || plants[0]?.id || '',
      date,
      intensity: 'peak',
      notes: '',
    });
    setModalOpen(true);
  };

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

  const handleCalendarDateClick = (date: string) => {
    // Clicking the selected date again returns the record list to its full view.
    setSelectedDate((currentDate) => (currentDate === date ? null : date));
  };

  return (
    <>
      <header className="page-header">
        <h1>Bloom Tracker</h1>
        <p>Record flowering dates and intensity throughout the seasons</p>
      </header>

      <div className="page-actions">
        <Button onClick={() => openLogBloomModal()}>Log Bloom</Button>
      </div>

      <div className="bloom-filters">
        <PlantPicker
          value={filterPlantId}
          onChange={(id) => {
            setFilterPlantId(id);
            setSelectedDate(null);
          }}
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
                // Keep the calendar compact; the full list lives below the calendar.
                const visibleBlooms = dayBlooms.slice(0, 2);
                const hiddenBloomCount = dayBlooms.length - visibleBlooms.length;
                return (
                  <button
                    type="button"
                    key={key}
                    className={`bloom-calendar__day ${dayBlooms.length ? 'bloom-calendar__day--has-bloom' : ''} ${selectedDate === key ? 'bloom-calendar__day--selected' : ''}`}
                    onClick={() => handleCalendarDateClick(key)}
                    title={
                      dayBlooms.length
                        ? dayBlooms.map((b) => getPlantLabel(plants, b.plantId)).join(', ')
                        : `Show bloom records for ${key}`
                    }
                    aria-label={`Show bloom records for ${format(day, 'MMMM d, yyyy')}`}
                  >
                    <span className="bloom-calendar__date">{format(day, 'd')}</span>
                    {dayBlooms.length === 1 && (
                      <span
                        className={`bloom-intensity-chip bloom-intensity-chip--${dayBlooms[0].intensity ?? 'light'}`}
                      >
                        {getPlantLabel(plants, dayBlooms[0].plantId)}
                      </span>
                    )}
                    {dayBlooms.length > 1 && (
                      <span className="bloom-day-list" aria-hidden="true">
                        {visibleBlooms.map((bloom) => (
                          <span
                            key={bloom.id}
                            className={`bloom-day-list__item ${bloom.intensity ? `bloom-day-list__item--${bloom.intensity}` : ''}`}
                          >
                            {getPlantLabel(plants, bloom.plantId)}
                          </span>
                        ))}
                        {hiddenBloomCount > 0 && (
                          <span className="bloom-day-list__more">
                            +{hiddenBloomCount} more
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="divider-botanical">Bloom records</div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No blooms recorded"
              description="Log your first flowering observation for the season."
              action={<Button onClick={() => openLogBloomModal()}>Log Bloom</Button>}
            />
          ) : selectedDate && visibleBloomGroups.length === 0 ? (
            <EmptyState
              title="No blooms on this date"
              description={`No bloom records are logged for ${selectedDate}.`}
              action={
                <Button variant="secondary" onClick={() => setSelectedDate(null)}>
                  Show All Records
                </Button>
              }
            />
          ) : (
            <div className="bloom-record-groups">
              {selectedDate && (
                <div className="bloom-record-groups__actions">
                  <Button variant="secondary" onClick={() => setSelectedDate(null)}>
                    Show All Records
                  </Button>
                </div>
              )}
              {visibleBloomGroups.map(([date, dateBlooms]) => (
                <details key={date} className="bloom-record-group">
                  <summary className="bloom-record-group__summary">
                    <DateBadge date={date} />
                    <span className="bloom-record-group__title">
                      {dateBlooms.length === 1
                        ? '1 bloom record'
                        : `${dateBlooms.length} bloom records`}
                    </span>
                  </summary>
                  <div className="grid-2 bloom-record-group__records">
                    {dateBlooms.map((bloom) => (
                      <Card
                        key={bloom.id}
                        className={bloom.intensity === 'peak' ? 'card--peak' : ''}
                      >
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
                      </Card>
                    ))}
                  </div>
                </details>
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
