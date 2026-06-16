import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/database';
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

export function GardenMaps() {
  const maps = useLiveQuery(() => db.gardenMaps.toArray(), []) ?? [];
  const plants = usePlants() ?? [];
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [newMapOpen, setNewMapOpen] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const [addBedMode, setAddBedMode] = useState(false);
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
    const map: GardenMap = {
      id: newId(),
      name: newMapName.trim(),
      width: 520,
      height: 380,
      beds: [],
    };
    await db.gardenMaps.add(map);
    setSelectedMapId(map.id);
    setNewMapName('');
    setNewMapOpen(false);
  };

  const deleteMap = async (id: string) => {
    if (!confirm('Delete this garden map and all plant placements?')) return;
    await db.transaction('rw', [db.gardenMaps, db.mapPlacements], async () => {
      await db.mapPlacements.where('mapId').equals(id).delete();
      await db.gardenMaps.delete(id);
    });
    setSelectedMapId(null);
  };

  const addBed = async (x: number, y: number, endX: number, endY: number) => {
    if (!selectedMap) return;
    const bed: Bed = {
      id: newId(),
      label: `Bed ${selectedMap.beds.length + 1}`,
      shape: 'rect',
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
              onClick={() => {
                setAddBedMode(!addBedMode);
                setAddPlantMode(false);
                setBedDraft(null);
              }}
            >
              {addBedMode ? 'Click two corners…' : 'Draw Bed'}
            </Button>
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
}

function MapCanvas({ map, placements, plants, bedDraft, onMapClick }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
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

  const plantName = (id: string) => plants.find((p) => p.id === id)?.commonName ?? '?';

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
          <rect width="100%" height="100%" fill="#e8dcc8" stroke="#c4b498" strokeWidth="2" />
          {map.beds.map((bed) => {
            const [x, y, w, h] = bed.coords;
            return (
              <g key={bed.id}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="rgba(61, 90, 62, 0.12)"
                  stroke="var(--color-forest)"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  rx="4"
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
        {placements.map((p) => (
          <Link key={p.id} to={`/plants/${p.plantId}`} className="map-legend__item">
            🌿 {plantName(p.plantId)}
          </Link>
        ))}
      </div>
    </Card>
  );
}
