import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addPlant, deletePlant, updatePlant, usePlant, usePlants } from '../hooks/usePlants';
import { PlantDetailPanel } from '../components/shared/PlantDetailPanel';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';

interface PlantFormData {
  commonName: string;
  botanicalName: string;
  family: string;
  location: string;
  plantedDate: string;
  notes: string;
}

const emptyForm: PlantFormData = {
  commonName: '',
  botanicalName: '',
  family: '',
  location: '',
  plantedDate: '',
  notes: '',
};

export function PlantDatabase() {
  const plants = usePlants() ?? [];
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlantFormData>(emptyForm);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return plants;
    return plants.filter(
      (p) =>
        p.commonName.toLowerCase().includes(q) ||
        p.botanicalName.toLowerCase().includes(q) ||
        p.family?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q),
    );
  }, [plants, search]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (plant: (typeof plants)[0]) => {
    setEditingId(plant.id);
    setForm({
      commonName: plant.commonName,
      botanicalName: plant.botanicalName,
      family: plant.family ?? '',
      location: plant.location ?? '',
      plantedDate: plant.plantedDate ?? '',
      notes: plant.notes ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Store optional blank fields as undefined so cards can test presence directly.
    const data = {
      commonName: form.commonName.trim(),
      botanicalName: form.botanicalName.trim(),
      family: form.family.trim() || undefined,
      location: form.location.trim() || undefined,
      plantedDate: form.plantedDate || undefined,
      notes: form.notes.trim() || undefined,
    };
    if (editingId) {
      await updatePlant(editingId, data);
    } else {
      await addPlant(data);
    }
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Remove this specimen from the herbarium? All linked records will also be deleted.')) {
      // deletePlant owns the cascade across linked notebook tables.
      await deletePlant(id);
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>Plant Database</h1>
        <p>The herbarium — catalogue of garden specimens</p>
      </header>

      <div className="page-actions">
        <Button onClick={openAdd}>Catalogue New Specimen</Button>
      </div>

      <div className="search-bar">
        <Input
          type="search"
          placeholder="Search by name, family, or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No specimens catalogued yet"
          description="Begin your herbarium by recording the first plant in your garden."
          action={<Button onClick={openAdd}>Catalogue New Specimen</Button>}
        />
      ) : (
        <div className="grid-2">
          {filtered.map((plant) => (
            <Card key={plant.id}>
              <Link to={`/plants/${plant.id}`} className="card-link" style={{ margin: '-1.25rem', padding: '1.25rem' }}>
                <h3>{plant.commonName}</h3>
                <p className="botanical-name">{plant.botanicalName}</p>
                {plant.family && <p className="card-meta">Family: {plant.family}</p>}
                {plant.location && <p className="card-meta">📍 {plant.location}</p>}
              </Link>
              <div className="card-actions">
                <Button variant="ghost" onClick={() => openEdit(plant)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => handleDelete(plant.id)}>
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Specimen' : 'Catalogue New Specimen'}
      >
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="commonName">Common Name</label>
            <Input
              id="commonName"
              value={form.commonName}
              onChange={(e) => setForm({ ...form, commonName: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="botanicalName">Botanical Name</label>
            <Input
              id="botanicalName"
              value={form.botanicalName}
              onChange={(e) => setForm({ ...form, botanicalName: e.target.value })}
              required
              className="botanical-name"
            />
          </div>
          <div className="form-row">
            <label htmlFor="family">Family</label>
            <Input
              id="family"
              value={form.family}
              onChange={(e) => setForm({ ...form, family: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="location">Location</label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="plantedDate">Planted Date</label>
            <Input
              id="plantedDate"
              type="date"
              value={form.plantedDate}
              onChange={(e) => setForm({ ...form, plantedDate: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor="notes">Notes</label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingId ? 'Save Changes' : 'Add Specimen'}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function PlantDetail() {
  const { id } = useParams<{ id: string }>();
  const plant = usePlant(id);
  const navigate = useNavigate();

  if (!plant) {
    return (
      <EmptyState
        title="Specimen not found"
        description="This entry may have been removed from the herbarium."
        action={
          <Button variant="secondary" onClick={() => navigate('/plants')}>
            Return to Herbarium
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="page-actions">
        <Button variant="secondary" onClick={() => navigate('/plants')}>
          ← Back to Herbarium
        </Button>
      </div>
      <PlantDetailPanel plant={plant} />
    </>
  );
}
