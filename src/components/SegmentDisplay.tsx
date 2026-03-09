import { useTranslation } from 'react-i18next';
import type { WorkoutSegment } from '../types';

interface SegmentDisplayProps {
  segments: WorkoutSegment[];
}

export default function SegmentDisplay({ segments }: SegmentDisplayProps) {
  const { t } = useTranslation();

  function getUnitLabel(unit: string): string {
    return t(`unit_${unit}`);
  }

  function getIntensityLabel(intensity: string): string {
    return t(`intensity_${intensity}`);
  }

  function intensityClass(intensity: string): string {
    return `intensity-${intensity}`;
  }

  const sorted = [...segments].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="segment-display">
      {sorted.map((seg, index) => (
        <div key={index} className="segment-display-item">
          <span className="segment-display-number">{index + 1}.</span>
          {seg.segment_type === 'simple' ? (
            <span>
              {seg.value} {getUnitLabel(seg.unit)}{' '}
              <span className={intensityClass(seg.intensity)}>
                {getIntensityLabel(seg.intensity).toLowerCase()}
              </span>
            </span>
          ) : (
            <span>
              {seg.repetitions} &times;{' '}
              {seg.work_value} {getUnitLabel(seg.work_unit)}{' '}
              <span className={intensityClass(seg.work_intensity)}>
                {getIntensityLabel(seg.work_intensity).toLowerCase()}
              </span>
              <span className="segment-display-separator"> / </span>
              {seg.rest_value} {getUnitLabel(seg.rest_unit)}{' '}
              <span className={intensityClass(seg.rest_intensity)}>
                {getIntensityLabel(seg.rest_intensity).toLowerCase()}
              </span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
