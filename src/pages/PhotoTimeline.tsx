import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { db, getPhotoUrl, savePhotoBlob, deletePhotoBlob } from '../db/database';
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
import './PhotoTimeline.css';

function PhotoThumbnail({ blobKey, alt }: { blobKey: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPhotoUrl(blobKey).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [blobKey]);

  if (!url) return <div className="photo-placeholder" aria-label="Loading" />;
  return <img src={url} alt={alt} className="photo-thumb" />;
}

export function PhotoTimeline() {
  const plants = usePlants() ?? [];
  const photos =
    useLiveQuery(() => db.photoEntries.orderBy('date').reverse().toArray(), []) ?? [];
  const [filterPlantId, setFilterPlantId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [lightbox, setLightbox] = useState<(typeof photos)[0] | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    plantId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    caption: '',
    file: null as File | null,
  });

  const filtered = useMemo(() => {
    if (!filterPlantId) return photos;
    return photos.filter((p) => p.plantId === filterPlantId);
  }, [photos, filterPlantId]);

  useEffect(() => {
    if (!lightbox) {
      setLightboxUrl(null);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    getPhotoUrl(lightbox.blobKey).then((url) => {
      if (active && url) {
        objectUrl = url;
        setLightboxUrl(url);
      }
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [lightbox]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.plantId || !form.file) return;
    const blobKey = await savePhotoBlob(form.file);
    await db.photoEntries.add({
      id: newId(),
      plantId: form.plantId,
      date: form.date,
      caption: form.caption.trim() || undefined,
      blobKey,
    });
    setModalOpen(false);
    setForm({
      plantId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      caption: '',
      file: null,
    });
  };

  const deletePhoto = async (id: string, blobKey: string) => {
    if (!confirm('Remove this photograph from the timeline?')) return;
    await db.transaction('rw', [db.photoEntries, db.photoBlobs], async () => {
      await db.photoEntries.delete(id);
      await deletePhotoBlob(blobKey);
    });
    setLightbox(null);
  };

  return (
    <>
      <header className="page-header">
        <h1>Photo Timeline</h1>
        <p>A chronological visual record of the garden</p>
      </header>

      <div className="page-actions">
        <Button onClick={() => setModalOpen(true)}>Add Photograph</Button>
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
          title="No specimens to photograph"
          description="Catalogue plants in the herbarium before adding photographs."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No photographs yet"
          description="Begin your visual chronicle by adding the first garden photograph."
          action={<Button onClick={() => setModalOpen(true)}>Add Photograph</Button>}
        />
      ) : (
        <div className="photo-gallery">
          {filtered.map((photo) => (
            <Card key={photo.id} className="photo-card">
              <button
                className="photo-card__image-btn"
                onClick={() => setLightbox(photo)}
                type="button"
              >
                <PhotoThumbnail
                  blobKey={photo.blobKey}
                  alt={photo.caption ?? getPlantLabel(plants, photo.plantId)}
                />
              </button>
              <div className="photo-card__meta">
                <DateBadge date={photo.date} />
                <div>
                  <h3>{getPlantLabel(plants, photo.plantId)}</h3>
                  {photo.caption && <p className="handwritten">{photo.caption}</p>}
                </div>
              </div>
              <Button variant="danger" onClick={() => deletePhoto(photo.id, photo.blobKey)}>
                Remove
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Photograph">
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
            <label htmlFor="photoDate">Date</label>
            <Input
              id="photoDate"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="caption">Caption</label>
            <Textarea
              id="caption"
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              placeholder="A brief field note…"
            />
          </div>
          <div className="form-row">
            <label htmlFor="photoFile">Photograph</label>
            <Input
              id="photoFile"
              type="file"
              accept="image/*"
              onChange={(e) =>
                setForm({ ...form, file: e.target.files?.[0] ?? null })
              }
              required
            />
          </div>
          <div className="form-actions">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Photograph</Button>
          </div>
        </form>
      </Modal>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)} role="presentation">
          <div className="lightbox__content" onClick={(e) => e.stopPropagation()}>
            {lightboxUrl && (
              <img src={lightboxUrl} alt={lightbox.caption ?? ''} className="lightbox__image" />
            )}
            <div className="lightbox__caption">
              <p className="handwritten">{lightbox.caption ?? 'Untitled'}</p>
              <p>{getPlantLabel(plants, lightbox.plantId)} — {lightbox.date}</p>
            </div>
            <Button variant="secondary" onClick={() => setLightbox(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
