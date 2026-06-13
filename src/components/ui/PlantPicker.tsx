import { usePlants } from '../../hooks/usePlants';
import { Select } from './Input';

interface PlantPickerProps {
  value: string;
  onChange: (plantId: string) => void;
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export function PlantPicker({
  value,
  onChange,
  required,
  allowEmpty,
  emptyLabel = 'Select a specimen…',
}: PlantPickerProps) {
  const plants = usePlants() ?? [];

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {plants.map((plant) => (
        <option key={plant.id} value={plant.id}>
          {plant.commonName} ({plant.botanicalName})
        </option>
      ))}
    </Select>
  );
}

export function getPlantLabel(
  plants: { id: string; commonName: string; botanicalName: string }[],
  plantId: string,
): string {
  const plant = plants.find((p) => p.id === plantId);
  return plant ? `${plant.commonName}` : 'Unknown specimen';
}
