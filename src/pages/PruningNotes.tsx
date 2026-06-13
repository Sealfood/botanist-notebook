import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { db, savePhotoBlob, deletePhotoBlob, getPhotoUrl } from '../db/database';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { usePlants } from '../hooks/usePlants';
import { newId } from '../utils/id';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DateBadge } from '../components/ui/DateBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PlantPicker, getPlantLabel } from '../components/ui/PlantPicker';
import './PruningNotes.css';

export function PruningNotes() {
  const plants = usePlants() ?? [];
  const notes =
    useLiveQuery(() => db.pruningNotes.orderBy('date').reverse().toArray(), []) ?? [];
  const [filterPlantId, setFilterPlantId] = useState('');
  const [groupByPlant, setGroupByPlant] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    plantId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    action: '',
    notes: '',
    beforeFile: null as File | null,
    afterFile: null as File | null,
  });

  const filtered = useMemo(() => {
    if (!filterPlantId) return notes;
    return notes.filter((n) => n.plantId === filterPlantId);
  }, [notes, filterPlantId]);

  const grouped = useMemo(() => {
    if (!groupByPlant) return null;
    const map = new Map<string, typeof notes>();
    for (const note of filtered) {
      const existing = map.get(note.plantId) ?? [];
      existing.push(note);
      map.set(note.plantId, existing);
    }
    return map;
  }, [filtered, groupByPlant]);

  const handleSubmit = async (e: React.SubmitEvent) => {
    (e.target as HTMLFormElement).preventDefault();
    if (!form.plantId || !form.action.trim()) return;

    let beforePhotoKey: string | undefined;
    let afterPhotoKey: string | undefined;
    if (form.beforeFile) beforePhotoKey = await savePhotoBlob(form.beforeFile);
    if (form.afterFile) afterPhotoKey = await savePhotoBlob(form.afterFile);

    await db.pruningNotes.add({
      id: newId(),
      plantId: form.plantId,
      date: form.date,
      action: form.action.trim(),
      notes: form.notes.trim() || undefined,
      beforePhotoKey,
      afterPhotoKey,
    });

    setModalOpen(false);
    setForm({
      plantId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      action: '',
      notes: '',
      beforeFile: null,
      afterFile: null,
    });
  };

  const deleteNote = async (note: (typeof notes)[0]) => {
    if (!confirm('Remove this pruning note?')) return;
    await db.transaction('rw', [db.pruningNotes, db.photoBlobs], async () => {
      await db.pruningNotes.delete(note.id);
      if (note.beforePhotoKey) await deletePhotoBlob(note.beforePhotoKey);
      if (note.afterPhotoKey) await deletePhotoBlob(note.afterPhotoKey);
    });
  };

  const renderNote = (note: (typeof notes)[0]) => (
    <Card key={note.id} variant="field-note" className="pruning-entry">
      <div className="pruning-entry__header">
        <DateBadge date={note.date} />
        <div>
          <h3>{getPlantLabel(plants, note.plantId)}</h3>
          <p className="pruning-entry__action">{note.action}</p>
        </div>
      </div>
      {note.notes && <p className="pruning-entry__notes">{note.notes}</p>}
      {(note.beforePhotoKey || note.afterPhotoKey) && (
        <div className="pruning-entry__photos">
          {note.beforePhotoKey && (
            <PruningPhoto blobKey={note.beforePhotoKey} label="Before" />
          )}
          {note.afterPhotoKey && (
            <PruningPhoto blobKey={note.afterPhotoKey} label="After" />
          )}
        </div>
      )}
      <Button variant="danger" onClick={() => deleteNote(note)}>
        Remove
      </Button>
    </Card>
  );

  return (
    <>
      <header className="page-header">
        <h1>Pruning Notes</h1>
        <p>Field journal of cutting, deadheading, and shaping</p>
      </header>

      <div className="page-actions">
        <Button onClick={() => setModalOpen(true)}>Add Field Note</Button>
        <Button
          variant="secondary"
          onClick={() => setGroupByPlant(!groupByPlant)}
        >
          {groupByPlant ? 'Flat View' : 'Group by Plant'}
        </Button>
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
          title="No specimens to note"
          description="Catalogue plants in the herbarium before recording pruning observations."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No pruning notes yet"
          description="Record your first cutting or deadheading observation in the field journal."
          action={<Button onClick={() => setModalOpen(true)}>Add Field Note</Button>}
        />
      ) : groupByPlant && grouped ? (
        Array.from(grouped.entries()).map(([plantId, plantNotes]) => (
          <section key={plantId} className="pruning-group">
            <h2>{getPlantLabel(plants, plantId)}</h2>
            {plantNotes.map(renderNote)}
          </section>
        ))
      ) : (
        <div className="pruning-list">{filtered.map(renderNote)}</div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Field Note">
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
            <label htmlFor="pruneDate">Date</label>
            <Input
              id="pruneDate"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="action">Action Taken</label>
            <Input
              id="action"
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
              placeholder="Deadhead spent blooms"
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="pruneNotes">Detailed Notes</label>
            <Textarea
              id="pruneNotes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="pruning-textarea"
            />
          </div>
          <div className="form-row">
            <label htmlFor="beforePhoto">Before (optional)</label>
            <Input
              id="beforePhoto"
              type="file"
              accept="image/*"
              onChange={(e) =>
                setForm({ ...form, beforeFile: e.target.files?.[0] ?? null })
              }
            />
          </div>
          <div className="form-row">
            <label htmlFor="afterPhoto">After (optional)</label>
            <Input
              id="afterPhoto"
              type="file"
              accept="image/*"
              onChange={(e) =>
                setForm({ ...form, afterFile: e.target.files?.[0] ?? null })
              }
            />
          </div>
          <div className="form-actions">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Note</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function PruningPhoto({ blobKey, label }: { blobKey: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPhotoUrl(blobKey).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [blobKey]);

  if (!url) return null;
  return (
    <figure className="pruning-photo">
      <img src={url} alt={label} />
      <figcaption className="handwritten">{label}</figcaption>
    </figure>
  );
}
