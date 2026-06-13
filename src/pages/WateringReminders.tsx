import { useState } from 'react';
import {
  markWatered,
  upsertWateringSchedule,
  useNotifications,
  useWateringSchedules,
} from '../hooks/useWateringReminders';
import { usePlants } from '../hooks/usePlants';
import { formatWateringStatus } from '../utils/watering';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PlantPicker } from '../components/ui/PlantPicker';
import { db } from '../db/database';

export function WateringReminders() {
  const schedules = useWateringSchedules() ?? [];
  const plants = usePlants() ?? [];
  const { requestPermission } = useNotifications();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    plantId: '',
    intervalDays: 3,
    enabled: true,
  });

  const plantsWithoutSchedule = plants.filter(
    (p) => !schedules.some((s) => s.plantId === p.id),
  );

  const handleEnableNotifications = async () => {
    const result = await requestPermission();
    if (result === 'denied') {
      alert('Notifications blocked. Enable them in your browser settings.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.plantId) return;
    await upsertWateringSchedule(form.plantId, {
      intervalDays: form.intervalDays,
      enabled: form.enabled,
      lastWatered: new Date().toISOString().slice(0, 10),
    });
    setModalOpen(false);
    setForm({ plantId: '', intervalDays: 3, enabled: true });
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    await db.wateringSchedules.update(id, { enabled: !enabled });
  };

  const updateInterval = async (id: string, intervalDays: number) => {
    await db.wateringSchedules.update(id, { intervalDays });
  };

  const deleteSchedule = async (id: string) => {
    if (confirm('Remove this watering schedule?')) {
      await db.wateringSchedules.delete(id);
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>Watering Reminders</h1>
        <p>Schedule and track irrigation for each specimen</p>
      </header>

      <div className="page-actions">
        <Button onClick={() => setModalOpen(true)}>Add Schedule</Button>
        <Button variant="secondary" onClick={handleEnableNotifications}>
          Enable Notifications
        </Button>
      </div>

      {plants.length === 0 ? (
        <EmptyState
          title="No specimens to water"
          description="Catalogue plants in the herbarium before setting watering schedules."
        />
      ) : schedules.length === 0 ? (
        <EmptyState
          title="No watering schedules"
          description="Set how often each specimen needs watering and receive reminders when due."
          action={<Button onClick={() => setModalOpen(true)}>Add Schedule</Button>}
        />
      ) : (
        <div className="grid-2">
          {schedules.map((schedule) => (
            <Card
              key={schedule.id}
              className={schedule.due && schedule.enabled ? 'card--overdue' : ''}
            >
              <h3>{schedule.plant?.commonName ?? 'Unknown'}</h3>
              <p className="botanical-name">{schedule.plant?.botanicalName}</p>
              <p>
                <span
                  className={`tag ${schedule.due ? 'tag--due' : ''} ${schedule.due && schedule.enabled ? 'tag--overdue' : ''}`}
                >
                  {formatWateringStatus(schedule)}
                </span>
              </p>
              <div className="form-row" style={{ marginTop: '0.75rem' }}>
                <label>Every (days)</label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={schedule.intervalDays}
                  onChange={(e) =>
                    updateInterval(schedule.id, parseInt(e.target.value, 10) || 1)
                  }
                />
              </div>
              <div className="card-actions">
                <Button onClick={() => markWatered(schedule.id)}>Mark Watered</Button>
                <Button
                  variant="ghost"
                  onClick={() => toggleEnabled(schedule.id, schedule.enabled)}
                >
                  {schedule.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button variant="danger" onClick={() => deleteSchedule(schedule.id)}>
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Watering Schedule">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Specimen</label>
            <PlantPicker
              value={form.plantId}
              onChange={(id) => setForm({ ...form, plantId: id })}
              required
            />
            {plantsWithoutSchedule.length === 0 && plants.length > 0 && (
              <small style={{ color: 'var(--color-ink-muted)' }}>
                All specimens already have schedules — this will update an existing one.
              </small>
            )}
          </div>
          <div className="form-row">
            <label htmlFor="interval">Water every (days)</label>
            <Input
              id="interval"
              type="number"
              min={1}
              max={30}
              value={form.intervalDays}
              onChange={(e) =>
                setForm({ ...form, intervalDays: parseInt(e.target.value, 10) || 1 })
              }
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="enabled">Enabled</label>
            <Select
              id="enabled"
              value={form.enabled ? 'yes' : 'no'}
              onChange={(e) => setForm({ ...form, enabled: e.target.value === 'yes' })}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </div>
          <div className="form-actions">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Schedule</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
