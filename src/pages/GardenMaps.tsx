import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, deletePhotoBlob, getPhotoUrl, savePhotoBlob } from '../db/database';
import type { Bed, GardenMap, MapPlacement } from '../db/schema';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { usePlants } from '../hooks/usePlants';
import { newId } from '../utils/id';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PlantPicker } from '../components/ui/PlantPicker';
import './GardenMaps.css';

type BedShape = Bed['shape'];

const bedShapeOptions: { shape: BedShape; label: string }[] = [
  { shape: 'rect', label: 'Rectangle' },
  { shape: 'circle', label: 'Circle' },
  { shape: 'u', label: 'U Shape' },
];

export function GardenMaps() {
  const maps = useLiveQuery(() => db.gardenMaps.toArray(), []) ?? [];
  const plants = usePlants() ?? [];
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [newMapOpen, setNewMapOpen] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const [newMapImageFile, setNewMapImageFile] = useState<File | null>(null);
  const [addBedMode, setAddBedMode] = useState(false);
  const [selectedBedShape, setSelectedBedShape] = useState<BedShape>('rect');
  const [addPlantMode, setAddPlantMode] = useState(false);
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [bedDraft, setBedDraft] = useState<{ x: number; y: number } | null>(null);

  const selectedMap = maps.find((m) => m.id === selectedMapId) ?? maps[0] ?? null;

  // Placements are scoped to the active map so switching maps updates markers.
  const placements =
    useLiveQuery(
      () =>
        selectedMap
          ? db.mapPlacements.where('mapId').equals(selectedMap.id).toArray()
          : Promise.resolve([] as MapPlacement[]),
      [selectedMap?.id],
    ) ?? [];

  const createMap = async () => {
    if (!newMapName.trim()) return;
    const imageMeta = newMapImageFile
      ? await saveMapBackground(newMapImageFile)
      : undefined;
    const map: GardenMap = {
      id: newId(),
      name: newMapName.trim(),
      width: imageMeta?.width ?? 520,
      height: imageMeta?.height ?? 380,
      beds: [],
      backgroundPhotoKey: imageMeta?.key,
    };
    await db.gardenMaps.add(map);
    setSelectedMapId(map.id);
    setNewMapName('');
    setNewMapImageFile(null);
    setNewMapOpen(false);
  };

  const deleteMap = async (id: string) => {
    if (!confirm('Delete this garden map and all plant placements?')) return;
    const map = await db.gardenMaps.get(id);
    await db.transaction('rw', [db.gardenMaps, db.mapPlacements, db.photoBlobs], async () => {
      await db.mapPlacements.where('mapId').equals(id).delete();
      await db.gardenMaps.delete(id);
      if (map?.backgroundPhotoKey) await deletePhotoBlob(map.backgroundPhotoKey);
    });
    setSelectedMapId(null);
  };

  const updateMapBackground = async (map: GardenMap, file: File) => {
    const imageMeta = await saveMapBackground(file);
    await db.transaction('rw', [db.gardenMaps, db.photoBlobs], async () => {
      await db.gardenMaps.update(map.id, {
        width: imageMeta.width,
        height: imageMeta.height,
        backgroundPhotoKey: imageMeta.key,
      });
      if (map.backgroundPhotoKey) await deletePhotoBlob(map.backgroundPhotoKey);
    });
  };

  const removeMapBackground = async (map: GardenMap) => {
    if (!map.backgroundPhotoKey) return;
    const oldKey = map.backgroundPhotoKey;
    await db.transaction('rw', [db.gardenMaps, db.photoBlobs], async () => {
      await db.gardenMaps.update(map.id, {
        width: 520,
        height: 380,
        backgroundPhotoKey: undefined,
      });
      await deletePhotoBlob(oldKey);
    });
  };

  const deletePlacement = async (placement: MapPlacement) => {
    if (!confirm(`Remove ${getPlantName(plants, placement.plantId)} from this map?`)) return;
    await db.mapPlacements.delete(placement.id);
  };

  const deleteBed = async (map: GardenMap, bed: Bed) => {
    if (!confirm(`Remove ${bed.label} from this map?`)) return;
    await db.gardenMaps.update(map.id, {
      beds: map.beds.filter((b) => b.id !== bed.id),
    });
  };

  const updateBed = async (map: GardenMap, updatedBed: Bed) => {
    await db.gardenMaps.update(map.id, {
      beds: map.beds.map((bed) => (bed.id === updatedBed.id ? updatedBed : bed)),
    });
  };

  const rotateBed = async (map: GardenMap, bed: Bed, degrees: number) => {
    await updateBed(map, {
      ...bed,
      rotation: normalizeRotation((bed.rotation ?? 0) + degrees),
    });
  };

  const saveMap = async (map: GardenMap) => {
    await db.gardenMaps.update(map.id, {
      name: map.name,
      width: map.width,
      height: map.height,
      beds: map.beds,
      backgroundPhotoKey: map.backgroundPhotoKey,
    });
  };

  const addBed = async (x: number, y: number, endX: number, endY: number) => {
    if (!selectedMap) return;
    const bed: Bed = {
      id: newId(),
      label: `Bed ${selectedMap.beds.length + 1}`,
      shape: selectedBedShape,
      rotation: 0,
      coords: [
        Math.min(x, endX),
        Math.min(y, endY),
        Math.abs(endX - x),
        Math.abs(endY - y),
      ],
    };
    await db.gardenMaps.update(selectedMap.id, {
      beds: [...selectedMap.beds, bed],
    });
  };

  const handleMapClick = async (e: React.MouseEvent<SVGSVGElement>) => {
    if (!selectedMap) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    // Convert from viewport mouse coordinates into the SVG's map coordinate space.
    const { x, y } = pt.matrixTransform(ctm.inverse());

    if (addBedMode) {
      if (!bedDraft) {
        // First click anchors the bed; second click defines the opposite corner.
        setBedDraft({ x, y });
      } else {
        await addBed(bedDraft.x, bedDraft.y, x, y);
        setBedDraft(null);
        setAddBedMode(false);
      }
      return;
    }

    if (addPlantMode && selectedPlantId) {
      const placement: MapPlacement = {
        id: newId(),
        mapId: selectedMap.id,
        plantId: selectedPlantId,
        x,
        y,
      };
      await db.mapPlacements.add(placement);
      setAddPlantMode(false);
      setSelectedPlantId('');
    }
  };

  if (maps.length === 0) {
    return (
      <>
        <header className="page-header">
          <h1>Garden Maps</h1>
          <p>Sketch maps of beds and specimen placements</p>
        </header>
        <EmptyState
          title="No garden maps yet"
          description="Draw your first bed layout to begin charting where each specimen grows."
          action={<Button onClick={() => setNewMapOpen(true)}>Create Garden Map</Button>}
        />
        <Modal open={newMapOpen} onClose={() => setNewMapOpen(false)} title="New Garden Map">
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              createMap();
            }}
          >
            <div className="form-row">
              <label htmlFor="mapName">Map Name</label>
              <Input
                id="mapName"
                value={newMapName}
                onChange={(e) => setNewMapName(e.target.value)}
                placeholder="Kitchen Garden, 1887"
                required
              />
            </div>
            <MapImageField
              inputId="mapImage"
              onChange={setNewMapImageFile}
            />
            <div className="form-actions">
              <Button variant="secondary" type="button" onClick={() => setNewMapOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Map</Button>
            </div>
          </form>
        </Modal>
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <h1>Garden Maps</h1>
        <p>Sketch maps of beds and specimen placements</p>
      </header>

      <div className="page-actions">
        <Button onClick={() => setNewMapOpen(true)}>New Map</Button>
        {selectedMap && (
          <>
            <Button
              variant={addBedMode ? 'primary' : 'secondary'}
              title="Click the map once to set the first corner, then click again to set the opposite corner and create the bed."
              onClick={() => {
                setAddBedMode(!addBedMode);
                setAddPlantMode(false);
                setBedDraft(null);
              }}
            >
              {addBedMode ? 'Click two corners…' : 'Draw Bed'}
            </Button>
            <div className="bed-shape-picker" aria-label="Bed shape">
              {bedShapeOptions.map(({ shape, label }) => (
                <Button
                  key={shape}
                  variant={selectedBedShape === shape ? 'primary' : 'secondary'}
                  title={`Draw ${label.toLowerCase()} beds`}
                  onClick={() => setSelectedBedShape(shape)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Button
              variant={addPlantMode ? 'primary' : 'secondary'}
              onClick={() => {
                setAddPlantMode(!addPlantMode);
                setAddBedMode(false);
                setBedDraft(null);
              }}
            >
              {addPlantMode ? 'Click map to place…' : 'Place Plant'}
            </Button>
            <Button variant="danger" onClick={() => deleteMap(selectedMap.id)}>
              Delete Map
            </Button>
          </>
        )}
      </div>

      {addPlantMode && (
        <div className="map-toolbar">
          <PlantPicker value={selectedPlantId} onChange={setSelectedPlantId} required allowEmpty />
        </div>
      )}

      <div className="maps-layout">
        <aside className="maps-list">
          {maps.map((map) => (
            <button
              key={map.id}
              className={`maps-list__item ${selectedMap?.id === map.id ? 'maps-list__item--active' : ''}`}
              onClick={() => setSelectedMapId(map.id)}
            >
              {map.name}
            </button>
          ))}
        </aside>

        {selectedMap && (
          <MapCanvas
            map={selectedMap}
            placements={placements}
            plants={plants}
            bedDraft={bedDraft}
            onMapClick={handleMapClick}
            onUploadBackground={(file) => updateMapBackground(selectedMap, file)}
            onRemoveBackground={() => removeMapBackground(selectedMap)}
            onDeletePlacement={deletePlacement}
            onDeleteBed={(bed) => deleteBed(selectedMap, bed)}
            onUpdateBed={(bed) => updateBed(selectedMap, bed)}
            onRotateBed={(bed, degrees) => rotateBed(selectedMap, bed, degrees)}
            onSaveMap={() => saveMap(selectedMap)}
          />
        )}
      </div>

      <Modal open={newMapOpen} onClose={() => setNewMapOpen(false)} title="New Garden Map">
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            createMap();
          }}
        >
          <div className="form-row">
            <label htmlFor="mapName2">Map Name</label>
            <Input
              id="mapName2"
              value={newMapName}
              onChange={(e) => setNewMapName(e.target.value)}
              placeholder="Kitchen Garden, 1887"
              required
            />
          </div>
          <MapImageField
            inputId="mapImage2"
            onChange={setNewMapImageFile}
          />
          <div className="form-actions">
            <Button variant="secondary" type="button" onClick={() => setNewMapOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Map</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

interface MapCanvasProps {
  map: GardenMap;
  placements: MapPlacement[];
  plants: { id: string; commonName: string }[];
  bedDraft: { x: number; y: number } | null;
  onMapClick: (e: React.MouseEvent<SVGSVGElement>) => void;
  onUploadBackground: (file: File) => void;
  onRemoveBackground: () => void;
  onDeletePlacement: (placement: MapPlacement) => void;
  onDeleteBed: (bed: Bed) => void;
  onUpdateBed: (bed: Bed) => void;
  onRotateBed: (bed: Bed, degrees: number) => void;
  onSaveMap: () => Promise<void>;
}

function MapCanvas({
  map,
  placements,
  plants,
  bedDraft,
  onMapClick,
  onUploadBackground,
  onRemoveBackground,
  onDeletePlacement,
  onDeleteBed,
  onUpdateBed,
  onRotateBed,
  onSaveMap,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [background, setBackground] = useState<{ key: string; url: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<string | null>(null);
  const [draggingBedId, setDraggingBedId] = useState<string | null>(null);
  const [editingBed, setEditingBed] = useState<BedFormState | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const dragOffset = useRef({ x: 0, y: 0 });
  const backgroundUrl =
    background && background.key === map.backgroundPhotoKey ? background.url : null;

  useEffect(() => {
    if (!map.backgroundPhotoKey) return;
    let active = true;
    let objectUrl: string | null = null;
    const backgroundKey = map.backgroundPhotoKey;
    getPhotoUrl(map.backgroundPhotoKey).then((url) => {
      if (active && url) {
        objectUrl = url;
        setBackground({ key: backgroundKey, url });
      }
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [map.backgroundPhotoKey]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Clamp zoom so the map remains navigable with wheel input.
    setZoom((z) => Math.min(3, Math.max(0.5, z - e.deltaY * 0.001)));
  }, []);

  const startPan = (e: React.MouseEvent) => {
    // Middle mouse or Alt+drag pans without conflicting with marker dragging.
    if (e.button !== 1 && !e.altKey) return;
    e.preventDefault();
    const startX = e.clientX - pan.x;
    const startY = e.clientY - pan.y;
    const onMove = (ev: MouseEvent) => {
      setPan({ x: ev.clientX - startX, y: ev.clientY - startY });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startMarkerDrag = (placementId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDragging(placementId);
    dragOffset.current = { x: e.clientX, y: e.clientY };
    const onMove = async (ev: MouseEvent) => {
      const placement = placements.find((p) => p.id === placementId);
      if (!placement) return;
      const svg = containerRef.current?.querySelector('svg');
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      // Store marker positions in map coordinates, not screen pixels.
      const { x, y } = pt.matrixTransform(ctm.inverse());
      await db.mapPlacements.update(placementId, { x, y });
    };
    const onUp = () => {
      setDragging(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startBedDrag = (bed: Bed, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    const [startBedX = 0, startBedY = 0, width = 0, height = 0] = bed.coords;
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const startPoint = pt.matrixTransform(ctm.inverse());

    setDraggingBedId(bed.id);

    const onMove = async (ev: MouseEvent) => {
      const moveSvg = containerRef.current?.querySelector('svg');
      if (!moveSvg) return;
      const movePt = moveSvg.createSVGPoint();
      movePt.x = ev.clientX;
      movePt.y = ev.clientY;
      const moveCtm = moveSvg.getScreenCTM();
      if (!moveCtm) return;
      const point = movePt.matrixTransform(moveCtm.inverse());
      const nextX = clampNumber(
        Math.round(startBedX + point.x - startPoint.x),
        0,
        Math.max(0, map.width - width),
      );
      const nextY = clampNumber(
        Math.round(startBedY + point.y - startPoint.y),
        0,
        Math.max(0, map.height - height),
      );

      onUpdateBed({
        ...bed,
        rotation: bed.rotation ?? 0,
        coords: [nextX, nextY, width, height],
      });
    };

    const onUp = () => {
      setDraggingBedId(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const plantName = (id: string) => plants.find((p) => p.id === id)?.commonName ?? '?';

  const openBedEditor = (bed: Bed) => {
    const [x = 0, y = 0, width = 0, height = 0] = bed.coords;
    setEditingBed({
      id: bed.id,
      label: bed.label,
      shape: normalizeBedShape(bed.shape),
      rotation: Math.round(bed.rotation ?? 0),
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    });
  };

  const saveBedEdits = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingBed) return;
    onUpdateBed({
      id: editingBed.id,
      label: editingBed.label.trim() || 'Untitled Bed',
      shape: editingBed.shape,
      rotation: normalizeRotation(editingBed.rotation),
      coords: [
        Math.round(clampNumber(editingBed.x, 0, map.width)),
        Math.round(clampNumber(editingBed.y, 0, map.height)),
        Math.round(Math.max(1, editingBed.width)),
        Math.round(Math.max(1, editingBed.height)),
      ],
    });
    setEditingBed(null);
  };

  const handleSaveMap = async () => {
    await onSaveMap();
    setSaveStatus('saved');
    window.setTimeout(() => setSaveStatus('idle'), 1500);
  };

  return (
    <Card className="map-canvas-card">
      <div className="map-controls">
        <Button variant="ghost" onClick={() => setZoom((z) => Math.min(3, z + 0.2))}>
          +
        </Button>
        <span>{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}>
          −
        </Button>
        <Button variant="ghost" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
          Reset
        </Button>
        <Button variant="secondary" onClick={() => backgroundInputRef.current?.click()}>
          {map.backgroundPhotoKey ? 'Change Picture' : 'Upload Picture'}
        </Button>
        {map.backgroundPhotoKey && (
          <Button variant="ghost" onClick={onRemoveBackground}>
            Remove Picture
          </Button>
        )}
        <Button onClick={handleSaveMap}>
          {saveStatus === 'saved' ? 'Saved' : 'Save Map'}
        </Button>
        <input
          ref={backgroundInputRef}
          className="map-background-input"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadBackground(file);
            e.target.value = '';
          }}
        />
      </div>
      <div className="map-management">
        {map.beds.map((bed) => (
          <div key={bed.id} className="map-management__item map-management__item--bed">
            <span>{bed.label}</span>
            <Button variant="ghost" onClick={() => openBedEditor(bed)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              title="Rotate left 15 degrees"
              onClick={() => onRotateBed(bed, -15)}
            >
              Rotate -15
            </Button>
            <Button
              variant="ghost"
              title="Rotate right 15 degrees"
              onClick={() => onRotateBed(bed, 15)}
            >
              Rotate +15
            </Button>
            <Button variant="danger" onClick={() => onDeleteBed(bed)}>
              Remove
            </Button>
          </div>
        ))}
        {placements.map((p) => (
          <div key={p.id} className="map-management__item">
            <Link to={`/plants/${p.plantId}`}>
            ðŸŒ¿ {plantName(p.plantId)}
            </Link>
            <Button variant="danger" onClick={() => onDeletePlacement(p)}>
              Remove
            </Button>
          </div>
        ))}
      </div>
      <div
        ref={containerRef}
        className="map-viewport"
        onWheel={handleWheel}
        onMouseDown={startPan}
      >
        <svg
          viewBox={`0 0 ${map.width} ${map.height}`}
          className="garden-map-svg"
          onClick={onMapClick}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {backgroundUrl ? (
            <image
              href={backgroundUrl}
              width={map.width}
              height={map.height}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <rect width="100%" height="100%" fill="#e8dcc8" stroke="#c4b498" strokeWidth="2" />
          )}
          <rect width="100%" height="100%" fill="none" stroke="#c4b498" strokeWidth="2" />
          {map.beds.map((bed) => {
            const [x, y, w, h] = bed.coords;
            return (
              <g key={bed.id}>
                <BedShapeElement
                  bed={bed}
                  dragging={draggingBedId === bed.id}
                  onMouseDown={(e) => startBedDrag(bed, e)}
                />
                <text x={x + w / 2} y={y + h / 2} textAnchor="middle" className="bed-label">
                  {bed.label}
                </text>
              </g>
            );
          })}
          {bedDraft && (
            <circle cx={bedDraft.x} cy={bedDraft.y} r="6" fill="var(--color-wax)" opacity="0.7" />
          )}
          {placements.map((p) => (
            <g
              key={p.id}
              transform={`translate(${p.x}, ${p.y})`}
              className={`map-marker ${dragging === p.id ? 'map-marker--dragging' : ''}`}
              onMouseDown={(e) => startMarkerDrag(p.id, e)}
            >
              <circle r="14" fill="var(--color-forest)" stroke="var(--color-parchment)" strokeWidth="2" />
              <text y="4" textAnchor="middle" className="marker-icon">
                🌿
              </text>
              <title>{plantName(p.plantId)}</title>
            </g>
          ))}
        </svg>
      </div>
      <div className="map-legend">
        {map.beds.map((bed) => (
          <div key={bed.id} className="map-legend__item map-legend__item--bed">
            <span>{bed.label}</span>
            <Button variant="ghost" onClick={() => openBedEditor(bed)}>
              Edit
            </Button>
            <Button variant="danger" onClick={() => onDeleteBed(bed)}>
              Remove
            </Button>
          </div>
        ))}
        {placements.map((p) => (
          <div key={p.id} className="map-legend__item">
            <Link to={`/plants/${p.plantId}`}>
            🌿 {plantName(p.plantId)}
            </Link>
            <Button variant="danger" onClick={() => onDeletePlacement(p)}>
              Remove
            </Button>
          </div>
        ))}
      </div>
      <Modal
        open={Boolean(editingBed)}
        onClose={() => setEditingBed(null)}
        title="Edit Bed"
        closeOnOverlayClick={false}
        draggable
      >
        {editingBed && (
          <form className="form-grid" onSubmit={saveBedEdits}>
            <div className="form-row">
              <label htmlFor="bedLabel">Bed Name</label>
              <Input
                id="bedLabel"
                value={editingBed.label}
                onChange={(e) => setEditingBed({ ...editingBed, label: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label>Bed Shape</label>
              <div className="bed-shape-picker bed-shape-picker--form">
                {bedShapeOptions.map(({ shape, label }) => (
                  <Button
                    key={shape}
                    type="button"
                    variant={editingBed.shape === shape ? 'primary' : 'secondary'}
                    onClick={() => setEditingBed({ ...editingBed, shape })}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="bed-edit-grid">
              <NumberField
                id="bedX"
                label="X"
                value={editingBed.x}
                max={map.width}
                onChange={(value) => setEditingBed({ ...editingBed, x: value })}
              />
              <NumberField
                id="bedY"
                label="Y"
                value={editingBed.y}
                max={map.height}
                onChange={(value) => setEditingBed({ ...editingBed, y: value })}
              />
              <NumberField
                id="bedWidth"
                label="Width"
                value={editingBed.width}
                min={1}
                max={map.width}
                onChange={(value) => setEditingBed({ ...editingBed, width: value })}
              />
              <NumberField
                id="bedHeight"
                label="Height"
                value={editingBed.height}
                min={1}
                max={map.height}
                onChange={(value) => setEditingBed({ ...editingBed, height: value })}
              />
              <NumberField
                id="bedRotation"
                label="Rotation (degrees)"
                value={editingBed.rotation}
                min={-360}
                max={360}
                onChange={(value) => setEditingBed({ ...editingBed, rotation: value })}
              />
            </div>
            <div className="form-actions">
              <Button variant="secondary" type="button" onClick={() => setEditingBed(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Bed</Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}

function BedShapeElement({
  bed,
  dragging,
  onMouseDown,
}: {
  bed: Bed;
  dragging: boolean;
  onMouseDown: React.MouseEventHandler<SVGElement>;
}) {
  const [x = 0, y = 0, width = 0, height = 0] = bed.coords;
  const className = `map-bed ${dragging ? 'map-bed--dragging' : ''}`;
  const shape = normalizeBedShape(bed.shape);
  const rotation = normalizeRotation(bed.rotation ?? 0);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const commonProps = {
    className,
    fill: 'rgba(61, 90, 62, 0.12)',
    stroke: 'var(--color-forest)',
    strokeWidth: 2,
    strokeDasharray: '6 4',
    onMouseDown,
  };

  if (shape === 'circle') {
    return (
      <g transform={`rotate(${rotation} ${centerX} ${centerY})`}>
        <ellipse
          {...commonProps}
          cx={centerX}
          cy={centerY}
          rx={width / 2}
          ry={height / 2}
        />
      </g>
    );
  }

  if (shape === 'u') {
    return (
      <g transform={`rotate(${rotation} ${centerX} ${centerY})`}>
        <path {...commonProps} d={getUBedPath(x, y, width, height)} />
      </g>
    );
  }

  return (
    <g transform={`rotate(${rotation} ${centerX} ${centerY})`}>
      <rect {...commonProps} x={x} y={y} width={width} height={height} rx="4" />
    </g>
  );
}

interface BedFormState {
  id: string;
  label: string;
  shape: BedShape;
  rotation: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function NumberField({
  id,
  label,
  value,
  min = 0,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="form-row">
      <label htmlFor={id}>{label}</label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseNumberInput(e.target.value))}
        required
      />
    </div>
  );
}

function MapImageField({
  inputId,
  onChange,
}: {
  inputId: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="form-row">
      <label htmlFor={inputId}>Map Picture (optional)</label>
      <Input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

async function saveMapBackground(file: File): Promise<{
  key: string;
  width: number;
  height: number;
}> {
  const dimensions = await getImageDimensions(file);
  const key = await savePhotoBlob(file);
  return { key, ...dimensions };
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to read map image dimensions.'));
    });
    image.src = objectUrl;
    await loaded;
    return { width: image.naturalWidth || 520, height: image.naturalHeight || 380 };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getPlantName(
  plants: { id: string; commonName: string }[],
  plantId: string,
): string {
  return plants.find((p) => p.id === plantId)?.commonName ?? 'Unknown plant';
}

function parseNumberInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeRotation(value: number): number {
  const rounded = Math.round(value);
  return ((rounded % 360) + 360) % 360;
}

function normalizeBedShape(shape: BedShape): BedShape {
  return shape === 'circle' || shape === 'u' ? shape : 'rect';
}

function getUBedPath(x: number, y: number, width: number, height: number): string {
  const arm = Math.max(12, Math.min(width, height) * 0.28);
  const innerLeft = x + arm;
  const innerRight = x + width - arm;
  const innerBottom = y + height - arm;

  return [
    `M ${x} ${y}`,
    `H ${innerLeft}`,
    `V ${innerBottom}`,
    `H ${innerRight}`,
    `V ${y}`,
    `H ${x + width}`,
    `V ${y + height}`,
    `H ${x}`,
    'Z',
  ].join(' ');
}
